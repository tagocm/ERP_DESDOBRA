import { NextRequest, NextResponse } from 'next/server';
import { validateLogoFile, generateFilePath } from '@/lib/upload-helpers';
import { logger } from '@/lib/logger';
import { resolveCompanyContext } from '@/lib/auth/resolve-company';

function normalizeLogoPath(rawPath: string): string | null {
    const value = String(rawPath || '').trim();
    if (!value) return null;

    if (!/^https?:\/\//i.test(value)) {
        return value.replace(/^\/+/, '').replace(/^company-assets\//, '');
    }

    try {
        const url = new URL(value);
        const normalizedHref = `${url.origin}${url.pathname}`;
        const markerPublic = '/storage/v1/object/public/company-assets/';
        const markerSigned = '/storage/v1/object/sign/company-assets/';
        if (normalizedHref.includes(markerPublic)) {
            return normalizedHref.split(markerPublic)[1]?.replace(/^\/+/, '') || null;
        }
        if (normalizedHref.includes(markerSigned)) {
            return normalizedHref.split(markerSigned)[1]?.replace(/^\/+/, '') || null;
        }
        return null;
    } catch {
        return null;
    }
}

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

        // Determine content type (force svg for .svg files to ensure correct rendering)
        const isSvg = file.name.toLowerCase().endsWith('.svg');
        const contentType = isSvg ? 'image/svg+xml' : file.type;

        // Upload to Storage
        const { error: uploadError } = await supabaseUser.storage
            .from('company-assets')
            .upload(filePath, buffer, {
                contentType: contentType,
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
            const normalizedOldLogoPath = normalizeLogoPath(existingSettings.logo_path);
            const expectedPrefixes = [`companies/${companyId}/`, `${companyId}/`];
            if (normalizedOldLogoPath && expectedPrefixes.some((p) => normalizedOldLogoPath.startsWith(p))) {
                await supabaseUser.storage
                    .from('company-assets')
                    .remove([normalizedOldLogoPath]);
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
