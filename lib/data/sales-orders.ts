
import { SupabaseClient } from '@supabase/supabase-js';
import { SalesOrder, SalesOrderItem, SalesOrderPayment, SalesOrderNfe, SalesOrderAdjustment, SalesStatus, LogisticStatus, FiscalStatus, DocType } from '@/types/sales';
import { resolveFiscalRulesForOrder } from './fiscal-engine';

export interface SalesFilters {
    page?: number;
    limit?: number;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
    statusCommercial?: string;
    statusLogistic?: string;
    financialStatus?: string;
    clientId?: string;
    clientSearch?: string;
    docType?: string | 'all';
    routeFilter?: 'all' | 'no_route' | 'with_route';
}

export async function getSalesDocuments(supabase: SupabaseClient, filters: SalesFilters) {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
        .from('sales_documents')
        .select(`
            *,
            client:organizations!client_id(trade_name, document),
            sales_rep:users!sales_rep_id(full_name),
            carrier:organizations!carrier_id(trade_name)
        `, { count: 'exact' });

    if (filters.docType && filters.docType !== 'all') {
        query = query.eq('doc_type', filters.docType);
    }

    // Generic search: CNPJ, Nome Fantasia, Razão Social, ID do Pedido
    if (filters.search) {
        const searchTerm = filters.search.trim();
        const normalizedSearch = searchTerm.replace(/[.\/-]/g, '');

        // 1. Search matching organizations (Clients)
        const { data: matchingClients } = await supabase
            .from('organizations')
            .select('id')
            .or(`trade_name.ilike.%${searchTerm}%,legal_name.ilike.%${searchTerm}%,document.ilike.%${normalizedSearch}%`);

        const clientIds = matchingClients?.map(c => c.id) || [];
        const orConditions: string[] = [];

        // Condition A: Client match
        if (clientIds.length > 0) {
            orConditions.push(`client_id.in.(${clientIds.join(',')})`);
        }

        // Condition B: Order Number match (if numeric)
        if (!isNaN(Number(searchTerm))) {
            orConditions.push(`document_number.eq.${searchTerm}`);
        }

        if (orConditions.length > 0) {
            query = query.or(orConditions.join(','));
        } else {
            // No results found
            // Force return empty by filtering on a non-existent ID (assuming UUID)
            query = query.eq('id', '00000000-0000-0000-0000-000000000000');
        }
    }

    if (filters.clientId) {
        query = query.eq('client_id', filters.clientId);
    }

    // Client search by name (separate filter field)
    if (filters.clientSearch) {
        query = query.or(`client.trade_name.ilike.%${filters.clientSearch}%`);
    }

    if (filters.dateFrom) query = query.gte('date_issued', filters.dateFrom);
    if (filters.dateTo) query = query.lte('date_issued', filters.dateTo);

    if (filters.statusCommercial) {
        query = query.eq('status_commercial', filters.statusCommercial);
    }

    if (filters.statusLogistic) query = query.eq('status_logistic', filters.statusLogistic);
    if (filters.financialStatus) query = query.eq('financial_status', filters.financialStatus);

    // Route filter
    if (filters.routeFilter && filters.routeFilter !== 'all') {
        if (filters.routeFilter === 'no_route') {
            // Orders not in any route
            const { data: ordersInRoutes } = await supabase
                .from('delivery_route_orders')
                .select('sales_document_id');

            if (ordersInRoutes && ordersInRoutes.length > 0) {
                const routedIds = ordersInRoutes.map(r => r.sales_document_id);
                query = query.not('id', 'in', `(${routedIds.join(',')})`);
            }
        } else if (filters.routeFilter === 'with_route') {
            // Orders in route
            const { data: ordersInRoutes } = await supabase
                .from('delivery_route_orders')
                .select('sales_document_id');

            if (ordersInRoutes && ordersInRoutes.length > 0) {
                const routedIds = ordersInRoutes.map(r => r.sales_document_id);
                query = query.in('id', routedIds);
            }
        }
    }

    // Default: Hide soft deleted
    query = query.is('deleted_at', null);

    query = query.order('created_at', { ascending: false }).range(from, to);

    const { data, count, error } = await query;

    if (error) throw error;

    return { data: data as SalesOrder[], count };
}

