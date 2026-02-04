import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { storePassword, deletePassword } from '@/lib/vault-helpers';
import { rateLimit } from '@/lib/rate-limit';
import { errorResponse } from '@/lib/api/response';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
    try {
        const limitConfig = process.env.NODE_ENV === 'production'
            ? { limit: 30, windowMs: 60_000 }
            : { limit: 300, windowMs: 60_000 };
        const limit = rateLimit(request, { key: "cert-a1-password", ...limitConfig });
        if (!limit.ok) {
            return errorResponse("Too many requests", 429, "RATE_LIMIT");
        }

        // Get authenticated user
        const supabaseUser = await createClient();
        const { data: { user }, error: authError } = await supabaseUser.auth.getUser();

        if (authError || !user) {
            return errorResponse("Não autenticado", 401, "UNAUTHORIZED");
        }

        // Get request data
        let body: unknown;
        try {
            body = await request.json();
        } catch {
            return errorResponse("JSON inválido", 400, "BAD_JSON");
        }
        const { companyId, password } = (body || {}) as { companyId?: string; password?: unknown };

        if (!companyId) {
            return errorResponse("ID da empresa não fornecido", 400, "INVALID_PAYLOAD");
        }

        if (!password || typeof password !== 'string') {
            return errorResponse("Senha não fornecida", 400, "INVALID_PAYLOAD");
        }

        // Verify user is member of the company
        const { data: membership, error: membershipError } = await supabaseUser
            .from('company_members')
            .select('company_id')
            .eq('company_id', companyId)
            .eq('auth_user_id', user.id) // Fixed: user_id -> auth_user_id
            .single();

        if (membershipError || !membership) {
            logger.warn('[CertPassword] Membership check failed', {
                code: membershipError?.code,
                message: membershipError?.message
            });
            return errorResponse("Você não tem permissão para acessar esta empresa", 403, "FORBIDDEN");
        }

        // Get existing password secret ID (if any)
        const { data: existingSettings } = await supabaseUser
            .from('company_settings')
            .select('cert_password_encrypted, cert_a1_storage_path')
            .eq('company_id', companyId)
            .single();

        // Delete old password if exists
        if (existingSettings?.cert_password_encrypted) {
            try {
                await deletePassword(existingSettings.cert_password_encrypted);
            } catch {
                logger.warn('[CertPassword] Failed deleting old password, continuing');
                // Continue anyway, we'll overwrite
            }
        }

        // Store new password (encrypted)
        const encryptedPassword = await storePassword(password);

        // Try to update expiration date if we have the file
        let expiresAt: string | null = null;
        if (existingSettings?.cert_a1_storage_path) {
            try {
                const { data: fileData, error: fileError } = await supabaseUser.storage
                    .from('company-assets')
                    .download(existingSettings.cert_a1_storage_path);

                if (!fileError && fileData) {
                    const arrayBuffer = await fileData.arrayBuffer();
                    const pfxBase64 = Buffer.from(arrayBuffer).toString('base64');
                    // We need to import parsePfx dynamically or ensure it's available
                    // Since it's in lib/nfe/sign/cert.ts, we can import it.
                    const { parsePfx } = await import('@/lib/nfe/sign/cert');
                    const pfxData = parsePfx(pfxBase64, password);
                    if (pfxData.certInfo.notAfter) {
                        expiresAt = pfxData.certInfo.notAfter;
                    }
                }
            } catch {
                logger.warn('[CertPassword] Failed parsing PFX for expiration, continuing');
                // Don't fail the request, just don't date update
            }
        }

        // Update company_settings with encrypted password and expiration
        const updatePayload: any = {
            company_id: companyId,
            cert_password_encrypted: encryptedPassword as any,
            updated_at: new Date().toISOString(),
            is_cert_password_saved: true
        };

        if (expiresAt) {
            updatePayload.cert_a1_expires_at = expiresAt;
        }

        const { error: updateError } = await supabaseUser
            .from('company_settings')
            .upsert(updatePayload, {
                onConflict: 'company_id'
            });

        if (updateError) {
            logger.error('[CertPassword] Failed to upsert company_settings', {
                code: updateError.code,
                message: updateError.message
            });
            return errorResponse("Erro ao salvar senha", 500, "DB_ERROR", {
                code: updateError.code,
                message: updateError.message
            });
        }

        return NextResponse.json({
            success: true,
            message: 'Senha salva com segurança',
            expiresAt
        });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error('[CertPassword] Save error', { message });
        return errorResponse(message || "Erro interno do servidor", 500, "INTERNAL_ERROR");
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const limitConfig = process.env.NODE_ENV === 'production'
            ? { limit: 30, windowMs: 60_000 }
            : { limit: 300, windowMs: 60_000 };
        const limit = rateLimit(request, { key: "cert-a1-password-delete", ...limitConfig });
        if (!limit.ok) {
            return errorResponse("Too many requests", 429, "RATE_LIMIT");
        }

        // Get authenticated user
        const supabaseUser = await createClient();
        const { data: { user }, error: authError } = await supabaseUser.auth.getUser();

        if (authError || !user) {
            return errorResponse("Não autenticado", 401, "UNAUTHORIZED");
        }

        // Get company ID from request
        let body: unknown;
        try {
            body = await request.json();
        } catch {
            return errorResponse("JSON inválido", 400, "BAD_JSON");
        }
        const { companyId } = (body || {}) as { companyId?: string };

        if (!companyId) {
            return errorResponse("ID da empresa não fornecido", 400, "INVALID_PAYLOAD");
        }

        // Verify user is member of the company
        const { data: membership, error: membershipError } = await supabaseUser
            .from('company_members')
            .select('company_id')
            .eq('company_id', companyId)
            .eq('auth_user_id', user.id) // Fixed: user_id -> auth_user_id
            .single();

        if (membershipError || !membership) {
            logger.warn('[CertPassword] Membership check failed (delete)', {
                code: membershipError?.code,
                message: membershipError?.message
            });
            return errorResponse("Você não tem permissão para acessar esta empresa", 403, "FORBIDDEN");
        }

        // Get password secret ID
        const { data: settings, error: settingsError } = await supabaseUser
            .from('company_settings')
            .select('cert_password_encrypted')
            .eq('company_id', companyId)
            .single();

        if (settingsError || !settings?.cert_password_encrypted) {
            return errorResponse("Nenhuma senha encontrada", 404, "NOT_FOUND");
        }

        // Delete password
        await deletePassword(settings.cert_password_encrypted);

        // Update company_settings to remove password reference
        const { error: updateError } = await supabaseUser
            .from('company_settings')
            .update({
                cert_password_encrypted: null,
                updated_at: new Date().toISOString()
            })
            .eq('company_id', companyId);

        if (updateError) {
            logger.error('[CertPassword] Failed updating company_settings (delete)', {
                code: updateError.code,
                message: updateError.message
            });
            return errorResponse("Erro ao remover senha", 500, "DB_ERROR", {
                code: updateError.code,
                message: updateError.message
            });
        }

        return NextResponse.json({
            success: true,
            message: 'Senha removida'
        });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error('[CertPassword] Delete error', { message });
        return errorResponse("Erro interno do servidor", 500, "INTERNAL_ERROR");
    }
}
