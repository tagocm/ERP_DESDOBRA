import { NextRequest, NextResponse } from 'next/server';
import { validateLogoFile, generateFilePath } from '@/lib/upload-helpers';
import { logger } from '@/lib/logger';
import { resolveCompanyContext } from '@/lib/auth/resolve-company';

export async function POST(request: NextRequest) {
    try {
        let ctx: Awaited<ReturnType<typeof resolveCompanyContext>>;
        try {
            ctx = await resolveCompanyContext();
        } catch {
            return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
        }

        // Get form data
        const formData = await request.formData();
        const file = formData.get('file') as File | null;
        const requestedCompanyId = formData.get('companyId');

        if (!file) {
            return NextResponse.json(
                { error: 'Nenhum arquivo enviado' },
                { status: 400 }
            );
        }

        if (typeof requestedCompanyId === 'string' && requestedCompanyId !== ctx.companyId) {
            return NextResponse.json(
                { error: 'Você não tem permissão para acessar esta empresa' },
                { status: 403 }
            );
        }

        const supabaseUser = ctx.supabase;
        const companyId = ctx.companyId;

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
        const { data: existingSettings } = await supabaseUser
            .from('company_settings')
            .select('logo_path')
            .eq('company_id', companyId)
            .maybeSingle();

        // Convert file to buffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Upload to Storage
        const { error: uploadError } = await supabaseUser.storage
            .from('company-assets')
            .upload(filePath, buffer, {
                contentType: file.type,
                upsert: false
            });

        if (uploadError) {
            logger.error('[logo/upload] Storage upload failed', {
                message: uploadError.message
            });
            return NextResponse.json(
                { error: 'Erro ao fazer upload do arquivo' },
                { status: 500 }
            );
        }

        // Delete old logo if exists
        if (existingSettings?.logo_path) {
            const expectedPrefixes = [`companies/${companyId}/`, `${companyId}/`];
            if (expectedPrefixes.some((p) => existingSettings.logo_path.startsWith(p))) {
                await supabaseUser.storage
                    .from('company-assets')
                    .remove([existingSettings.logo_path]);
            }
        }

        // Update company_settings
        const { error: updateError } = await supabaseUser
            .from('company_settings')
            .upsert({
                company_id: companyId,
                logo_path: filePath,
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'company_id'
            });

        if (updateError) {
            logger.error('[logo/upload] company_settings upsert failed', {
                code: updateError.code,
                message: updateError.message
            });
            // Try to clean up uploaded file
            await supabaseUser.storage.from('company-assets').remove([filePath]);
            return NextResponse.json(
                { error: 'Erro ao atualizar configurações' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            logoPath: filePath
        });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error('[logo/upload] Unexpected error', { message });
        return NextResponse.json(
            { error: 'Erro interno do servidor' },
            { status: 500 }
        );
    }
}