export async function getSalesDocumentById(supabase: SupabaseClient, id: string) {
    const { data, error } = await supabase
        .from('sales_documents')
        .select(`
            *,
            client:organizations!client_id(trade_name, document, sales_channel, payment_terms_id),
            sales_rep:users!sales_rep_id(full_name),
            items:sales_document_items(*, packaging:item_packaging(label), product:items(name, gtin_ean_base, id, sku, un:uom, net_weight_g_base, gross_weight_g_base, packagings:item_packaging(*))),
            payments:sales_document_payments(*),
            adjustments:sales_document_adjustments(*),
            route_info:delivery_route_orders(
                route:delivery_routes(scheduled_date)
            )
        `)
        .eq('id', id)
        .single();

    if (error) throw error;

    const order = data as any;
    // Fallback for scheduled_delivery_date if it's null on the document but exists on the route
    if (!order.scheduled_delivery_date && order.route_info?.[0]?.route?.scheduled_date) {
        order.scheduled_delivery_date = order.route_info[0].route.scheduled_date;
    }

    return order as SalesOrder;
}

export async function upsertSalesDocument(supabase: SupabaseClient, doc: Partial<SalesOrder>) {
    // Remove joined fields to avoid error
    // IMPORTANT: specific fix to ensure document_number is NEVER sent to DB creates/updates
    // This allows the DB trigger/default to handle sequence generation.
    const { client, sales_rep, items, payments, nfes, history, carrier, adjustments, document_number, ...rawDoc } = doc;

    // Sanitize Foreign Keys: Convert empty strings to null to avoid UUID errors
    const cleanDoc = { ...rawDoc };
    if (cleanDoc.payment_mode_id === '') cleanDoc.payment_mode_id = null;
    if (cleanDoc.payment_terms_id === '') cleanDoc.payment_terms_id = null;
    if (cleanDoc.price_table_id === '') cleanDoc.price_table_id = null;

    // VALIDATION: Block Edit if locked statuses are met (Fiscal Authorized or Logistic In Route/Finalized)
    if (cleanDoc.id) {
        const { data: current } = await supabase
            .from('sales_documents')
            .select('status_fiscal, status_logistic')
            .eq('id', cleanDoc.id)
            .single();

        if (current) {
            if (current.status_fiscal === 'authorized') {
                throw new Error("AÇÃO BLOQUEADA: Pedido faturado (NF-e emitida) não pode ser editado.");
            }

            const lockedLogistics = ['em_rota', 'entregue', 'nao_entregue'];
            if (lockedLogistics.includes(current.status_logistic)) {
                throw new Error(`AÇÃO BLOQUEADA: Pedido com status logístico '${current.status_logistic.replace('_', ' ').toUpperCase()}' não pode ser alterado.`);
            }
        }
    }

    const { data, error } = await supabase
        .from('sales_documents')
        .upsert(cleanDoc)
        .select()
        .single();

    if (error) throw error;
    return data as SalesOrder;
}

export async function upsertSalesItem(supabase: SupabaseClient, item: Partial<SalesOrderItem>) {
    // Remove frontend-only fields or joins
    const { product, unit_weight_kg, gross_weight_kg_snapshot, ...cleanItem } = item;

    // Fix: Remove temp IDs so Supabase generates a real UUID
    if (cleanItem.id && cleanItem.id.startsWith('temp-')) {
        delete cleanItem.id;
    }

    // Fallback: Populate qty_base with quantity if missing (for legacy or simple items)
    if (cleanItem.qty_base === undefined && cleanItem.quantity !== undefined) {
        cleanItem.qty_base = cleanItem.quantity;
    }

    const { data, error } = await supabase
        .from('sales_document_items')
        .upsert(cleanItem)
        .select()
        .single();
    if (error) throw error;
    return data as SalesOrderItem;
}

export async function deleteSalesItem(supabase: SupabaseClient, id: string) {
    const { error } = await supabase
        .from('sales_document_items')
        .delete()
        .eq('id', id);
    if (error) throw error;
}

export async function upsertSalesPayment(supabase: SupabaseClient, payment: Partial<SalesOrderPayment>) {
    const { data, error } = await supabase
        .from('sales_document_payments')
        .upsert(payment)
        .select()
        .single();
    if (error) throw error;
    return data as SalesOrderPayment;
}

export async function deleteSalesPayment(supabase: SupabaseClient, id: string) {
    const { error } = await supabase
        .from('sales_document_payments')
        .delete()
        .eq('id', id);
    if (error) throw error;
}

