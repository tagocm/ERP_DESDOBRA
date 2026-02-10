import { expect, test } from '@playwright/test';

test.describe('Logistica fluxo principal', () => {
    test.use({ storageState: 'playwright/.auth/user.json' });

    test('expedicao -> iniciar rota -> retorno -> finalizar', async ({ page }) => {
        const routeName = `Rota E2E ${Date.now()}`;

        const setupResponse = await page.request.post('/api/test/setup-delivery-test', {
            data: { routeName }
        });
        expect(setupResponse.ok()).toBeTruthy();

        const setupData = await setupResponse.json();
        expect(setupData?.routeId).toBeTruthy();
        expect(setupData?.routeName).toBe(routeName);

        await page.goto('/app/logistica/expedicao');
        await expect(page.getByRole('heading', { name: 'Expedição' })).toBeVisible();

        await page.getByRole('button', { name: routeName }).first().click();
        await page.getByTitle('Carregado (Completo)').first().click();

        const startButton = page.getByRole('button', { name: 'Iniciar Rota' });
        await expect(startButton).toBeEnabled();
        await startButton.click();

        await page.getByRole('button', { name: 'Iniciar rota' }).click();
        await expect(page.getByText('Rota iniciada com sucesso!')).toBeVisible();

        await page.goto('/app/logistica/retorno');
        await expect(page.getByRole('heading', { name: 'Retorno' })).toBeVisible();
        await page.getByRole('button', { name: routeName }).first().click();

        await page.getByTitle('Entregue').first().click();

        const finishButton = page.getByRole('button', { name: 'Finalizar Retorno' });
        await expect(finishButton).toBeEnabled();
        await finishButton.click();

        await page.getByRole('button', { name: 'Confirmar e Finalizar' }).click();
        await expect(page.getByText('Retorno finalizado. Rota movida para o histórico.')).toBeVisible();
    });
});
