import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { validateMobileToken } from '@/lib/mobile/auth'
import { syncRequestSchema, eventItemSchema } from '@/lib/validations/mobile-sync'
import { rateLimit } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

// Force dynamic because we read headers and potential DB interaction
export const dynamic = 'force-dynamic'

type SyncResult = {
    event_id: string
    status: 'accepted' | 'duplicate' | 'error'
    payload_version?: 'v1' | 'v2'
    message?: string
}

export async function POST(req: NextRequest) {
    const exposeDetails = process.env.NODE_ENV !== 'production' || process.env.EXPOSE_ERROR_DETAILS === 'true';

    const limitConfig = process.env.NODE_ENV === 'production'
        ? { limit: 60, windowMs: 60_000 }
        : { limit: 500, windowMs: 60_000 };

    const limit = rateLimit(req, { key: "mobile-sync", ...limitConfig });
    if (!limit.ok) {
        return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    // 1. Authentication
    const authHeader = req.headers.get('Authorization')
    const companyId = await validateMobileToken(authHeader)

    if (!companyId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Parse Body
    let body: unknown
    try {
        body = await req.json()
    } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    // 3. Validation (high level structure)
    const validation = syncRequestSchema.safeParse(body)
    if (!validation.success) {
        return NextResponse.json(
            exposeDetails
                ? { error: 'Validation failed', details: validation.error.issues }
                : { error: 'Validation failed' },
            { status: 400 }
        )
    }

    const { events } = validation.data
    const results: SyncResult[] = []

    // Initialize Supabase Admin Client (needed for writing to restricted table)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
        logger.error('[mobile-sync] Missing Supabase env vars for ingestion')
        return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
    }

    const supabase = createClient(
        supabaseUrl,
        serviceRoleKey,
        {
            auth: { autoRefreshToken: false, persistSession: false }
        }
    )

    // 4. Process Loop
    for (const event of events) {
        try {
            // 4.1 Validate Payload content
            const payloadValidation = eventItemSchema.safeParse(event)
            if (!payloadValidation.success) {
                results.push({
                    event_id: event.event_id,
                    status: 'error',
                    message: exposeDetails ? payloadValidation.error.message : 'Invalid payload'
                })
                continue
            }

            const validatedEvent = payloadValidation.data as any

            // 4.2 Insert (idempotent via unique constraint)
            const { error: insertError } = await supabase
                .from('mobile_expense_events')
                .insert({
                    company_id: companyId,
                    event_id: validatedEvent.event_id,
                    event_type: validatedEvent.type,
                    payload: validatedEvent.payload,
                    status: 'received'
                })

            if (insertError) {
                if (insertError.code === '23505') { // unique_violation
                    results.push({
                        event_id: validatedEvent.event_id,
                        status: 'duplicate',
                        payload_version: validatedEvent.payload_version
                    })
                } else {
                    logger.error('[mobile-sync] Failed to insert mobile event', {
                        event_id: validatedEvent.event_id,
                        code: insertError.code,
                        message: insertError.message
                    })
                    results.push({
                        event_id: validatedEvent.event_id,
                        status: 'error',
                        payload_version: validatedEvent.payload_version,
                        message: 'Database error'
                    })
                }
            } else {
                results.push({
                    event_id: validatedEvent.event_id,
                    status: 'accepted',
                    payload_version: validatedEvent.payload_version
                })
            }

        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Unknown error'
            logger.error('[mobile-sync] Unexpected error processing event', {
                event_id: event.event_id,
                message
            })
            results.push({
                event_id: event.event_id,
                status: 'error',
                message: 'Internal server error'
            })
        }
    }

    return NextResponse.json({ results })
}
