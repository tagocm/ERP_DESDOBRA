import 'server-only';

import { createAdminClient } from '@/lib/supabaseServer';
import { z } from 'zod';

export interface RevenueBucket {
    glAccountId: string;
    amountCents: number;
}

export interface InstallmentAllocationResult {
    installmentId: string;
    installmentAmountCents: number;
    allocations: Array<{
        gl_account_id: string;
        amount: number;
    }>;
}

function distributeCentsByWeights(totalCents: number, weights: number[]): number[] {
    if (weights.length === 0) return [];
    if (totalCents <= 0) return weights.map(() => 0);

    const totalWeight = weights.reduce((sum, current) => sum + Math.max(0, current), 0);
    if (totalWeight <= 0) {
        throw new Error('Pesos inválidos para distribuição');
    }

    const rawShares = weights.map((weight) => (Math.max(0, weight) * totalCents) / totalWeight);
    const baseShares = rawShares.map((value) => Math.floor(value));
    let remainder = totalCents - baseShares.reduce((sum, current) => sum + current, 0);

    const ranking = rawShares
        .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
        .sort((a, b) => b.fraction - a.fraction || a.index - b.index);

    for (let i = 0; i < ranking.length && remainder > 0; i += 1) {
        baseShares[ranking[i].index] += 1;
        remainder -= 1;
    }

    return baseShares;
}

function normalizeBucketsToTotalCents(
    buckets: RevenueBucket[],
    totalCents: number
): RevenueBucket[] {
    const currentTotal = buckets.reduce((sum, bucket) => sum + bucket.amountCents, 0);
    if (currentTotal === totalCents) {
        return buckets;
    }

    const weights = buckets.map((bucket) => bucket.amountCents);
    const normalizedAmounts = distributeCentsByWeights(totalCents, weights);
    return buckets.map((bucket, index) => ({
        ...bucket,
        amountCents: normalizedAmounts[index]
    }));
}

export function buildInstallmentAllocationsMatrix(params: {
    installmentIds: string[];
    installmentAmountsCents: number[];
    normalizedBuckets: RevenueBucket[];
}): InstallmentAllocationResult[] {
    const { installmentIds, installmentAmountsCents, normalizedBuckets } = params;

    if (installmentIds.length !== installmentAmountsCents.length) {
        throw new Error('Parcelas inválidas para rateio');
    }

    const remainingPerBucket = normalizedBuckets.map((bucket) => bucket.amountCents);
    const matrixRows: InstallmentAllocationResult[] = [];

    for (let installmentIndex = 0; installmentIndex < installmentIds.length; installmentIndex += 1) {
        const installmentId = installmentIds[installmentIndex];
        const installmentTargetCents = installmentAmountsCents[installmentIndex];
        const isLastInstallment = installmentIndex === installmentIds.length - 1;

        const rowCents = isLastInstallment
            ? [...remainingPerBucket]
            : distributeCentsByWeights(installmentTargetCents, remainingPerBucket);

        for (let bucketIndex = 0; bucketIndex < remainingPerBucket.length; bucketIndex += 1) {
            remainingPerBucket[bucketIndex] -= rowCents[bucketIndex];
        }

        const allocations = rowCents
            .map((amountCents, bucketIndex) => ({
                gl_account_id: normalizedBuckets[bucketIndex].glAccountId,
                amount: amountCents / 100
            }))
            .filter((allocation) => allocation.amount > 0);

        matrixRows.push({
            installmentId,
            installmentAmountCents: installmentTargetCents,
            allocations
        });
    }

    return matrixRows;
}

const salesItemSchema = z.object({
    item_id: z.string().uuid(),
    quantity: z.coerce.number(),
    unit_price: z.coerce.number(),
    discount_amount: z.coerce.number().nullable().optional()
});

export async function buildRevenueBucketsFromSalesDocument(params: {
    companyId: string;
    salesDocumentId: string;
    totalAmount: number;
}): Promise<RevenueBucket[]> {
    const { companyId, salesDocumentId, totalAmount } = params;
    const supabase = await createAdminClient();

    const { data: salesItemsData, error: salesItemsError } = await supabase
        .from('sales_document_items')
        .select('item_id, quantity, unit_price, discount_amount')
        .eq('company_id', companyId)
        .eq('document_id', salesDocumentId);

    if (salesItemsError) {
        throw new Error(`Falha ao carregar itens do pedido: ${salesItemsError.message}`);
    }

    const salesItems = (salesItemsData ?? []).map((row) => salesItemSchema.parse(row));
    if (salesItems.length === 0) {
        throw new Error('Pedido sem itens para classificar contabilmente');
    }

    const uniqueItemIds = Array.from(new Set(salesItems.map((item) => item.item_id)));
    const { data: itemsData, error: itemsError } = await supabase
        .from('items')
        .select('id, category_id')
        .in('id', uniqueItemIds);

    if (itemsError) {
        throw new Error(`Falha ao carregar produtos dos itens: ${itemsError.message}`);
    }

    const itemCategoryByItemId = new Map<string, string>();
    for (const row of itemsData ?? []) {
        if (row.category_id) {
            itemCategoryByItemId.set(row.id, row.category_id);
        }
    }

    const missingCategoryItem = salesItems.find((item) => !itemCategoryByItemId.has(item.item_id));
    if (missingCategoryItem) {
        throw new Error(`Item ${missingCategoryItem.item_id} sem categoria para classificação automática`);
    }

    const uniqueCategoryIds = Array.from(new Set(itemCategoryByItemId.values()));
    const { data: categoriesData, error: categoriesError } = await supabase
        .from('product_categories')
        .select('id, revenue_account_id')
        .in('id', uniqueCategoryIds);

    if (categoriesError) {
        throw new Error(`Falha ao carregar categorias de produto: ${categoriesError.message}`);
    }

    const revenueAccountByCategory = new Map<string, string>();
    for (const row of categoriesData ?? []) {
        if (row.revenue_account_id) {
            revenueAccountByCategory.set(row.id, row.revenue_account_id);
        }
    }

    const bucketsMap = new Map<string, number>();

    for (const item of salesItems) {
        const categoryId = itemCategoryByItemId.get(item.item_id);
        if (!categoryId) {
            throw new Error(`Categoria não encontrada para item ${item.item_id}`);
        }

        const revenueAccountId = revenueAccountByCategory.get(categoryId);
        if (!revenueAccountId) {
            throw new Error(`Categoria ${categoryId} sem conta de receita configurada`);
        }

        const itemTotal = (item.quantity * item.unit_price) - (item.discount_amount ?? 0);
        const itemTotalCents = Math.round(itemTotal * 100);
        bucketsMap.set(revenueAccountId, (bucketsMap.get(revenueAccountId) ?? 0) + itemTotalCents);
    }

    const rawBuckets: RevenueBucket[] = Array.from(bucketsMap.entries())
        .map(([glAccountId, amountCents]) => ({ glAccountId, amountCents }))
        .filter((bucket) => bucket.amountCents > 0);

    if (rawBuckets.length === 0) {
        throw new Error('Não foi possível gerar buckets contábeis para o pedido');
    }

    const eventTotalCents = Math.round(totalAmount * 100);
    return normalizeBucketsToTotalCents(rawBuckets, eventTotalCents);
}
