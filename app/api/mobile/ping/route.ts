import { NextRequest, NextResponse } from 'next/server'
import { validateMobileToken } from '@/lib/mobile/auth'
import { rateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
    const limitConfig = process.env.NODE_ENV === 'production'
        ? { limit: 120, windowMs: 60_000 }
        : { limit: 1000, windowMs: 60_000 };

    const limit = rateLimit(req, { key: "mobile-ping", ...limitConfig });
    if (!limit.ok) {
        return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    const authHeader = req.headers.get('Authorization')
    const companyId = await validateMobileToken(authHeader)

    if (!companyId) {
        return NextResponse.json(
            { error: 'Unauthorized' },
            { status: 401 }
        )
    }

    return NextResponse.json({
        ok: true,
        company_id: companyId,
        server_time: new Date().toISOString(),
        version: 'mobile-sync-v1'
    })
}
