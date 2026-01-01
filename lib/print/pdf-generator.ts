
import { chromium } from 'playwright';

export async function generatePdfFromHtml(html: string): Promise<Buffer> {
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

        // Generate PDF
        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            displayHeaderFooter: false,
            margin: {
                top: '0',
                bottom: '0',
                left: '0',
                right: '0'
            }
        });

        return Buffer.from(pdfBuffer);
    } catch (error) {
        console.error("Error generating PDF with Playwright:", error);
        throw error;
    } finally {
        await browser.close();
    }
}
