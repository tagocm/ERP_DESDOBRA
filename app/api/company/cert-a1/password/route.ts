import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseServer';
import { storePassword, deletePassword } from '@/lib/vault-helpers';

export async function POST(request: NextRequest) {
    try {
        // Get authenticated user
        const supabase = createAdminClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

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
        const { data: membership, error: membershipError } = await supabase
            .from('company_members')
            .select('company_id')
            .eq('company_id', companyId)
            .eq('user_id', user.id)
            .single();

        if (membershipError || !membership) {
            return NextResponse.json(
                { error: 'Você não tem permissão para acessar esta empresa' },
                { status: 403 }
            );
        }

        // Get existing password secret ID (if any)
        const { data: existingSettings } = await supabase
            .from('company_settings')
            .select('cert_a1_password_secret_id')
            .eq('company_id', companyId)
            .single();

        // Delete old password if exists
        if (existingSettings?.cert_a1_password_secret_id) {
            try {
                await deletePassword(existingSettings.cert_a1_password_secret_id);
            } catch (error) {
                console.error('Error deleting old password:', error);
                // Continue anyway, we'll overwrite
            }
        }

        // Store new password (encrypted)
        const encryptedPassword = await storePassword(password);

        // Update company_settings with encrypted password
        // Note: We're storing the encrypted string directly in cert_a1_password_secret_id
        // In a real Vault implementation, this would be a UUID reference
        const { error: updateError } = await supabase
            .from('company_settings')
            .upsert({
                company_id: companyId,
                cert_a1_password_secret_id: encryptedPassword as any, // Store encrypted string
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'company_id'
            });

        if (updateError) {
            console.error('Update error:', updateError);
            return NextResponse.json(
                { error: 'Erro ao salvar senha' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            message: 'Senha salva com segurança'
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
        const supabase = createAdminClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

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
            .eq('user_id', user.id)
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
            .select('cert_a1_password_secret_id')
            .eq('company_id', companyId)
            .single();

        if (settingsError || !settings?.cert_a1_password_secret_id) {
            return NextResponse.json(
                { error: 'Nenhuma senha encontrada' },
                { status: 404 }
            );
        }

        // Delete password
        await deletePassword(settings.cert_a1_password_secret_id);

        // Update company_settings to remove password reference
        const { error: updateError } = await supabase
            .from('company_settings')
            .update({
                cert_a1_password_secret_id: null,
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
