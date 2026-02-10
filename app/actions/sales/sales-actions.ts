"use server";

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import {
    getSalesDocumentById,
    upsertSalesDocument,
    upsertSalesItem,
    deleteSalesItem,
    confirmOrder,
    cancelSalesDocument,
    dispatchOrder,
    emitNfeMock,
    recalculateFiscalForOrder,
    cleanupUserDrafts,
    deleteSalesDocument,
    getLastOrderForClient,
    getSalesOrderTotals
} from '@/lib/data/sales-orders';
import { SalesOrder, SalesOrderItem } from '@/types/sales';

// ============================================================================
// HELPER: Get Company ID
// ============================================================================
export async function getCompanyId(): Promise<string> {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) throw new Error('Usuário não autenticado');

    const { data: companies } = await supabase
        .from('companies')
        .select('id')
        .eq('owner_id', user.id)
        .single();

    if (companies) return companies.id;

    // Check membership
    const { data: members, error: memberError } = await supabase
        .from('company_members')
        .select('company_id')
        .eq('auth_user_id', user.id)
        .limit(1);

    if (memberError) {
        console.error('getCompanyId member error:', memberError);
    }

    if (members && members.length > 0) {
        return members[0].company_id;
    }

    throw new Error('Empresa não encontrada para o usuário');
}

// ============================================================================
// SCHEMAS
// ============================================================================

const GetOrderSchema = z.object({
    id: z.string().uuid()
});

const UpsertOrderSchema = z.object({
    id: z.string().optional(),
    client_id: z.string().uuid(),
    status_commercial: z.string(),
    // Allow loose structure for flexibility, but could be stricter
}).passthrough();

const UpsertItemSchema = z.object({
    id: z.string().optional(),
    document_id: z.string().uuid(),
    // passthrough for flexible item fields
}).passthrough();

const DeleteItemSchema = z.object({
    id: z.string().uuid()
});

const ConfirmOrderSchema = z.object({
    id: z.string().uuid()
});

const CancelOrderSchema = z.object({
    id: z.string().uuid(),
    reason: z.string().min(1)
});

const DispatchOrderSchema = z.object({
    id: z.string().uuid()
});

const EmitNfeSchema = z.object({
    orderId: z.string().uuid(),
    isAntecipada: z.boolean(),
    details: z.string().optional().default('')
});

const RecalculateFiscalSchema = z.object({
    orderId: z.string().uuid(),
    companyUF: z.string(),
    companyTaxRegime: z.enum(['simples', 'normal']),
    customerUF: z.string(),
    customerType: z.enum(['contribuinte', 'isento', 'nao_contribuinte']),
    customerIsFinalConsumer: z.boolean()
});

const CleanupDraftsSchema = z.object({
    excludeId: z.string().optional()
});

export type ActionResult<T = void> =
    | { success: true; data: T }
    | { success: false; error: string };


// ============================================================================
// ACTIONS
// ============================================================================

