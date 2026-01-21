import { createAdminClient } from '@/lib/supabaseServer';

export async function uploadNfeArtifact(
    companyId: string,
    documentId: string,
    nfeId: string,
    fileName: string,
    content: string | Buffer,
    contentType: string = 'application/xml'
) {
    const supabase = createAdminClient();
    const path = `nfe/${documentId}/${nfeId}/${fileName}`;

    // We use the 'company-assets' bucket but organized by NFe
    // Ideally we should use a separate bucket 'nfe-artifacts' but 'company-assets' is already configured.
    // To ensure security, RLS should be checked, but we are using Admin Client here for backend process.
    const { data, error } = await supabase.storage
        .from('company-assets')
        .upload(path, content, {
            contentType,
            upsert: true
        });

    if (error) {
        throw new Error(`Failed to upload artifact ${fileName}: ${error.message}`);
    }

    return {
        path,
        fullPath: `company-assets/${path}`
    };
}

export async function downloadPfx(storagePath: string) {
    const supabase = createAdminClient();
    const { data, error } = await supabase.storage
        .from('company-assets')
        .download(storagePath);

    if (error) {
        throw new Error(`Failed to download certificate: ${error.message}`);
    }

    return await data.arrayBuffer();
}
