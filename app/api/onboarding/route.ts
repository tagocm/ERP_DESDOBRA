
import { type NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { rateLimit } from '@/lib/rate-limit'
import { createClient } from '@/utils/supabase/server'

export async function POST(req: NextRequest) {
    try {
        const limitConfig = process.env.NODE_ENV === 'production'
            ? { limit: 10, windowMs: 60_000 }
            : { limit: 100, windowMs: 60_000 }
        const limit = rateLimit(req, { key: 'onboarding', ...limitConfig })
        if (!limit.ok) {
            return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
        }

        const { company_name } = await req.json()

        if (!company_name) {
            return NextResponse.json(
                { error: 'Nome da empresa é obrigatório' },
                { status: 400 }
            )
        }

        // 0. Generate Slug Server-Side
        let baseSlug = company_name.toLowerCase()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // remove accents
            .replace(/[^\w\s-]/g, '')
            .replace(/\s+/g, '-');

        if (!baseSlug) baseSlug = "empresa";

        // 1. Get Auth User
        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            return NextResponse.json(
                { error: 'Não autorizado. Faça login primeiro.' },
                { status: 401 }
            )
        }

        // 2. Create company via SECURITY DEFINER RPC (no service-role in user flow)
        let attempts = 0
        let currentSlug = baseSlug

        while (attempts < 5) {
            if (attempts > 0) {
                currentSlug = `${baseSlug}-${Math.floor(Math.random() * 1000)}`
            }

            const { data: companyId, error: rpcError } = await supabase.rpc('onboard_create_company', {
                _company_name: company_name,
                _slug: currentSlug,
            })

            if (rpcError) {
                throw rpcError
            }

            if (companyId) {
                return NextResponse.json({ company_id: companyId })
            }

            attempts++
        }

        throw new Error("Não foi possível gerar um identificador único para a empresa. Tente outro nome.")

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        logger.error('[onboarding] Error', { message })
        return NextResponse.json(
            { error: process.env.NODE_ENV === 'production' ? 'Erro interno no servidor' : message },
            { status: 500 }
        )
    }
}
