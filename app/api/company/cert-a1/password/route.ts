import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseServer';
import { createClient } from '@/utils/supabase/server';
import { storePassword, deletePassword } from '@/lib/vault-helpers';

export async function POST(request: NextRequest) {
    try {
        // Get authenticated user
        const supabaseUser = await createClient();
        const { data: { user }, error: authError } = await supabaseUser.auth.getUser();

        // Admin client for privileged database operations
        const supabase = createAdminClient();

        if (authError || !user) {
            return NextResponse.json(
                { error: 'Não autenticado' },
                { status: 401 }
            );
        }

        // Get request data
        const { companyId, password } = await request.json();

        if (!companyId) {
            return NextResponse.json(
                { error: 'ID da empresa não fornecido' },
                { status: 400 }
            );
        }

        if (!password || typeof password !== 'string') {
            return NextResponse.json(
                { error: 'Senha não fornecida' },
                { status: 400 }
            );
        }

        // Verify user is member of the company
        console.log(`[CertPassword] Checking membership for User ${user.id} in Company ${companyId}`);
        const { data: membership, error: membershipError } = await supabase
            .from('company_members')
            .select('company_id')
            .eq('company_id', companyId)
            .eq('auth_user_id', user.id) // Fixed: user_id -> auth_user_id
            .single();

        if (membershipError) {
            console.error('[CertPassword] Membership check error:', membershipError);
        }

        if (membershipError || !membership) {
            console.error('[CertPassword] Permission denied: Member not found or error');
            return NextResponse.json(
                { error: 'Você não tem permissão para acessar esta empresa' },
                { status: 403 }
            );
        }

        // Get existing password secret ID (if any)
        const { data: existingSettings } = await supabase
            .from('company_settings')
            .select('cert_password_encrypted, cert_a1_storage_path')
            .eq('company_id', companyId)
            .single();

        // Delete old password if exists
        if (existingSettings?.cert_password_encrypted) {
            try {
                await deletePassword(existingSettings.cert_password_encrypted);
            } catch (error) {
                console.error('Error deleting old password:', error);
                // Continue anyway, we'll overwrite
            }
        }

        // Store new password (encrypted)
        const encryptedPassword = await storePassword(password);

        // Try to update expiration date if we have the file
        let expiresAt: string | null = null;
        if (existingSettings?.cert_a1_storage_path) {
            try {
                const { data: fileData, error: fileError } = await supabase.storage
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
            } catch (err) {
                console.error('Error parsing PFX for expiration:', err);
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

        const { error: updateError } = await supabase
            .from('company_settings')
            .upsert(updatePayload, {
                onConflict: 'company_id'
            });

        if (updateError) {
            console.error('Update error details:', JSON.stringify(updateError, null, 2));
            return NextResponse.json(
                {
                    error: 'Erro ao salvar senha',
                    details: updateError.message || updateError.details || JSON.stringify(updateError)
                },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            message: 'Senha salva com segurança',
            expiresAt
        });

    } catch (error: any) {
        console.error('Password save error:', error);
        return NextResponse.json(
            { error: error.message || 'Erro interno do servidor' },
            { status: 500 }
        );
    }
}

export async function DELETE(request: NextRequest) {
    try {
        // Get authenticated user
        const supabaseUser = await createClient();
        const { data: { user }, error: authError } = await supabaseUser.auth.getUser();

        // Admin client for privileged operations
        const supabase = createAdminClient();

        if (authError || !user) {
            return NextResponse.json(
                { error: 'Não autenticado' },
                { status: 401 }
            );
        }

        // Get company ID from request
        const { companyId } = await request.json();

        if (!companyId) {
            return NextResponse.json(
                { error: 'ID da empresa não fornecido' },
                { status: 400 }
            );
        }

        // Verify user is member of the company
        const { data: membership, error: membershipError } = await supabase
            .from('company_members')
            .select('company_id')
            .eq('company_id', companyId)
            .eq('auth_user_id', user.id) // Fixed: user_id -> auth_user_id
            .single();

        if (membershipError || !membership) {
            return NextResponse.json(
                { error: 'Você não tem permissão para acessar esta empresa' },
                { status: 403 }
            );
        }

        // Get password secret ID
        const { data: settings, error: settingsError } = await supabase
            .from('company_settings')
            .select('cert_password_encrypted')
            .eq('company_id', companyId)
            .single();

        if (settingsError || !settings?.cert_password_encrypted) {
            return NextResponse.json(
                { error: 'Nenhuma senha encontrada' },
                { status: 404 }
            );
        }

        // Delete password
        await deletePassword(settings.cert_password_encrypted);

        // Update company_settings to remove password reference
        const { error: updateError } = await supabase
            .from('company_settings')
            .update({
                cert_password_encrypted: null,
                updated_at: new Date().toISOString()
            })
            .eq('company_id', companyId);

        if (updateError) {
            console.error('Update error:', updateError);
            return NextResponse.json(
                { error: 'Erro ao remover senha' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            message: 'Senha removida'
        });

    } catch (error: any) {
        console.error('Password delete error:', error);
        return NextResponse.json(
            { error: 'Erro interno do servidor' },
            { status: 500 }
        );
    }
}
