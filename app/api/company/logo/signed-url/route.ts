import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { resolveCompanyContext } from '@/lib/auth/resolve-company';

function normalizeLogoPath(rawPath: string): string | null {
    const value = String(rawPath || '').trim();
    if (!value) return null;

    // Plain storage path
    if (!/^https?:\/\//i.test(value)) {
        return value.replace(/^\/+/, '').replace(/^company-assets\//, '');
    }

    // Legacy URL stored in DB (public/signed)
    try {
        const url = new URL(value);
        const normalizedHref = `${url.origin}${url.pathname}`;
        const markerPublic = '/storage/v1/object/public/company-assets/';
        const markerSigned = '/storage/v1/object/sign/company-assets/';
        if (normalizedHref.includes(markerPublic)) {
            return normalizedHref.split(markerPublic)[1]?.replace(/^\/+/, '') || null;
        }
        if (normalizedHref.includes(markerSigned)) {
            return normalizedHref.split(markerSigned)[1]?.replace(/^\/+/, '') || null;
        }
        return null;
    } catch {
        return null;
    }
}

export async function POST(request: NextRequest) {
    try {
        let ctx: Awaited<ReturnType<typeof resolveCompanyContext>>;
        try {
            ctx = await resolveCompanyContext();
        } catch {
            return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
        }

        // Get company ID from request
        let requestedCompanyId: string | undefined;
        try {
            const body = (await request.json()) as unknown;
            if (body && typeof body === 'object') {
                const raw = (body as Record<string, unknown>).companyId;
                if (typeof raw === 'string') requestedCompanyId = raw;
            }
        } catch {
            // Ignore invalid/empty body
        }

        if (requestedCompanyId && requestedCompanyId !== ctx.companyId) {
            return NextResponse.json({ error: 'Você não tem permissão para acessar esta empresa' }, { status: 403 });
        }

        const supabaseUser = ctx.supabase;
        const companyId = ctx.companyId;

        // Get logo path from settings
        const { data: settings, error: settingsError } = await supabaseUser
            .from('company_settings')
            .select('logo_path')
            .eq('company_id', companyId)
            .maybeSingle();

        if (settingsError || !settings?.logo_path) {
            return NextResponse.json(
                { error: 'Nenhum logo encontrado' },
                { status: 404 }
            );
        }

        const normalizedLogoPath = normalizeLogoPath(settings.logo_path);
        const expectedPrefixes = [`companies/${companyId}/`, `${companyId}/`];
        if (!normalizedLogoPath || !expectedPrefixes.some((p) => normalizedLogoPath.startsWith(p))) {
            return NextResponse.json(
                { error: 'Nenhum logo encontrado' },
                { status: 404 }
            );
        }

        // Generate signed URL (valid for 1 hour)
        const { data: signedUrlData, error: signedUrlError } = await supabaseUser.storage
            .from('company-assets')
            .createSignedUrl(normalizedLogoPath, 3600); // 1 hour

        if (signedUrlError || !signedUrlData) {
            logger.error('[logo/signed-url] createSignedUrl failed', {
                message: signedUrlError?.message
            });
            return NextResponse.json(
                { error: 'Erro ao gerar URL do logo' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            signedUrl: signedUrlData.signedUrl
        });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error('[logo/signed-url] Unexpected error', { message });
        return NextResponse.json(
            { error: 'Erro interno do servidor' },
            { status: 500 }
        );
    }
}
