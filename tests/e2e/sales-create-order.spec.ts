
import { test, expect } from '@playwright/test';
import { ensureE2EData } from './helpers/seed';

test.describe('Sales Order Critical Path (True E2E)', () => {
    // 1. Use storage state from auth.setup.ts (Real Login)
    test.use({ storageState: 'playwright/.auth/user.json' });

    test.beforeAll(async () => {
        await ensureE2EData();
    });

    test('should create a new sales order successfully without mocking', async ({ page }) => {
        // Define specific timeouts for critical interactions
        const SEARCH_TIMEOUT = 10000;
        const ACTION_TIMEOUT = 15000;

        page.on('console', msg => {
            if (msg.type() === 'error')
                console.log(`BROWSER ERROR: "${msg.text()}"`);
            // Optional: Filter out noisy logs if needed
            else console.log(`BROWSER LOG: "${msg.text()}"`);
        });

        // --- Step 1: Navigate to New Order ---
        console.log('Navigating to New Order page...');
        await page.goto('/app/vendas/pedidos/novo');

        // Use regex to be flexible with query params if any
        await expect(page).toHaveURL(/\/app\/vendas\/pedidos\/novo/);

        // Wait for Page Header to ensure layout is loaded
        await expect(page.getByRole('heading', { name: /Novo Pedido|Pedido #/ })).toBeVisible({ timeout: 15000 });

        // Wait for key elements to be ready (hydration)
        // SCOPED LOCATOR: Ensure we target the input inside the form's organization selector
        const clientWrapper = page.getByTestId('order-client-input');
        const clientInput = clientWrapper.getByTestId('organization-selector-trigger');

        await expect(clientWrapper).toBeVisible({ timeout: 15000 });
        await expect(clientInput).toBeVisible({ timeout: 5000 });

        // --- Step 2: Select Client (Testing "Empório" accent normalization) ---
        console.log('Testing Accent Normalization: Searching "Empório"...');

        await clientInput.click();
        // const comboboxInput = page.getByPlaceholder('Digite nome ou documento...');
        // await expect(comboboxInput).toBeVisible();
        await expect(clientInput).toBeVisible();

        // Type slowly to mimic user and ensuring debounce trigger
        await clientInput.fill('Empório');

        // Wait for loading indicator to appear AND disappear
        const orgLoading = page.getByTestId('org-selector-loading');
        // It might be too fast to catch "visible", so we focus on "hidden" eventually.
        // But if we want to be strict, we can try to wait for it.
        // For robustness, we wait for the OPTION to appear.

        // Specific Locator for "Emporio Do Arroz Integral"
        const specificClientOption = page.locator('div[role="option"]', { hasText: 'Emporio Do Arroz Integral' });

        // Wait for the specific option to be visible
        await expect(specificClientOption).toBeVisible({ timeout: SEARCH_TIMEOUT });
        console.log('Client option "Emporio Do Arroz Integral" found.');

        // Ensure loading is finished before clicking
        // Re-use locator or just check count on existing one?
        // locator is robust, so we can check it again.
        await expect(page.getByTestId('org-selector-loading')).toHaveCount(0);

        // Try keyboard navigation as click seems flaky
        console.log('Using keyboard to select option');
        // Ensure input is focused? It should be as we typed in it.
        // Press ArrowDown to select first item
        await page.keyboard.press('ArrowDown');
        // Press Enter to confirm
        await page.keyboard.press('Enter');

        // Wait for dropdown to close (confirmation of selection action)
        await expect(specificClientOption).toBeHidden({ timeout: ACTION_TIMEOUT });

        // Verify selection behavior (trigger button text should update)
        // The trigger button text content should matching the selected company
        const btnText = await clientInput.textContent();
        console.log(`Button text after click: "${btnText}"`);

        await expect(clientInput).toHaveText(/Emporio/i, { timeout: ACTION_TIMEOUT });
        console.log('Client selected and verified.');

        // Debug: Check if save button is enabled HERE
        const saveBtnCheck = page.getByTestId('order-save-button');
        await expect(saveBtnCheck).toBeEnabled({ timeout: 5000 }).catch(e => {
            console.log('Save button NOT enabled after client selection!');
            throw e;
        });
        console.log('Save button is enabled after client selection.');


        // --- Step 3: Add Product ---
        console.log('Searching for product "Granola"...');
        const productInput = page.getByTestId('order-product-search');
        await expect(productInput).toBeVisible();

        // Clear and type
        await productInput.fill('Granola');

        // Wait for loading to finish (if we caught it) or options to appear
        const productLoading = page.getByTestId('product-selector-loading');
        await expect(productLoading).toHaveCount(0); // Ensure not loading

        // Specific Locator for Granola product
        // We know seed data usually has "Granola..."
        const specificProductOption = page.locator('div[role="option"]', { hasText: /Granola/i }).first();
        // Note: Using .first() here is risky IF there are multiple "Granola" items. 
        // Better to match a more specific one if possible, but "Granola" might be unique enough or the first one is valid.
        // User asked: "Preencher com Granola, aguardar option específica".
        // Let's rely on text match.
        await expect(specificProductOption).toBeVisible({ timeout: SEARCH_TIMEOUT });

        const productText = await specificProductOption.textContent();
        console.log(`Product found: ${productText?.trim()}. Selecting...`);

        // Use click for product as it has custom implementation (no keyboard nav?)
        console.log('Clicking product option with force: true');
        await specificProductOption.click({ force: true });

        // Wait for it to disappear (selection confirmed)
        await expect(specificProductOption).toBeHidden({ timeout: ACTION_TIMEOUT });

        // Verify inputs appear
        const qtyInput = page.getByTestId('order-item-qty');
        const priceInput = page.getByTestId('order-item-price');
        const addButton = page.getByRole('button', { name: 'Adicionar' });

        await expect(qtyInput).toBeVisible({ timeout: ACTION_TIMEOUT });
        await expect(priceInput).toBeVisible({ timeout: ACTION_TIMEOUT });

        // Verify product input has value (selection persisted)
        // ProductSelector input value usually updates to the name
        const prodVal = await productInput.inputValue();
        console.log(`Product Input Value: "${prodVal}"`);

        await expect(productInput).toHaveValue(/Granola/i, { timeout: ACTION_TIMEOUT });
        console.log('Product selected and verified.');

        // --- Handle Inputs ---
        // Quantity
        await qtyInput.fill('1');

        // Price - handling currency mask
        // Type 1000 -> 10,00
        await priceInput.click();
        await priceInput.fill('1000');

        // Wait for button to be enabled
        await expect(addButton).toBeEnabled({ timeout: ACTION_TIMEOUT });
        await addButton.click();

        // Wait for item in table (strict row check)
        const addedRow = page.locator('table tbody tr', { hasText: /Granola/i });
        await expect(addedRow).toBeVisible({ timeout: ACTION_TIMEOUT });
        console.log('Item added to order grid.');


        // --- Step 4: Save Order ---
        const saveButton = page.getByTestId('order-save-button');
        await expect(saveButton).toBeEnabled();

        console.log('Saving order...');
        await saveButton.click();

        // Verify Success Toast (Draft created)
        // Toast usually says "Rascunho criado" or "Rascunho atualizado"
        const toast = page.getByText(/Rascunho|Sucesso/i);
        await expect(toast).toBeVisible({ timeout: 15000 });
        console.log('Order saved successfully (Toast appeared).');

        // Verify Redirection
        // Note: router.replace might be fast or slow
        await expect(page).toHaveURL(/\/app\/vendas\/pedidos\/.+/, { timeout: 30000 });
        console.log('Redirected to order details.');

        // --- Step 5: Verify Persistence (List View) ---
        console.log('Verifying order in list...');
        await page.goto('/app/vendas/pedidos');

        // We expect the new order to be at the top or visible
        // We search for "Emporio" to filter just in case
        const searchInput = page.getByPlaceholder('Buscar pedidos...'); // Adjust placeholder if needed
        if (await searchInput.isVisible()) {
            await searchInput.fill('Emporio');
            await page.waitForTimeout(1000); // Debounce
        }

        const orderCell = page.getByRole('cell', { name: 'Emporio Do Arroz Integral' }).first();
        await expect(orderCell).toBeVisible({ timeout: 15000 });
        console.log('Order verified in the list.');
    });
});
