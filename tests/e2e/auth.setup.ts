import { test as setup, expect } from '@playwright/test';
import path from 'path';

const authFile = path.join(__dirname, '../../playwright/.auth/user.json');

setup('authenticate', async ({ page }) => {
    // 1. Check if we have credentials
    const email = process.env.E2E_EMAIL || 'tiago.martini@me.com';
    const password = process.env.E2E_PASSWORD || 'Mjm280202';

    // 2. Go to login
    await page.goto('/login');

    // 3. Check if already logged in (auto-login in dev) or need to login
    // If we are redirected to /app, we are good.
    // If we see the email input, we need to login.

    try {
        await page.waitForURL('/app', { timeout: 5000 });
        console.log('Auto-login or session restored. Validating...');
    } catch {
        // Not at /app, assuming strictly at /login
        console.log('Logging in via UI...');

        // Ensure inputs are visible
        await page.waitForSelector('input[name="email"]');

        await page.fill('input[name="email"]', email);
        await page.fill('input[name="password"]', password);
        await page.click('button[type="submit"]');

        await page.waitForURL('/app');
    }

    // 4. Verify we are inside
    await expect(page).toHaveURL(/.*\/app/);

    // 5. Save state
    await page.context().storageState({ path: authFile });
});
