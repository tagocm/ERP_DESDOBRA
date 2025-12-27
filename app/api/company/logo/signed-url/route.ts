import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseServer';

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

        // Get logo path from settings
        const { data: settings, error: settingsError } = await supabase
            .from('company_settings')
            .select('logo_path')
            .eq('company_id', companyId)
            .single();

        if (settingsError || !settings?.logo_path) {
            return NextResponse.json(
                { error: 'Nenhum logo encontrado' },
                { status: 404 }
            );
        }

        // Generate signed URL (valid for 1 hour)
        const { data: signedUrlData, error: signedUrlError } = await supabase.storage
            .from('company-assets')
            .createSignedUrl(settings.logo_path, 3600); // 1 hour

        if (signedUrlError || !signedUrlData) {
            console.error('Signed URL error:', signedUrlError);
            return NextResponse.json(
                { error: 'Erro ao gerar URL do logo' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            signedUrl: signedUrlData.signedUrl
        });

    } catch (error: any) {
        console.error('Signed URL generation error:', error);
        return NextResponse.json(
            { error: 'Erro interno do servidor' },
            { status: 500 }
        );
    }
}
