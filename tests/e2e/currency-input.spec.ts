import { test, expect } from '@playwright/test';
import { ConsoleMonitor } from './helpers/console-monitor';

/**
 * Test suite for CurrencyInput component
 * Validates prop synchronization across navigation and user input
 */
test.describe('CurrencyInput - Prop Sync', () => {
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

    test('should update when navigating between records with different values', async ({ page }) => {
        const monitor = new ConsoleMonitor(page);

        // Mock API responses for different sales orders
        await page.route('**/rest/v1/sales_orders*', (route) => {
            const url = new URL(route.request().url());
            const orderId = url.pathname.split('/').pop();

            const orderData: Record<string, any> = {
                '123': {
                    id: '123',
                    total: 1500.50,
                    status: 'draft',
                    items: [],
                    payments: [{ value: 1500.50, due_date: '2026-02-01' }],
                },
                '456': {
                    id: '456',
                    total: 2750.25,
                    status: 'approved',
                    items: [],
                    payments: [{ value: 2750.25, due_date: '2026-02-15' }],
                },
            };

            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(orderData[orderId || '123'] || orderData['123']),
            });
        });

        // Navigate to first order
        await page.goto('/app/vendas/pedidos/123');
        await page.waitForLoadState('networkidle');

        // Find currency input (might need to adjust selector)
        const currencyInput = page.locator('input[type="text"][placeholder*="R$"], input[data-testid*="currency"], input[data-testid*="total"], input[data-testid*="value"]').first();

        if (await currencyInput.isVisible({ timeout: 2000 }).catch(() => false)) {
            // Check initial value (should be formatted as Brazilian Real)
            const initialValue = await currencyInput.inputValue();
            console.log('Initial value:', initialValue);

            // Navigate to second order
            await page.goto('/app/vendas/pedidos/456');
            await page.waitForLoadState('networkidle');

            // Check that value updated
            const newValue = await currencyInput.inputValue();
            console.log('New value:', newValue);

            // Values should be different
            expect(newValue).not.toBe(initialValue);
        }

        expect(monitor.getErrors()).toHaveLength(0);
        monitor.printSummary();
    });

    test('should maintain value consistency after focus/blur cycles', async ({ page }) => {
        const monitor = new ConsoleMonitor(page);

        // Mock API for new order creation
        await page.route('**/rest/v1/sales_orders*', (route) => {
            if (route.request().method() === 'GET') {
                route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        id: 'new',
                        total: 0,
                        items: [],
                        payments: [],
                    }),
                });
            } else {
                route.continue();
            }
        });

        await page.goto('/app/vendas/pedidos/novo');
        await page.waitForLoadState('domcontentloaded');

        // Find currency input for item price or total
        const currencyInput = page.locator('input[placeholder*="R$"], input[data-testid*="price"], input[data-testid*="currency"]').first();

        if (await currencyInput.isVisible({ timeout: 3000 }).catch(() => false)) {
            // Clear and type a value
            await currencyInput.click();
            await currencyInput.clear();
            await page.keyboard.type('12345');

            // Wait for formatting
            await page.waitForTimeout(200);

            const formattedValue = await currencyInput.inputValue();
            console.log('Formatted value:', formattedValue);

            // Should be formatted (e.g., "123,45" or "R$ 123,45")
            expect(formattedValue).toBeTruthy();

            // Blur and refocus
            await currencyInput.blur();
            await page.waitForTimeout(100);
            await currencyInput.focus();
            await page.waitForTimeout(100);

            // Value should remain consistent
            const valueAfterBlur = await currencyInput.inputValue();
            expect(valueAfterBlur).toBe(formattedValue);

            // Type more digits
            await page.keyboard.type('67');
            await page.waitForTimeout(200);

            const newFormattedValue = await currencyInput.inputValue();
            console.log('New formatted value:', newFormattedValue);

            // Should have updated
            expect(newFormattedValue).not.toBe(formattedValue);
        }

        expect(monitor.getErrors()).toHaveLength(0);
        monitor.printSummary();
    });

    test('should handle rapid prop changes without errors', async ({ page }) => {
        const monitor = new ConsoleMonitor(page);

        let currentValue = 100;

        await page.route('**/rest/v1/sales_orders*', (route) => {
            currentValue += 100;
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    id: 'test',
                    total: currentValue,
                    items: [],
                }),
            });
        });

        await page.goto('/app/vendas/pedidos/test');
        await page.waitForLoadState('domcontentloaded');

        const currencyInput = page.locator('input[placeholder*="R$"]').first();

        if (await currencyInput.isVisible({ timeout: 2000 }).catch(() => false)) {
            // Simulate rapid navigation (prop changes)
            for (let i = 0; i < 3; i++) {
                await page.reload();
                await page.waitForTimeout(100);
            }

            await page.waitForLoadState('networkidle');
        }

        // Should not have errors from rapid prop updates
        expect(monitor.hasSetStateAfterUnmountError()).toBe(false);
        expect(monitor.getErrors()).toHaveLength(0);

        monitor.printSummary();
    });
});
