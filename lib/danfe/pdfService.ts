import { chromium } from 'playwright';
import { renderDanfeHtml } from './danfeRenderer';
import { parseNfe } from './danfeParser';
import { logger } from "@/lib/logger";

export interface DanfeEmitterOverride {
    xNome?: string | null;
    cnpj?: string | null;
    ie?: string | null;
    enderEmit?: {
        xLgr?: string | null;
        nro?: string | null;
        xBairro?: string | null;
        xMun?: string | null;
        uf?: string | null;
        cep?: string | null;
    };
}

/**
 * Fetch logo from URL and convert to base64 data URI
 * Returns null if fetch fails (fallback to placeholder)
 */
async function fetchLogoAsDataUri(logoUrl: string): Promise<string | null> {
    if (logoUrl.startsWith('data:image/')) {
        return logoUrl;
    }

    try {
        logger.info('[Logo Pipeline] Fetching logo:', logoUrl);

        const response = await fetch(logoUrl);
        if (!response.ok) {
            logger.warn('[Logo Pipeline] Failed to fetch logo:', response.status);
            return null;
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64 = buffer.toString('base64');

        // Detect MIME type from response or fallback
        const contentType = response.headers.get('content-type') || 'image/png';
        const dataUri = `data:${contentType};base64,${base64}`;

        logger.info('[Logo Pipeline] Logo converted, size:', Math.round(base64.length / 1024), 'KB');
        return dataUri;
    } catch (error: any) {
        logger.error('[Logo Pipeline] Error converting logo:', error.message);
        return null;
    }
}

export async function generateDanfePdf(
    xmlString: string,
    companyId?: string,
    logoUrl?: string,
    emitterOverride?: DanfeEmitterOverride
): Promise<Buffer> {
    logger.info('[PDF Service] Generating DANFE from XML...');

    // 1. Parse XML
    const data = parseNfe(xmlString);
    logger.info('[PDF Service] Parsed NFe data');

    // 1.1 Override emitter header fields (block below logo) when provided by current company settings
    if (emitterOverride) {
        data.emit.xNome = emitterOverride.xNome || data.emit.xNome;
        data.emit.cnpj = emitterOverride.cnpj || data.emit.cnpj;
        data.emit.ie = emitterOverride.ie || data.emit.ie;

        data.emit.enderEmit.xLgr = emitterOverride.enderEmit?.xLgr || data.emit.enderEmit.xLgr;
        data.emit.enderEmit.nro = emitterOverride.enderEmit?.nro || data.emit.enderEmit.nro;
        data.emit.enderEmit.xBairro = emitterOverride.enderEmit?.xBairro || data.emit.enderEmit.xBairro;
        data.emit.enderEmit.xMun = emitterOverride.enderEmit?.xMun || data.emit.enderEmit.xMun;
        data.emit.enderEmit.uf = emitterOverride.enderEmit?.uf || data.emit.enderEmit.uf;
        data.emit.enderEmit.cep = emitterOverride.enderEmit?.cep || data.emit.enderEmit.cep;
    }

    // 2. Asset Pipeline: caller provides a pre-authorized logo URL (e.g., signed URL from storage)
    // so this function doesn't need DB/service-role access.
    if (logoUrl) {
        try {
            logger.info('[PDF Service] Fetching logo for DANFE', { hasCompanyId: !!companyId });
            const logoDataUri = await fetchLogoAsDataUri(logoUrl);
            if (logoDataUri) {
                (data as any).logoUrl = logoDataUri;
                logger.info('[PDF Service] Logo injected');
            } else {
                logger.info('[PDF Service] Logo conversion failed, using placeholder');
            }
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            logger.warn('[PDF Service] Failed to fetch logo', { message });
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