export async function createSalesAdjustment(supabase: SupabaseClient, adjustment: Partial<SalesOrderAdjustment>) {
    const { data, error } = await supabase
        .from('sales_document_adjustments')
        .insert(adjustment)
        .select()
        .single();

    if (error) throw error;
    return data as SalesOrderAdjustment;
}

export async function softDeleteSalesOrder(supabase: SupabaseClient, id: string, userId: string, reason: string) {
    // 1. Mark as deleted
    const { error } = await supabase
        .from('sales_documents')
        .update({
            deleted_at: new Date().toISOString(),
            deleted_by: userId,
            delete_reason: reason,
            status_commercial: 'cancelled' // Optional: also mark sub-status as cancelled?
        })
        .eq('id', id);

    if (error) throw error;

    // 2. Log History
    await supabase.from('sales_document_history').insert({
        document_id: id,
        user_id: userId,
        event_type: 'archived',
        description: `Pedido arquivado/excluído. Motivo: ${reason}`,
        metadata: { reason }
    });
}

export async function updateOrderItemFulfillment(supabase: SupabaseClient, itemId: string, qtyFulfilled: number) {
    const { data, error } = await supabase
        .from('sales_document_items')
        .update({ qty_fulfilled: qtyFulfilled })
        .eq('id', itemId)
        .select()
        .single();

    if (error) throw error;
    return data;
}

// --- Status Actions ---

export async function confirmOrder(supabase: SupabaseClient, id: string, userId: string) {
    // 1. Update Status
    const { error } = await supabase
        .from('sales_documents')
        .update({ status_commercial: 'confirmed' })
        .eq('id', id);

    if (error) throw error;

    // 2. Log History
    await supabase.from('sales_document_history').insert({
        document_id: id,
        user_id: userId,
        event_type: 'status_change',
        description: 'Pedido confirmado comercialmente.',
        metadata: { old: 'draft', new: 'confirmed' }
    });
}

export async function cancelOrder(supabase: SupabaseClient, id: string, userId: string, reason: string) {
    const { error } = await supabase
        .from('sales_documents')
        .update({ status_commercial: 'cancelled' })
        .eq('id', id);

    if (error) throw error;

    await supabase.from('sales_document_history').insert({
        document_id: id,
        user_id: userId,
        event_type: 'status_change',
        description: `Pedido cancelado. Motivo: ${reason}`,
        metadata: { new: 'cancelled', reason }
    });
}

export async function dispatchOrder(supabase: SupabaseClient, id: string, userId: string) {
    const { error } = await supabase
        .from('sales_documents')
        .update({ status_logistic: 'expedition' }) // or 'dispatched' depending on enum, let's assume expedition first
        .eq('id', id);

    if (error) throw error;

    await supabase.from('sales_document_history').insert({
        document_id: id,
        user_id: userId,
        event_type: 'logistic_change',
        description: 'Pedido enviado para expedição.',
        metadata: { new: 'expedition' }
    });
}


// --- Mock NFe ---
export async function emitNfeMock(supabase: SupabaseClient, orderId: string, userId: string, isAntecipada: boolean, details: string) {
    // 1. Create NFe record
    const { data: nfe, error } = await supabase
        .from('sales_document_nfes')
        .insert({
            document_id: orderId,
            status: 'authorized',
            nfe_number: Math.floor(Math.random() * 10000),
            nfe_series: 1,
            nfe_key: '35230000000000000000000000000000000000000000',
            is_antecipada: isAntecipada,
            details: details
        })
        .select()
        .single();

    if (error) throw error;

    // 2. Update Order Fiscal Status
    await supabase
        .from('sales_documents')
        .update({ status_fiscal: 'authorized' })
        .eq('id', orderId);

    // 3. Log
    await supabase.from('sales_document_history').insert({
        document_id: orderId,
        user_id: userId,
        event_type: 'nfe_issued',
        description: `NF-e emitida (${isAntecipada ? 'Antecipada' : 'Normal'}).`,
        metadata: { nfe_id: nfe.id }
    });

    return nfe;
}

export async function getLastOrderForClient(supabase: SupabaseClient, clientId: string) {
    // First, get the last order
    const { data: order, error: orderError } = await supabase
        .from('sales_documents')
        .select('*')
        .eq('client_id', clientId)
        .eq('doc_type', 'order')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (orderError) {
        console.error('Error fetching last order:', orderError);
        throw orderError;
    }

    if (!order) {
        return null;
    }

    // Then get the items for that order
    const { data: items, error: itemsError } = await supabase
        .from('sales_document_items')
        .select(`
            *,
            product:items(id, name, un:uom, sku)
        `)
        .eq('document_id', order.id);

    if (itemsError) {
        console.error('Error fetching order items:', itemsError);
        // Don't throw, just return order without items
        return { ...order, items: [] };
    }

    return { ...order, items: items || [] };
}

