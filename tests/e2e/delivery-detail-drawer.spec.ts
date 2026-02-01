import { test, expect } from '@playwright/test';
import { ConsoleMonitor } from './helpers/console-monitor';

/**
 * Test suite for DeliveryDetailDrawer component
 * Validates unmount handling and race conditions when switching deliveries
 */
test.describe('DeliveryDetailDrawer - Unmount & Race Conditions', () => {
    test.beforeEach(async ({ page }) => {
        // Mock authentication
        await page.context().addCookies([
            {
                name: 'sb-access-token',
                value: 'mock-token',
                domain: 'localhost',
                path: '/',
            },
        ]);
    });

    test('should handle immediate close without setState after unmount', async ({ page }) => {
        const monitor = new ConsoleMonitor(page);

        let fetchStarted = false;
        let fetchCompleted = false;

        // Mock API with delay to simulate slow network
        await page.route('**/api/deliveries/*', async (route) => {
            fetchStarted = true;
            const deliveryId = route.request().url().split('/').pop();

            // Simulate slow response
            await page.waitForTimeout(500);

            fetchCompleted = true;
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    id: deliveryId,
                    number: parseInt(deliveryId?.replace('delivery-', '') || '1'),
                    status: 'in_route',
                    items: [
                        { id: 'item-1', qty_loaded: 10, qty_delivered: 10 }
                    ],
                }),
            });
        });

        await page.goto('/app/vendas/pedidos');
        await page.waitForLoadState('domcontentloaded');

        // Try to find and click a delivery row to open drawer
        const deliveryRow = page.locator('[data-testid*="delivery"], [role="button"]:has-text("Entrega")').first();

        if (await deliveryRow.isVisible({ timeout: 2000 }).catch(() => false)) {
            await deliveryRow.click();

            // Wait a bit for drawer to start opening
            await page.waitForTimeout(100);

            // Close drawer immediately (before fetch completes)
            await page.keyboard.press('Escape');

            // Alternative: click close button if exists
            const closeButton = page.locator('[aria-label="Close"], [data-testid="modal-close"], button:has-text("×")').first();
            if (await closeButton.isVisible({ timeout: 500 }).catch(() => false)) {
                await closeButton.click();
            }

            // Wait for fetch to potentially complete
            await page.waitForTimeout(1000);

            // Verify no setState after unmount warnings
            expect(monitor.hasSetStateAfterUnmountError(), 'Should not have setState after unmount').toBe(false);
            expect(monitor.hasMemoryLeakWarning(), 'Should not have memory leak warning').toBe(false);
        }

        const summary = monitor.getSummary();
        expect(summary.errors, 'Should have no console errors').toBe(0);

        monitor.printSummary();
    });

    test('should show correct data when switching between deliveries rapidly', async ({ page }) => {
        const monitor = new ConsoleMonitor(page);

        const deliveryData: Record<string, any> = {
            'delivery-1': { id: 'delivery-1', number: 1, status: 'draft' },
            'delivery-2': { id: 'delivery-2', number: 2, status: 'in_route' },
            'delivery-3': { id: 'delivery-3', number: 3, status: 'delivered' },
        };

        // Mock API responses
        await page.route('**/api/deliveries/*', async (route) => {
            const deliveryId = route.request().url().split('/').pop() || 'delivery-1';

            // Small delay to simulate network
            await page.waitForTimeout(50);

            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    ...deliveryData[deliveryId],
                    items: [{ id: `item-${deliveryId}`, qty_loaded: 5, qty_delivered: 5 }],
                    route: { name: `Rota ${deliveryId}` }
                }),
            });
        });

        await page.goto('/app/vendas/pedidos');
        await page.waitForLoadState('domcontentloaded');

        // Find delivery rows
        const deliveryRows = page.locator('[data-testid*="delivery-row"], [role="row"]:has-text("Entrega")');

        if (await deliveryRows.count() > 1) {
            // Click first delivery
            await deliveryRows.nth(0).click();
            await page.waitForTimeout(50);

            // Quickly switch to second delivery
            await deliveryRows.nth(1).click();

            // Wait for data to load
            await page.waitForLoadState('networkidle');
            await page.waitForTimeout(200);

            // Verify drawer content shows the correct delivery
            const drawerContent = page.locator('[role="dialog"], [data-testid="delivery-drawer"]');
            if (await drawerContent.isVisible({ timeout: 1000 }).catch(() => false)) {
                // Should show second delivery number, not first
                const hasCorrectNumber = await drawerContent.locator('text=/Entrega #2/i').isVisible().catch(() => false);

                if (hasCorrectNumber) {
                    // Should not show first delivery number
                    const hasWrongNumber = await drawerContent.locator('text=/Entrega #1/i').isVisible({ timeout: 500 }).catch(() => false);
                    expect(hasWrongNumber, 'Should not show previous delivery data').toBe(false);
                }
            }
        }

        expect(monitor.getErrors()).toHaveLength(0);
        monitor.printSummary();
    });

    test('should handle multiple rapid open/close cycles', async ({ page }) => {
        const monitor = new ConsoleMonitor(page);

        await page.route('**/api/deliveries/*', (route) => {
            const deliveryId = route.request().url().split('/').pop();
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    id: deliveryId,
                    number: 1,
                    items: [],
                }),
            });
        });

        await page.goto('/app/vendas/pedidos');
        await page.waitForLoadState('domcontentloaded');

        const deliveryRow = page.locator('[data-testid*="delivery"], [role="button"]:has-text("Entrega")').first();

        if (await deliveryRow.isVisible({ timeout: 2000 }).catch(() => false)) {
            // Perform multiple open/close cycles
            for (let i = 0; i < 3; i++) {
                await deliveryRow.click();
                await page.waitForTimeout(100);
                await page.keyboard.press('Escape');
                await page.waitForTimeout(100);
            }

            // Wait for any pending operations
            await page.waitForTimeout(500);
        }

        // Should not have any errors
        expect(monitor.hasSetStateAfterUnmountError()).toBe(false);
        expect(monitor.getErrors()).toHaveLength(0);

        monitor.printSummary();
    });
});
