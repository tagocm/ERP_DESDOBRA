
import { chromium } from 'playwright';

export interface GeneratePdfOptions {
    displayHeaderFooter?: boolean;
    headerTemplate?: string;
    footerTemplate?: string;
    margin?: {
        top?: string;
        bottom?: string;
        left?: string;
        right?: string;
    };
}

export async function generatePdfFromHtml(html: string, options?: GeneratePdfOptions): Promise<Buffer> {
    // Launch browser
    // Note: In serverless environments (like Vercel), this might require 'playwright-core' and 'chrome-aws-lambda'.
    // Setup generic headless launch for standard Node environments.
    const browser = await chromium.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        headless: true
    });

    try {
        const page = await browser.newPage();

        // Set content
        await page.setContent(html, {
            waitUntil: 'networkidle'
        });
        await page.evaluate(async () => {
            await document.fonts.ready;
        });

        // Generate PDF
        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            displayHeaderFooter: options?.displayHeaderFooter ?? false,
            headerTemplate: options?.headerTemplate,
            footerTemplate: options?.footerTemplate,
            margin: {
                top: options?.margin?.top ?? '0',
                bottom: options?.margin?.bottom ?? '0',
                left: options?.margin?.left ?? '0',
                right: options?.margin?.right ?? '0'
            },
        });

        return Buffer.from(pdfBuffer);
    } catch (error) {
        console.error("Error generating PDF with Playwright:", error);
        throw error;
    } finally {
        await browser.close();
    }
}
