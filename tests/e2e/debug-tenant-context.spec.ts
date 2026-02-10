
import { test, expect } from '@playwright/test';
import { ensureE2EData } from './helpers/seed';

test.describe('Debug Tenant Context', () => {
    test.use({ storageState: 'playwright/.auth/user.json' });

    test.beforeAll(async () => {
        await ensureE2EData();
    });

    test('should log tenant context from browser session', async ({ page }) => {
        const consoleLogs: string[] = [];

        // Listener for console logs
        page.on('console', msg => {
            const text = msg.text();
            if (text.includes('[Debug]') || text.includes('[Search]')) {
                consoleLogs.push(text);
                console.log(`BROWSER LOG: ${text}`);
            }
        });

        // Handle Alert
        page.on('dialog', async dialog => {
            console.log(`DIALOG MESSAGE: ${dialog.message()}`);
            await dialog.accept();
        });

        // Navigate
        await page.goto('/app/vendas/pedidos/novo');
        await page.waitForLoadState('networkidle');

        // Locate Debug Button
        const debugBtn = page.locator('button[title="Debug Tenant Context"]');

        // Verify visibility (it might not be visible if NODE_ENV is production, but we removed check or are in test)
        // Actually I put process.env.NODE_ENV !== 'production'. Playwright usually runs as 'test' or 'development'?
        // Let's see if it's there.
        if (await debugBtn.isVisible()) {
            console.log('Debug button visible. Clicking...');
            await debugBtn.click();
            await page.waitForTimeout(2000); // 2 seconds for server action
        } else {
            console.log('Debug button NOT visible. NODE_ENV might be production?');
        }

        // Also perform a search to see search logs
        const clientInput = page.getByTestId('organization-selector-trigger');
        if (await clientInput.isVisible()) {
            if (await clientInput.isVisible()) {
                // await clientInput.click(); // Not strictly needed if we fill directly, or fill automatically focuses
                // The input IS the trigger in this component implementation
                await clientInput.fill('emporio');
                await page.waitForTimeout(2000); // Wait for debounce and result
            }
        }

        console.log('--- CAPTURED LOGS ---');
        consoleLogs.forEach(l => console.log(l));
        console.log('---------------------');
    });
});
