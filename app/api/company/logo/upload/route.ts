import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseServer';
import { validateLogoFile, generateFilePath } from '@/lib/upload-helpers';

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

        // Get form data
        const formData = await request.formData();
        const file = formData.get('file') as File;
        const companyId = formData.get('companyId') as string;

        if (!file) {
            return NextResponse.json(
                { error: 'Nenhum arquivo enviado' },
                { status: 400 }
            );
        }

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

        // Validate file
        const validation = validateLogoFile(file);
        if (!validation.valid) {
            return NextResponse.json(
                { error: validation.error },
                { status: 400 }
            );
        }

        // Generate file path
        const filePath = generateFilePath(companyId, 'logo', file.name);

        // Get existing logo path to delete old file
        const { data: existingSettings } = await supabase
            .from('company_settings')
            .select('logo_path')
            .eq('company_id', companyId)
            .single();

        // Convert file to buffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Upload to Storage
        const { error: uploadError } = await supabase.storage
            .from('company-assets')
            .upload(filePath, buffer, {
                contentType: file.type,
                upsert: false
            });

        if (uploadError) {
            console.error('Upload error:', uploadError);
            return NextResponse.json(
                { error: 'Erro ao fazer upload do arquivo' },
                { status: 500 }
            );
        }

        // Delete old logo if exists
        if (existingSettings?.logo_path) {
            await supabase.storage
                .from('company-assets')
                .remove([existingSettings.logo_path]);
        }

        // Update company_settings
        const { error: updateError } = await supabase
            .from('company_settings')
            .upsert({
                company_id: companyId,
                logo_path: filePath,
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'company_id'
            });

        if (updateError) {
            console.error('Update error:', updateError);
            // Try to clean up uploaded file
            await supabase.storage.from('company-assets').remove([filePath]);
            return NextResponse.json(
                { error: 'Erro ao atualizar configurações' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            logoPath: filePath
        });

    } catch (error: any) {
        console.error('Logo upload error:', error);
        return NextResponse.json(
            { error: 'Erro interno do servidor' },
            { status: 500 }
        );
    }
}
