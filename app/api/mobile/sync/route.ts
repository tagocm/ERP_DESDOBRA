import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getMobileTokenHashFromHeader } from '@/lib/mobile/auth'
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

type ValidatedEvent = {
    event_id: string
    type: 'CREATE_EXPENSE' | 'EXPENSE_CREATED'
    payload: Record<string, unknown>
    payload_version: 'v1' | 'v2'
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
    const tokenHash = getMobileTokenHashFromHeader(authHeader)

    if (!tokenHash) {
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
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !anonKey) {
        logger.error('[mobile-sync] Missing Supabase env vars (URL/ANON)')
        return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
    }

    // Public client (anon key) calling SECURITY DEFINER RPCs (no service role)
    const supabase = createClient(supabaseUrl, anonKey, {
        auth: { autoRefreshToken: false, persistSession: false }
    })

    // 4. Validate events and build payload for RPC
    const pending: Array<{ kind: 'invalid'; result: SyncResult } | { kind: 'valid'; event: ValidatedEvent }> = []
    const eventsForDb: Array<{ event_id: string; type: string; payload: Record<string, unknown> }> = []

    for (const event of events) {
        const payloadValidation = eventItemSchema.safeParse(event)
        if (!payloadValidation.success) {
            pending.push({
                kind: 'invalid',
                result: {
                    event_id: event.event_id,
                    status: 'error',
                    message: exposeDetails ? payloadValidation.error.message : 'Invalid payload'
                }
            })
            continue
        }

        const validatedEvent = payloadValidation.data as ValidatedEvent
        pending.push({ kind: 'valid', event: validatedEvent })
        eventsForDb.push({
            event_id: validatedEvent.event_id,
            type: validatedEvent.type,
            payload: validatedEvent.payload
        })
    }

    // 5. Ingest via RPC
    const statusByEventId = new Map<string, SyncResult['status']>()
    if (eventsForDb.length > 0) {
        const { data: rows, error: rpcError } = await supabase.rpc('mobile_ingest_events', {
            _token_hash: tokenHash,
            _events: eventsForDb
        })

        if (rpcError) {
            logger.error('[mobile-sync] mobile_ingest_events RPC failed', {
                code: rpcError.code,
                message: rpcError.message
            })

            if (rpcError.code === '28000' || rpcError.message?.toLowerCase().includes('unauthorized')) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
            }

            if (rpcError.code === '22023') {
                return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
            }

            return NextResponse.json({ error: 'Server error' }, { status: 500 })
        }

        const safeRows = Array.isArray(rows) ? rows : []
        for (const row of safeRows) {
            const eventId = typeof (row as { event_id?: unknown }).event_id === 'string'
                ? (row as { event_id: string }).event_id
                : undefined
            const status = (row as { status?: unknown }).status
            if (!eventId) continue
            if (status === 'accepted' || status === 'duplicate' || status === 'error') {
                statusByEventId.set(eventId, status)
            }
        }
    }

    const results: SyncResult[] = pending.map((p) => {
        if (p.kind === 'invalid') return p.result
        const status = statusByEventId.get(p.event.event_id) ?? 'error'
        return {
            event_id: p.event.event_id,
            status,
            payload_version: p.event.payload_version,
            ...(status === 'error' ? { message: 'Database error' } : {})
        }
    })

    return NextResponse.json({ results })
}
