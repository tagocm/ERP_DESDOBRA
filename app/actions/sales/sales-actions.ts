"use server";

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/lib/supabaseServer';
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
import { resolveFiscalRule } from '@/lib/data/fiscal-engine';

// ============================================================================
// HELPER: Get Company ID
// ============================================================================
export async function getCompanyId(
    preferredCompanyId?: string,
    options?: { skipMembershipValidation?: boolean }
): Promise<string> {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) throw new Error('Usuário não autenticado');

    if (preferredCompanyId) {
        if (options?.skipMembershipValidation) {
            return preferredCompanyId;
        }

        const { data: ownedCompany } = await supabase
            .from('companies')
            .select('id')
            .eq('id', preferredCompanyId)
            .eq('owner_id', user.id)
            .maybeSingle();

        if (ownedCompany?.id) return ownedCompany.id;

        const { data: memberCompany } = await supabase
            .from('company_members')
            .select('company_id')
            .eq('auth_user_id', user.id)
            .eq('company_id', preferredCompanyId)
            .limit(1)
            .maybeSingle();

        if (memberCompany?.company_id) return memberCompany.company_id;

        throw new Error('Usuário sem acesso à empresa selecionada');
    }

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

const PreviewFiscalSchema = z.object({
    companyUF: z.string(),
    companyTaxRegime: z.enum(['simples', 'normal']),
    customerUF: z.string(),
    customerType: z.enum(['contribuinte', 'isento', 'nao_contribuinte']),
    customerIsFinalConsumer: z.boolean(),
    items: z.array(z.object({
        clientItemId: z.string(),
        itemId: z.string().uuid()
    }))
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

export async function previewFiscalForItemsAction(
    input: z.infer<typeof PreviewFiscalSchema>
): Promise<ActionResult<Array<{
    clientItemId: string;
    status: 'calculated' | 'no_rule_found' | 'error';
    cfop_code: string | null;
    cst_icms: string | null;
    csosn: string | null;
    st_applies: boolean;
    st_aliquot: number | null;
    pis_cst: string | null;
    pis_aliquot: number | null;
    cofins_cst: string | null;
    cofins_aliquot: number | null;
    ipi_applies: boolean;
    ipi_cst: string | null;
    ipi_aliquot: number | null;
    fiscal_notes: string | null;
    ncm_snapshot: string | null;
    cest_snapshot: string | null;
    origin_snapshot: number | null;
}>>> {
    try {
        const companyId = await getCompanyId();
        const supabase = await createClient();
        const checked = PreviewFiscalSchema.parse(input);

        const itemIds = Array.from(new Set(checked.items.map(i => i.itemId)));
        const { data: profiles, error: profilesError } = await supabase
            .from('item_fiscal_profiles')
            .select('item_id, tax_group_id, ncm, cest, origin')
            .in('item_id', itemIds);

        if (profilesError) throw profilesError;

        const profileByItem = new Map<string, any>();
        for (const profile of profiles || []) {
            if (!profileByItem.has(profile.item_id)) {
                profileByItem.set(profile.item_id, profile);
            }
        }

        const out: Array<{
            clientItemId: string;
            status: 'calculated' | 'no_rule_found' | 'error';
            cfop_code: string | null;
            cst_icms: string | null;
            csosn: string | null;
            st_applies: boolean;
            st_aliquot: number | null;
            pis_cst: string | null;
            pis_aliquot: number | null;
            cofins_cst: string | null;
            cofins_aliquot: number | null;
            ipi_applies: boolean;
            ipi_cst: string | null;
            ipi_aliquot: number | null;
            fiscal_notes: string | null;
            ncm_snapshot: string | null;
            cest_snapshot: string | null;
            origin_snapshot: number | null;
        }> = [];

        for (const item of checked.items) {
            const profile = profileByItem.get(item.itemId);

            if (!profile?.tax_group_id) {
                out.push({
                    clientItemId: item.clientItemId,
                    status: 'no_rule_found',
                    cfop_code: null,
                    cst_icms: null,
                    csosn: null,
                    st_applies: false,
                    st_aliquot: null,
                    pis_cst: null,
                    pis_aliquot: null,
                    cofins_cst: null,
                    cofins_aliquot: null,
                    ipi_applies: false,
                    ipi_cst: null,
                    ipi_aliquot: null,
                    fiscal_notes: 'Produto sem grupo tributário.',
                    ncm_snapshot: profile?.ncm || null,
                    cest_snapshot: profile?.cest || null,
                    origin_snapshot: profile?.origin ?? null
                });
                continue;
            }

            const result = await resolveFiscalRule(supabase, companyId, {
                companyUF: checked.companyUF,
                companyTaxRegime: checked.companyTaxRegime,
                customerUF: checked.customerUF,
                customerType: checked.customerType,
                customerIsFinalConsumer: checked.customerIsFinalConsumer,
                productTaxGroupId: profile.tax_group_id,
                productNCM: profile.ncm,
                productCEST: profile.cest,
                productOrigin: profile.origin
            });

            out.push({
                clientItemId: item.clientItemId,
                status: result.status,
                cfop_code: result.cfop || null,
                cst_icms: result.cst_icms || null,
                csosn: result.csosn || null,
                st_applies: result.st_applies || false,
                st_aliquot: result.st_aliquot || null,
                pis_cst: result.pis_cst || null,
                pis_aliquot: result.pis_aliquot || null,
                cofins_cst: result.cofins_cst || null,
                cofins_aliquot: result.cofins_aliquot || null,
                ipi_applies: result.ipi_applies || false,
                ipi_cst: result.ipi_cst || null,
                ipi_aliquot: result.ipi_aliquot || null,
                fiscal_notes: result.error || null,
                ncm_snapshot: profile?.ncm || null,
                cest_snapshot: profile?.cest || null,
                origin_snapshot: profile?.origin ?? null
            });
        }

        return { success: true, data: out };
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

export async function getSalesFormMetadataAction(companyId: string): Promise<{
    priceTables: any[];
    paymentTerms: any[];
    paymentModes: any[];
}> {
    try {
        await getCompanyId();
        const supabase = await createClient();

        const [priceTables, paymentTerms, paymentModes] = await Promise.all([
            getPriceTables(supabase, companyId),
            getPaymentTerms(supabase, companyId),
            getPaymentModes(supabase, companyId),
        ]);

        return {
            priceTables: Array.isArray(priceTables) ? priceTables : [],
            paymentTerms: Array.isArray(paymentTerms) ? paymentTerms : [],
            paymentModes: Array.isArray(paymentModes) ? paymentModes : [],
        };
    } catch {
        return { priceTables: [], paymentTerms: [], paymentModes: [] };
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

export async function searchSalesProductsAction(params: {
    term: string;
    companyId?: string;
    limit?: number;
}): Promise<Array<{
    id: string;
    name: string;
    sku: string | null;
    uom: string | null;
    avg_cost: number | null;
    net_weight_kg_base: number | null;
    gross_weight_kg_base: number | null;
    fiscal?: {
        tax_group_id?: string | null;
        ncm?: string | null;
        cest?: string | null;
        origin?: number | null;
        cfop_code?: string | null;
    } | null;
}>> {
    try {
        const term = (params.term || '').trim();
        if (term.length < 2) return [];

        const companyId = await getCompanyId(params.companyId, {
            skipMembershipValidation: Boolean(params.companyId),
        });
        const max = Math.min(Math.max(Number(params.limit || 20), 1), 50);
        const preferredSalesTypes = ['finished_good', 'product', 'resale', 'service', 'wip', 'raw_material', 'packaging', 'other'];

        // Prefer service-role client for performance, but fallback to session client if unavailable.
        let supabase: any;
        try {
            supabase = createAdminClient();
        } catch {
            supabase = await createClient();
        }

        const buildQuery = (limit: number, restrictTypes: boolean) => {
            let queryBuilder = supabase
                .from('items')
                .select('id, name, sku, uom, avg_cost, net_weight_kg_base, gross_weight_kg_base, fiscal:item_fiscal_profiles(tax_group_id, ncm, cest, origin, cfop_code)')
                .eq('company_id', companyId)
                .eq('is_active', true)
                .is('deleted_at', null)
                .or(`name.ilike.%${term}%,sku.ilike.%${term}%`)
                .order('name', { ascending: true });

            if (restrictTypes) {
                queryBuilder = queryBuilder.in('type', preferredSalesTypes);
            }

            return queryBuilder.limit(limit);
        };

        let { data, error } = await buildQuery(max, true);
        if (error) {
            console.error('[searchSalesProductsAction] preferred query error:', error.message);
            const fallback = await buildQuery(max, false);
            data = fallback.data;
            error = fallback.error;
        } else if (!data || data.length === 0) {
            const fallback = await buildQuery(max, false);
            if (!fallback.error && fallback.data) {
                data = fallback.data;
            }
        }

        if (error) {
            console.error('[searchSalesProductsAction] fallback query error:', error.message);
            return [];
        }

        return Array.isArray(data)
            ? data.map((row: any) => {
                const rawFiscal = row?.fiscal;
                const fiscal = Array.isArray(rawFiscal) ? (rawFiscal[0] || null) : (rawFiscal || null);
                return { ...row, fiscal };
            })
            : [];
    } catch (e: any) {
        console.error('[searchSalesProductsAction] fatal:', e?.message || e);
        return [];
    }
}

export async function getClientDetailsAction(clientId: string, preferredCompanyId?: string): Promise<any> {
    try {
        const companyId = await getCompanyId(preferredCompanyId, {
            // Called by selectors while user types/selects.
            skipMembershipValidation: Boolean(preferredCompanyId),
        });
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
