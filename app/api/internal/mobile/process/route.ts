import { NextRequest, NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'
import { isInternalAuthorized } from '@/lib/api/internal-auth'
import { processMobileExpenseInbox } from '@/lib/mobile/processor'
import { errorResponse } from '@/lib/api/response'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
    const limitConfig = process.env.NODE_ENV === 'production'
        ? { limit: 10, windowMs: 60_000 }
        : { limit: 300, windowMs: 60_000 }

    const limit = rateLimit(req, { key: 'internal-mobile-process', ...limitConfig })
    if (!limit.ok) return errorResponse('Too many requests', 429)

    if (!isInternalAuthorized(req)) return errorResponse('Unauthorized', 401)

    let body: unknown = null
    try {
        body = await req.json()
    } catch {
        body = null
    }

    const parsed = body && typeof body === 'object' ? (body as Record<string, unknown>) : {}
    const limitRaw = parsed.limit
    const companyIdRaw = parsed.company_id
    const dryRunRaw = parsed.dry_run

    const requestedLimit =
        typeof limitRaw === 'number' && Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : undefined

    const companyId = typeof companyIdRaw === 'string' ? companyIdRaw : undefined
    const dryRun = dryRunRaw === true

    const result = await processMobileExpenseInbox({
        limit: requestedLimit,
        companyId,
        dryRun,
    })

    return NextResponse.json({ ok: true, result })
}
