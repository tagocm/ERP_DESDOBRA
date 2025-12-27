
import { SupabaseClient } from '@supabase/supabase-js';
import { SalesOrder, SalesOrderItem, SalesOrderPayment, SalesOrderNfe, SalesOrderAdjustment, SalesStatus, LogisticStatus, FiscalStatus, DocType } from '@/types/sales';

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
            sales_rep:users!sales_rep_id(full_name)
        `, { count: 'exact' });

    if (filters.docType && filters.docType !== 'all') {
        query = query.eq('doc_type', filters.docType);
    }

    // Generic search: CNPJ, Nome Fantasia, Razão Social, Cidade
    if (filters.search) {
        const searchTerm = filters.search.trim();
        // Normalize CNPJ search (remove formatting)
        const normalizedSearch = searchTerm.replace(/[.\/-]/g, '');

        // Build OR condition for multiple fields
        // Search in: client document (CNPJ), trade_name, legal_name, and addresses city
        query = query.or(`client.document.ilike.%${normalizedSearch}%,client.trade_name.ilike.%${searchTerm}%,client.legal_name.ilike.%${searchTerm}%,client.addresses.city.ilike.%${searchTerm}%`);
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

    if (filters.statusCommercial) query = query.eq('status_commercial', filters.statusCommercial);
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
            items:sales_document_items(*, product:items(name, gtin_ean_base, id, sku, un:uom)),
            payments:sales_document_payments(*),
            adjustments:sales_document_adjustments(*)
        `)
        .eq('id', id)
        .single();

    if (error) throw error;
    return data as SalesOrder;
}

export async function upsertSalesDocument(supabase: SupabaseClient, doc: Partial<SalesOrder>) {
    // Remove joined fields to avoid error
    // IMPORTANT: specific fix to ensure document_number is NEVER sent to DB creates/updates
    // This allows the DB trigger/default to handle sequence generation.
    const { client, sales_rep, items, payments, nfes, history, carrier, adjustments, document_number, ...cleanDoc } = doc;

    // VALIDATION: Block Edit if Fiscal is Authorized (Issued)
    if (cleanDoc.id) {
        const { data: current } = await supabase.from('sales_documents').select('status_fiscal').eq('id', cleanDoc.id).single();
        if (current && current.status_fiscal === 'authorized') {
            throw new Error("ACÃO BLOQUEADA: Pedido faturado (NF-e emitida) não pode ser editado. Use 'Ajustes' se necessário.");
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
    const { product, ...cleanItem } = item;

    // Fix: Remove temp IDs so Supabase generates a real UUID
    if (cleanItem.id && cleanItem.id.startsWith('temp-')) {
        delete cleanItem.id;
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
