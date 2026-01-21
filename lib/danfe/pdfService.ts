import { chromium } from 'playwright';
import { renderDanfeHtml } from './danfeRenderer';
import { parseNfe } from './danfeParser';
import { createAdminClient } from '@/lib/supabaseServer';

/**
 * Fetch logo from URL and convert to base64 data URI
 * Returns null if fetch fails (fallback to placeholder)
 */
async function fetchLogoAsDataUri(logoUrl: string): Promise<string | null> {
    try {
        console.log('[Logo Pipeline] Fetching logo:', logoUrl);

        const response = await fetch(logoUrl);
        if (!response.ok) {
            console.warn('[Logo Pipeline] Failed to fetch logo:', response.status);
            return null;
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64 = buffer.toString('base64');

        // Detect MIME type from response or fallback
        const contentType = response.headers.get('content-type') || 'image/png';
        const dataUri = `data:${contentType};base64,${base64}`;

        console.log('[Logo Pipeline] Logo converted, size:', Math.round(base64.length / 1024), 'KB');
        return dataUri;
    } catch (error: any) {
        console.error('[Logo Pipeline] Error converting logo:', error.message);
        return null;
    }
}

export async function generateDanfePdf(xmlString: string, companyId?: string): Promise<Buffer> {
    console.log('[PDF Service] Generating DANFE from XML...');

    // 1. Parse XML
    const data = parseNfe(xmlString);
    console.log('[PDF Service] Parsed NFe data');

    // 2. Asset Pipeline: Fetch and convert logo if companyId provided
    if (companyId) {
        try {
            console.log('[PDF Service] Fetching logo for company:', companyId);
            const adminSupabase = createAdminClient();

            const { data: settings } = await adminSupabase
                .from('company_settings')
                .select('logo_path')
                .single();

            if (settings?.logo_path) {
                console.log('[PDF Service] Logo URL found:', settings.logo_path);
                const logoDataUri = await fetchLogoAsDataUri(settings.logo_path);

                if (logoDataUri) {
                    // Inject logo data URI into danfeData
                    (data as any).logoUrl = logoDataUri;
                    console.log('[PDF Service] Logo successfully converted and injected');
                } else {
                    console.log('[PDF Service] Logo conversion failed, using placeholder');
                }
            } else {
                console.log('[PDF Service] No logo configured for company');
            }
        } catch (error: any) {
            console.warn('[PDF Service] Failed to fetch logo:', error.message);
            // Continue without logo - not critical
        }
    }

    // 3. Render HTML
    const html = await renderDanfeHtml(data);

    // 4. Generate PDF via Playwright
    const browser = await chromium.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();
        await page.setContent(html);

        // Use 'print' media type to ensure CSS @page rules work
        await page.emulateMedia({ media: 'print' });

        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: {
                top: '0.5cm',
                bottom: '0.5cm',
                left: '0.5cm',
                right: '0.5cm'
            }
        });

        return Buffer.from(pdfBuffer);
    } finally {
        await browser.close();
    }
}
