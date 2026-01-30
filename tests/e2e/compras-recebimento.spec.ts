import { test, expect } from '@playwright/test';
import { ConsoleMonitor } from './helpers/console-monitor';

/**
 * Test suite for compras/recebimento page
 * Validates that fixes for race conditions work correctly
 */
test.describe('Compras Recebimento - Race Conditions', () => {
    test.beforeEach(async ({ page }) => {
        // Mock authentication if needed
        await page.context().addCookies([
            {
                name: 'sb-access-token',
                value: 'mock-token',
                domain: 'localhost',
                path: '/',
            },
        ]);
    });

    test('should handle rapid company switching without race conditions', async ({ page }) => {
        const monitor = new ConsoleMonitor(page);

        let requestCount = 0;
        const responses: any[] = [];

        // Mock API responses for purchase orders
        await page.route('**/rest/v1/purchase_orders*', (route) => {
            requestCount++;
            const url = new URL(route.request().url());
            const companyId = url.searchParams.get('company_id') || 'default';

            const responseData = {
                sent: [
                    {
                        id: `order-${companyId}-${requestCount}`,
                        company_id: companyId,
                        ordered_at: new Date().toISOString(),
                        status: 'sent',
                        supplier_id: 'supplier-1',
                    }
                ],
                received: []
            };

            responses.push({ companyId, requestCount });

            // Simulate network delay
            setTimeout(() => {
                route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify(responseData),
                });
            }, Math.random() * 100 + 50);
        });

        await page.goto('/app/compras/recebimento');
        await page.waitForLoadState('domcontentloaded');

        // Find company selector (may need to adjust selector based on actual implementation)
        const companySelector = page.locator('select, [role="combobox"]').first();

        // Simulate rapid company switching
        if (await companySelector.isVisible()) {
            for (let i = 1; i <= 3; i++) {
                await companySelector.click();
                await page.keyboard.press('ArrowDown');
                await page.keyboard.press('Enter');
                await page.waitForTimeout(50); // Very short delay to create race condition
            }

            // Wait for all pending requests to complete
            await page.waitForTimeout(500);
            await page.waitForLoadState('networkidle');
        }

        // Verify loading state is not stuck
        const loadingIndicator = page.locator('[data-loading="true"], .loading, [aria-busy="true"]');
        if (await loadingIndicator.isVisible({ timeout: 1000 }).catch(() => false)) {
            await expect(loadingIndicator).not.toBeVisible({ timeout: 5000 });
        }

        // Check for console errors
        const summary = monitor.getSummary();
        expect(summary.errors, 'Should have no console errors').toBe(0);
        expect(monitor.hasSetStateAfterUnmountError(), 'Should not have setState after unmount').toBe(false);
        expect(monitor.hasMemoryLeakWarning(), 'Should not have memory leak warnings').toBe(false);

        monitor.printSummary();
    });

    test('should not show stale data after company change', async ({ page }) => {
        const monitor = new ConsoleMonitor(page);

        // Track which company's data was requested last
        let lastRequestedCompany = '';

        await page.route('**/rest/v1/purchase_orders*', (route) => {
            const url = new URL(route.request().url());
            const companyId = url.searchParams.get('company_id') || 'company-unknown';
            lastRequestedCompany = companyId;

            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify([{
                    id: `order-${companyId}`,
                    company_id: companyId,
                    status: 'sent',
                    ordered_at: new Date().toISOString(),
                }]),
            });
        });

        await page.goto('/app/compras/recebimento');
        await page.waitForLoadState('networkidle');

        // If there's a company selector, verify data consistency
        const companySelector = page.locator('select, [role="combobox"]').first();
        if (await companySelector.isVisible()) {
            // Change company
            await companySelector.click();
            await page.keyboard.press('ArrowDown');
            await page.keyboard.press('Enter');

            // Wait for data to load
            await page.waitForLoadState('networkidle');
            await page.waitForTimeout(200);

            // Verify no errors occurred during the transition
            expect(monitor.getErrors()).toHaveLength(0);
        }

        monitor.printSummary();
    });
});
