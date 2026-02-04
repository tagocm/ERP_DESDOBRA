import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { validateCertFile, generateFilePath } from '@/lib/upload-helpers';

export async function POST(request: NextRequest) {
    try {
        // Get authenticated user
        const supabaseUser = await createClient();
        const { data: { user }, error: authError } = await supabaseUser.auth.getUser();

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

        // Validate file
        const validation = validateCertFile(file);
        if (!validation.valid) {
            return NextResponse.json(
                { error: validation.error },
                { status: 400 }
            );
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
            console.error('Upload error:', uploadError);
            return NextResponse.json(
                { error: 'Erro ao fazer upload do certificado' },
                { status: 500 }
            );
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
            console.error('Update error:', updateError);
            // Try to clean up uploaded file
            await supabaseUser.storage.from('company-assets').remove([filePath]);
            return NextResponse.json(
                { error: 'Erro ao atualizar configurações' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            certPath: filePath,
            uploadedAt
        });

    } catch (error: any) {
        console.error('Certificate upload error:', error);
        return NextResponse.json(
            { error: 'Erro interno do servidor' },
            { status: 500 }
        );
    }
}
