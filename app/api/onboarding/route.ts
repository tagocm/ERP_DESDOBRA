
import { type NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabaseServer'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { logger } from '@/lib/logger'
import { rateLimit } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
    try {
        const limitConfig = process.env.NODE_ENV === 'production'
            ? { limit: 10, windowMs: 60_000 }
            : { limit: 100, windowMs: 60_000 }
        const limit = rateLimit(req, { key: 'onboarding', ...limitConfig })
        if (!limit.ok) {
            return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
        }

        const { company_name, slug, full_name } = await req.json()

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
        const cookieStore = await cookies()
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    getAll() {
                        return cookieStore.getAll()
                    },
                    setAll(cookiesToSet) { },
                },
            }
        )

        const { data: { user } } = await supabase.auth.getUser()

        if (user) {
            // Authenticated user creating a new company
            const supabaseAdmin = createAdminClient();

            // A. Create Company with retries for slug uniqueness
            let company = null;
            let attempts = 0;
            let currentSlug = baseSlug;

            while (!company && attempts < 5) {
                if (attempts > 0) {
                    currentSlug = `${baseSlug}-${Math.floor(Math.random() * 1000)}`;
                }

                const { data, error } = await supabaseAdmin
                    .from('companies')
                    .insert({
                        name: company_name,
                        slug: currentSlug,
                    })
                    .select('id')
                    .single();

                if (!error && data) {
                    company = data;
                } else if (error?.code !== '23505') { // If not unique violation, throw invalid
                    throw error;
                }
                attempts++;
            }

            if (!company) {
                throw new Error("Não foi possível gerar um identificador único para a empresa. Tente outro nome.");
            }

            // B. Create Membership
            const { error: memberError } = await supabaseAdmin
                .from('company_members')
                .insert({
                    company_id: company.id,
                    auth_user_id: user.id,
                    role: 'admin',
                })

            if (memberError) throw memberError;

            // Return company_id for redirection
            return NextResponse.json({ company_id: company.id });

        } else {
            // Unauthenticated user (Signup flow)
            // ... existing logic for signup if needed, but currently signup page calls this endpoint AFTER creating user client-side?
            // Actually, the previous code handled auth check via cookieStore too.
            // If we are here, user IS NOT logged in?
            // Wait, allow unauthenticated for the signup flow (which sends user_id implicitly? No, signup flow creates user client-side, logs in, THEN calls this?)
            // Let's check how SignupPage calls this. It calls supabase.auth.signUp then calls API.
            // But supabase.auth.signUp logs them in on the client. The cookie might not be set on the server immediately if using implicit flows,
            // but with SSR helper it should be okay if we await properly.
            // However, for safety, if no user found via cookies, we return 401.
            // The SignupPage logic does: signUp -> fetch('/api/onboarding').

            return NextResponse.json(
                { error: 'Não autorizado. Faça login primeiro.' },
                { status: 401 }
            )
        }

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        logger.error('[onboarding] Error', { message })
        return NextResponse.json(
            { error: process.env.NODE_ENV === 'production' ? 'Erro interno no servidor' : message },
            { status: 500 }
        )
    }
}
