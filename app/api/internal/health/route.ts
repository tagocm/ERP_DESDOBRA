import { NextRequest, NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'
import { isInternalAuthorized } from '@/lib/api/internal-auth'
import { errorResponse } from '@/lib/api/response'
import { createAdminClient } from '@/lib/supabaseServer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function safeErrorMessage(err: unknown): string {
    if (err instanceof Error) return err.message.slice(0, 300)
    return String(err).slice(0, 300)
}

export async function GET(req: NextRequest) {
    const limitConfig = process.env.NODE_ENV === 'production'
        ? { limit: 30, windowMs: 60_000 }
        : { limit: 300, windowMs: 60_000 }

    const limit = rateLimit(req, { key: 'internal-health', ...limitConfig })
    if (!limit.ok) return errorResponse('Too many requests', 429)

    if (!isInternalAuthorized(req)) return errorResponse('Unauthorized', 401)

    const startedAt = Date.now()
    const supabase = createAdminClient()

    const checks: Record<string, unknown> = {}

    // DB check (best-effort): touch a stable business table
    const dbStartedAt = Date.now()
    try {
        const { error } = await supabase.from('companies').select('id').limit(1)
        if (error) throw error
        checks.db = { ok: true, durationMs: Date.now() - dbStartedAt }
    } catch (err) {
        checks.db = { ok: false, durationMs: Date.now() - dbStartedAt, error: safeErrorMessage(err) }
    }

    // Storage check (best-effort)
    const storageStartedAt = Date.now()
    try {
        const { data, error } = await supabase.storage.listBuckets()
        if (error) throw error
        checks.storage = { ok: true, durationMs: Date.now() - storageStartedAt, bucketCount: data?.length ?? 0 }
    } catch (err) {
        checks.storage = { ok: false, durationMs: Date.now() - storageStartedAt, error: safeErrorMessage(err) }
    }

    const ok = Boolean((checks.db as any)?.ok) && Boolean((checks.storage as any)?.ok)

    return NextResponse.json(
        {
            ok,
            timestamp: new Date().toISOString(),
            durationMs: Date.now() - startedAt,
            checks,
        },
        { status: ok ? 200 : 503 },
    )
}

