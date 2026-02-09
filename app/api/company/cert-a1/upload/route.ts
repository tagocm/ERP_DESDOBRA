import { NextRequest, NextResponse } from 'next/server';
import { validateCertFile, generateFilePath } from '@/lib/upload-helpers';
import { rateLimit } from '@/lib/rate-limit';
import { errorResponse } from '@/lib/api/response';
import { logger } from '@/lib/logger';
import { resolveCompanyContext } from '@/lib/auth/resolve-company';

export async function POST(request: NextRequest) {
    try {
        const limitConfig = process.env.NODE_ENV === 'production'
            ? { limit: 20, windowMs: 60_000 }
            : { limit: 200, windowMs: 60_000 };
        const limit = rateLimit(request, { key: "cert-a1-upload", ...limitConfig });
        if (!limit.ok) {
            return errorResponse("Too many requests", 429, "RATE_LIMIT");
        }

        let ctx: Awaited<ReturnType<typeof resolveCompanyContext>>;
        try {
            ctx = await resolveCompanyContext();
        } catch {
            return errorResponse("Não autenticado", 401, "UNAUTHORIZED");
        }

        // Get form data
        const formData = await request.formData();
        const file = formData.get('file') as File | null;
        const requestedCompanyId = formData.get('companyId');

        if (!file) {
            return errorResponse("Nenhum arquivo enviado", 400, "INVALID_PAYLOAD");
        }

        if (typeof requestedCompanyId === 'string' && requestedCompanyId !== ctx.companyId) {
            return errorResponse("Você não tem permissão para acessar esta empresa", 403, "FORBIDDEN");
        }

        if (ctx.role !== 'admin' && ctx.role !== 'finance') {
            return errorResponse("Você não tem permissão para gerenciar o certificado", 403, "FORBIDDEN");
        }

        const supabaseUser = ctx.supabase;
        const companyId = ctx.companyId;

        // Validate file
        const validation = validateCertFile(file);
        if (!validation.valid) {
            return errorResponse(validation.error || "Arquivo inválido", 400, "INVALID_CERT");
        }

        // Generate file path
        const filePath = generateFilePath(companyId, 'cert', file.name);

        // Get existing cert path to delete old file
        const { data: existingSettings } = await supabaseUser
            .from('company_settings')
            .select('cert_a1_storage_path')
            .eq('company_id', companyId)
            .maybeSingle();

        // Convert file to buffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Upload to Storage
        const { error: uploadError } = await supabaseUser.storage
            .from('company-assets')
            .upload(filePath, buffer, {
                contentType: 'application/x-pkcs12',
                upsert: false
            });

        if (uploadError) {
            logger.error('[CertUpload] Upload error', { message: uploadError.message });
            return errorResponse("Erro ao fazer upload do certificado", 500, "STORAGE_ERROR");
        }

        // Delete old certificate if exists
        if (existingSettings?.cert_a1_storage_path) {
            const expectedPrefixes = [`companies/${companyId}/`, `${companyId}/`];
            if (expectedPrefixes.some((p) => existingSettings.cert_a1_storage_path.startsWith(p))) {
                await supabaseUser.storage
                    .from('company-assets')
                    .remove([existingSettings.cert_a1_storage_path]);
            }
        }

        const uploadedAt = new Date().toISOString();

        // TODO: Extract certificate expiration date using Node.js crypto
        // For now, we'll set it to null and implement this later
        const expiresAt = null;

        // Update company_settings
        const { error: updateError } = await supabaseUser
            .from('company_settings')
            .upsert({
                company_id: companyId,
                cert_a1_storage_path: filePath,
                cert_a1_uploaded_at: uploadedAt,
                cert_a1_expires_at: expiresAt,
                updated_at: uploadedAt
            }, {
                onConflict: 'company_id'
            });

        if (updateError) {
            logger.error('[CertUpload] company_settings upsert error', { code: updateError.code, message: updateError.message });
            // Try to clean up uploaded file
            await supabaseUser.storage.from('company-assets').remove([filePath]);
            return errorResponse("Erro ao atualizar configurações", 500, "DB_ERROR");
        }

        return NextResponse.json({
            success: true,
            certPath: filePath,
            uploadedAt
        });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error('[CertUpload] Unexpected error', { message });
        return errorResponse("Erro interno do servidor", 500, "INTERNAL_ERROR");
    }
}
