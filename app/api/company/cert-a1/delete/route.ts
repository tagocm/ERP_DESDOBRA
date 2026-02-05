import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { errorResponse } from '@/lib/api/response';
import { logger } from '@/lib/logger';
import { resolveCompanyContext } from '@/lib/auth/resolve-company';

export async function DELETE(request: NextRequest) {
    try {
        const limitConfig = process.env.NODE_ENV === 'production'
            ? { limit: 30, windowMs: 60_000 }
            : { limit: 300, windowMs: 60_000 };
        const limit = rateLimit(request, { key: "cert-a1-delete", ...limitConfig });
        if (!limit.ok) {
            return errorResponse("Too many requests", 429, "RATE_LIMIT");
        }

        let ctx: Awaited<ReturnType<typeof resolveCompanyContext>>;
        try {
            ctx = await resolveCompanyContext();
        } catch {
            return errorResponse("Não autenticado", 401, "UNAUTHORIZED");
        }

        // Get company ID from request
        let body: unknown;
        try {
            body = await request.json();
        } catch {
            return errorResponse("JSON inválido", 400, "BAD_JSON");
        }
        const requestedCompanyId = (body && typeof body === 'object')
            ? (body as Record<string, unknown>).companyId
            : undefined;

        if (typeof requestedCompanyId === 'string' && requestedCompanyId !== ctx.companyId) {
            return errorResponse("Você não tem permissão para acessar esta empresa", 403, "FORBIDDEN");
        }

        const supabaseUser = ctx.supabase;
        const companyId = ctx.companyId;

        // Get certificate path from settings
        const { data: settings, error: settingsError } = await supabaseUser
            .from('company_settings')
            .select('cert_a1_storage_path')
            .eq('company_id', companyId)
            .maybeSingle();

        if (settingsError || !settings?.cert_a1_storage_path) {
            return errorResponse("Nenhum certificado encontrado", 404, "NOT_FOUND");
        }

        const expectedPrefixes = [`companies/${companyId}/`, `${companyId}/`];
        if (!expectedPrefixes.some((p) => settings.cert_a1_storage_path.startsWith(p))) {
            return errorResponse("Nenhum certificado encontrado", 404, "NOT_FOUND");
        }

        // Delete file from Storage
        const { error: deleteError } = await supabaseUser.storage
            .from('company-assets')
            .remove([settings.cert_a1_storage_path]);

        if (deleteError) {
            logger.error('[CertDelete] Storage delete error', { message: deleteError.message });
            return errorResponse("Erro ao deletar certificado", 500, "STORAGE_ERROR");
        }

        // Update company_settings to remove certificate data
        const { error: updateError } = await supabaseUser
            .from('company_settings')
            .update({
                cert_a1_storage_path: null,
                cert_a1_uploaded_at: null,
                cert_a1_expires_at: null,
                updated_at: new Date().toISOString()
            })
            .eq('company_id', companyId);

        if (updateError) {
            logger.error('[CertDelete] company_settings update error', { code: updateError.code, message: updateError.message });
            return errorResponse("Erro ao atualizar configurações", 500, "DB_ERROR");
        }

        return NextResponse.json({
            success: true
        });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error('[CertDelete] Unexpected error', { message });
        return errorResponse("Erro interno do servidor", 500, "INTERNAL_ERROR");
    }
}
