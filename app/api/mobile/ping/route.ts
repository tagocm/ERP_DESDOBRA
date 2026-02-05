import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getMobileTokenHashFromHeader } from '@/lib/mobile/auth'
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
    const tokenHash = getMobileTokenHashFromHeader(authHeader)

    if (!tokenHash) {
        return NextResponse.json(
            { error: 'Unauthorized' },
            { status: 401 }
        )
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !anonKey) {
        return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, anonKey, {
        auth: { autoRefreshToken: false, persistSession: false }
    })

    const { data: companyId, error } = await supabase.rpc('mobile_validate_token', {
        _token_hash: tokenHash
    })

    if (error) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!companyId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.json({
        ok: true,
        company_id: companyId,
        server_time: new Date().toISOString(),
        version: 'mobile-sync-v1'
    })
}