export async function getSalesOrderAction(id: string): Promise<ActionResult<SalesOrder>> {
    try {
        await getCompanyId(); // Auth check
        const supabase = await createClient();
        const data = await getSalesDocumentById(supabase, id);
        return { success: true, data };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function upsertSalesOrderAction(data: any): Promise<ActionResult<SalesOrder>> {
    try {
        await getCompanyId(); // Auth check
        // Basic validation
        if (!data.client_id) throw new Error("Cliente obrigatório");

        const supabase = await createClient();
        const result = await upsertSalesDocument(supabase, data);

        revalidatePath(`/app/vendas/pedidos/${result.id}`);
        revalidatePath('/app/vendas/pedidos');

        return { success: true, data: result };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function upsertSalesItemAction(item: any): Promise<ActionResult<SalesOrderItem>> {
    try {
        await getCompanyId();
        const supabase = await createClient();
        const result = await upsertSalesItem(supabase, item);

        revalidatePath(`/app/vendas/pedidos/${item.document_id}`);

        return { success: true, data: result };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function deleteSalesItemAction(id: string, docId: string): Promise<ActionResult<void>> {
    try {
        await getCompanyId();
        const supabase = await createClient();
        await deleteSalesItem(supabase, id);

        revalidatePath(`/app/vendas/pedidos/${docId}`);

        return { success: true, data: undefined };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function confirmOrderAction(id: string): Promise<ActionResult<void>> {
    try {
        await getCompanyId();
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        await confirmOrder(supabase, id, user!.id);

        revalidatePath(`/app/vendas/pedidos/${id}`);
        revalidatePath('/app/vendas/pedidos');

        return { success: true, data: undefined };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function cancelOrderAction(id: string, reason: string): Promise<ActionResult<void>> {
    try {
        await getCompanyId();
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        await cancelSalesDocument(supabase, id, user!.id, reason);

        revalidatePath(`/app/vendas/pedidos/${id}`);
        revalidatePath('/app/vendas/pedidos');

        return { success: true, data: undefined };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function dispatchOrderAction(id: string): Promise<ActionResult<void>> {
    try {
        await getCompanyId();
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        await dispatchOrder(supabase, id, user!.id);

        revalidatePath(`/app/vendas/pedidos/${id}`);
        return { success: true, data: undefined };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function cleanupDraftsAction(excludeId?: string): Promise<ActionResult<void>> {
    try {
        const companyId = await getCompanyId();
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        await cleanupUserDrafts(supabase, companyId, user!.id, excludeId);
        return { success: true, data: undefined };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function recalculateFiscalAction(input: z.infer<typeof RecalculateFiscalSchema>): Promise<ActionResult<void>> {
    try {
        const companyId = await getCompanyId();
        const supabase = await createClient();

        // Validate input
        const checked = RecalculateFiscalSchema.parse(input);

        await recalculateFiscalForOrder(
            supabase,
            checked.orderId,
            companyId,
            checked.companyUF,
            checked.companyTaxRegime,
            checked.customerUF,
            checked.customerType,
            checked.customerIsFinalConsumer
        );

        revalidatePath(`/app/vendas/pedidos/${checked.orderId}`);

        return { success: true, data: undefined };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function emitNfeAction(input: z.infer<typeof EmitNfeSchema>): Promise<ActionResult<void>> {
    try {
        await getCompanyId();
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        const checked = EmitNfeSchema.parse(input);

        await emitNfeMock(supabase, checked.orderId, user!.id, checked.isAntecipada, checked.details);

        revalidatePath(`/app/vendas/pedidos/${checked.orderId}`);

        return { success: true, data: undefined };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function deleteOrderAction(id: string): Promise<ActionResult<void>> {
    try {
        await getCompanyId();
        const supabase = await createClient();

        await deleteSalesDocument(supabase, id);

        revalidatePath('/app/vendas/pedidos');

        return { success: true, data: undefined };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function getLastOrderForClientAction(clientId: string): Promise<ActionResult<any>> {
    try {
        await getCompanyId();
        const supabase = await createClient();
        const data = await getLastOrderForClient(supabase, clientId);
        return { success: true, data };
    } catch (e: any) {
        // Return null data instead of error for "no last order" to simplify UI logic? 
        // Original threw error only on fetch fail.
        return { success: false, error: e.message };
    }
}


export async function getSalesOrderTotalsAction(id: string): Promise<ActionResult<any>> {
    try {
        await getCompanyId();
        const supabase = await createClient();
        const data = await getSalesOrderTotals(supabase, id);
        return { success: true, data };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

import {
    getPaymentModes,
    getPriceTables,
    getPaymentTerms,
    getOrganizationById
} from '@/lib/clients-db';

export async function getPaymentModesAction(companyId: string): Promise<any[]> {
    try {
        await getCompanyId(); // Auth check
        const supabase = await createClient();
        return await getPaymentModes(supabase, companyId);
    } catch (e) {
        return [];
    }
}

export async function getPriceTablesAction(companyId: string): Promise<any[]> {
    try {
        await getCompanyId();
        const supabase = await createClient();
        return await getPriceTables(supabase, companyId);
    } catch (e) {
        return [];
    }
}

export async function getPaymentTermsAction(companyId: string): Promise<any[]> {
    try {
        await getCompanyId();
        const supabase = await createClient();
        return await getPaymentTerms(supabase, companyId);
    } catch (e) {
        return [];
    }
}

export async function getPriceTableItemPriceAction(priceTableId: string, itemId: string): Promise<any> {
    try {
        await getCompanyId();
        const supabase = await createClient();
        const { data } = await supabase
            .from('price_table_items')
            .select('price')
            .eq('price_table_id', priceTableId)
            .eq('item_id', itemId)
            .maybeSingle();
        return data;
    } catch (e) {
        return null;
    }
}

export async function getItemPackagingsAction(itemId: string): Promise<any[]> {
    try {
        await getCompanyId();
        const supabase = await createClient();
        const { data } = await supabase
            .from('item_packaging')
            .select('*')
            .eq('item_id', itemId)
            .eq('is_active', true)
            .order('is_default_sales_unit', { ascending: false })
            .order('qty_in_base', { ascending: true });
        return data || [];
    } catch (e) {
        return [];
    }
}

export async function getQuickItemMetaAction(params: {
    itemId: string;
    priceTableId?: string | null;
}): Promise<{ price?: number; packagings: any[] }> {
    try {
        await getCompanyId();
        const supabase = await createClient();

        const packagingsQuery = supabase
            .from('item_packaging')
            .select('*')
            .eq('item_id', params.itemId)
            .eq('is_active', true)
            .order('is_default_sales_unit', { ascending: false })
            .order('qty_in_base', { ascending: true });

        const priceQuery = params.priceTableId
            ? supabase
                .from('price_table_items')
                .select('price')
                .eq('price_table_id', params.priceTableId)
                .eq('item_id', params.itemId)
                .maybeSingle()
            : Promise.resolve({ data: null, error: null } as any);

        const [{ data: packagings }, { data: priceData }] = await Promise.all([
            packagingsQuery,
            priceQuery
        ]);

        return {
            price: priceData?.price !== undefined ? Number(priceData.price) : undefined,
            packagings: packagings || []
        };
    } catch (e) {
        return { packagings: [] };
    }
}

export async function getClientDetailsAction(clientId: string): Promise<any> {
    try {
        const companyId = await getCompanyId();
        const supabase = await createClient();
        return await getOrganizationById(supabase, companyId, clientId);
    } catch (e: any) {
        console.error('getClientDetailsAction Error:', e);
        return { error: e.message };
    }
}

export async function getOrganizationDetailsAction(orgId: string): Promise<any> {
    return getClientDetailsAction(orgId);
}

export async function getCompanySettingsAction(companyId: string): Promise<any> {
    try {
        await getCompanyId();
        const supabase = await createClient();
        const { data } = await supabase
            .from('company_settings')
            .select('*')
            .eq('company_id', companyId)
            .single();
        return data;
    } catch (e) {
        return null;
    }
}