/**
 * Recalculate fiscal rules for all items in an order
 * Should be called when: customer changes, company changes, items change
 */
export async function recalculateFiscalForOrder(
    supabase: SupabaseClient,
    orderId: string,
    companyId: string,
    companyUF: string,
    companyTaxRegime: 'simples' | 'normal',
    customerUF: string,
    customerType: 'contribuinte' | 'isento' | 'nao_contribuinte',
    customerIsFinalConsumer: boolean
) {
    // Fetch order items with product fiscal data
    const { data: items, error } = await supabase
        .from('sales_document_items')
        .select(`
            *,
            product:items!inner(
                id,
                name,
                fiscal:item_fiscal_profiles!inner(
                    tax_group_id,
                    ncm,
                    cest,
                    origin
                )
            )
        `)
        .eq('document_id', orderId);

    if (error || !items || items.length === 0) {
        console.error('Error fetching items for fiscal recalc:', error);
        return;
    }

    // Prepare items for fiscal resolution
    const itemsForResolution = items.map(item => ({
        itemId: item.id,
        taxGroupId: (item.product as any)?.fiscal?.tax_group_id || '',
        ncm: (item.product as any)?.fiscal?.ncm,
        cest: (item.product as any)?.fiscal?.cest,
        origin: (item.product as any)?.fiscal?.origin,
        unitPrice: item.unit_price,
        quantity: item.quantity
    }));

    // Resolve fiscal rules
    const results = await resolveFiscalRulesForOrder(
        supabase,
        companyId,
        companyUF,
        companyTaxRegime,
        customerUF,
        customerType,
        customerIsFinalConsumer,
        itemsForResolution
    );

    // Update each item with fiscal data
    for (const item of items) {
        const fiscalResult = results.get(item.id);
        if (!fiscalResult) continue;

        const updatePayload: Partial<SalesOrderItem> = {
            fiscal_status: fiscalResult.status === 'error' ? 'pending' : fiscalResult.status,
            fiscal_operation_id: fiscalResult.operation?.id || null,
            cfop_code: fiscalResult.cfop || null,
            cst_icms: fiscalResult.cst_icms || null,
            csosn: fiscalResult.csosn || null,
            st_applies: fiscalResult.st_applies || false,
            st_aliquot: fiscalResult.st_aliquot || null,
            pis_cst: fiscalResult.pis_cst || null,
            pis_aliquot: fiscalResult.pis_aliquot || null,
            cofins_cst: fiscalResult.cofins_cst || null,
            cofins_aliquot: fiscalResult.cofins_aliquot || null,
            ipi_applies: fiscalResult.ipi_applies || false,
            ipi_cst: fiscalResult.ipi_cst || null,
            ipi_aliquot: fiscalResult.ipi_aliquot || null,
            fiscal_notes: fiscalResult.error || null,
            // Snapshots - use the data we already fetched
            ncm_snapshot: (item.product as any)?.fiscal?.ncm || null,
            cest_snapshot: (item.product as any)?.fiscal?.cest || null,
            origin_snapshot: (item.product as any)?.fiscal?.origin !== undefined ? (item.product as any)?.fiscal?.origin : null
        };

        const { error: updateError } = await supabase
            .from('sales_document_items')
            .update(updatePayload)
            .eq('id', item.id);

        if (updateError) {
            console.error('Error updating item fiscal data:', updateError, 'Payload:', updatePayload);
        }
    }
}

// Helper to get fresh totals from DB
export async function getSalesOrderTotals(supabase: SupabaseClient, id: string) {
    const { data, error } = await supabase
        .from('sales_documents')
        .select('total_amount, subtotal_amount, discount_amount, freight_amount, total_weight_kg, total_gross_weight_kg')
        .eq('id', id)
        .single();
    if (error) throw error;
    return data;
}

// RPC: Cleanup old drafts
export async function cleanupUserDrafts(supabase: SupabaseClient, companyId: string, userId: string, excludeId?: string) {
    const { error } = await supabase.rpc('cleanup_user_drafts', {
        p_company_id: companyId,
        p_user_id: userId,
        p_exclude_id: excludeId || null
    });
    if (error) throw error;
}
