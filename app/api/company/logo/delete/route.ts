import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function DELETE(request: NextRequest) {
    try {
        const supabaseUser = await createClient();
        const { data: { user }, error: authError } = await supabaseUser.auth.getUser();

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
        const { data: membership, error: membershipError } = await supabaseUser
            .from('company_members')
            .select('company_id')
            .eq('company_id', companyId)
            .eq('auth_user_id', user.id)
            .maybeSingle();

        if (membershipError || !membership) {
            return NextResponse.json(
                { error: 'Você não tem permissão para acessar esta empresa' },
                { status: 403 }
            );
        }

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

        const expectedPrefixes = [`companies/${companyId}/`, `${companyId}/`];
        if (!expectedPrefixes.some((p) => settings.logo_path.startsWith(p))) {
            return NextResponse.json(
                { error: 'Nenhum logo encontrado' },
                { status: 404 }
            );
        }

        // Delete file from Storage
        const { error: deleteError } = await supabaseUser.storage
            .from('company-assets')
            .remove([settings.logo_path]);

        if (deleteError) {
            console.error('Delete error:', deleteError);
            return NextResponse.json(
                { error: 'Erro ao deletar arquivo' },
                { status: 500 }
            );
        }

        // Update company_settings to remove logo_path
        const { error: updateError } = await supabaseUser
            .from('company_settings')
            .update({
                logo_path: null,
                updated_at: new Date().toISOString()
            })
            .eq('company_id', companyId);

        if (updateError) {
            console.error('Update error:', updateError);
            return NextResponse.json(
                { error: 'Erro ao atualizar configurações' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true
        });

    } catch (error: any) {
        console.error('Logo delete error:', error);
        return NextResponse.json(
            { error: 'Erro interno do servidor' },
            { status: 500 }
        );
    }
}
