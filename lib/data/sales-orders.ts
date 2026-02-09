
import { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';
import { SalesOrder, SalesOrderItem, SalesOrderPayment, SalesOrderNfe, SalesOrderAdjustment, SalesStatus, LogisticStatus, FiscalStatus, DocType } from '@/types/sales';
import { resolveFiscalRulesForOrder } from './fiscal-engine';

import { SalesFilters } from '@/lib/types/sales-dto';

export type { SalesFilters };


export async function getSalesDocuments(supabase: SupabaseClient, filters: SalesFilters) {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
        .from('sales_documents')
        .select(`
            *,
            client:organizations!client_id(trade_name, document_number),
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
            .or(`trade_name.ilike.%${searchTerm}%,legal_name.ilike.%${searchTerm}%,document_number.ilike.%${normalizedSearch}%`);

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
    } else {
        // Default: Hide 'draft' Orders, but show Proposals (Orçamentos)
        // Logic: (doc_type = proposal) OR (status_commercial != draft)
        query = query.or('doc_type.eq.proposal,status_commercial.neq.draft');
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

    // Always hide soft deleted (archive functionality removed)
    query = query.is('deleted_at', null);

    // Filter cancelled unless showCancelled is true
    if (!filters.showCancelled) {
        query = query.neq('status_commercial', 'cancelled');
    }

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
            client:organizations!client_id(trade_name, document_number, sales_channel, payment_terms_id),
            sales_rep:users!sales_rep_id(full_name),
            items:sales_document_items(*, packaging:item_packaging(label), product:items!fk_sales_item_product(name, gtin_ean_base, id, sku, un:uom, net_weight_kg_base, gross_weight_kg_base)),
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

    // Manual Fetch Packagings (Fix for missing embedding)
    if (order.items && order.items.length > 0) {
        const productIds = Array.from(new Set(order.items.map((i: any) => i.product?.id).filter(Boolean)));

        if (productIds.length > 0) {
            const { data: packagings } = await supabase
                .from('item_packaging')
                .select('*')
                .in('item_id', productIds)
                .is('deleted_at', null);

            if (packagings) {
                // Map packagings to products
                const pkgMap = new Map<string, any[]>();
                packagings.forEach((p: any) => {
                    const current = pkgMap.get(p.item_id) || [];
                    current.push(p);
                    pkgMap.set(p.item_id, current);
                });

                // Attach to items
                order.items.forEach((item: any) => {
                    if (item.product) {
                        item.product.packagings = pkgMap.get(item.product.id) || [];
                    }
                });
            }
        }
    }

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
    // Also removing 'freight_mode' and 'route_tag' temporarily until migration is applied
    const { client, sales_rep, items, payments, nfes, history, carrier, adjustments, document_number, route_info, freight_mode, route_tag, ...rawDoc } = doc as any;

    // Sanitize Foreign Keys: Convert empty strings to null to avoid UUID errors
    const cleanDoc = { ...rawDoc };
    if (cleanDoc.payment_mode_id === '') cleanDoc.payment_mode_id = null;
    if (cleanDoc.payment_terms_id === '') cleanDoc.payment_terms_id = null;
    if (cleanDoc.price_table_id === '') cleanDoc.price_table_id = null;

    // Ensure Defaults (Backend Safety)
    if (!cleanDoc.financial_status) cleanDoc.financial_status = 'pending';


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

            const lockedLogistics = ['in_route', 'delivered', 'not_delivered'];
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
    logger.debug('[upsertSalesItem] called', {
        id: item.id,
        packaging_id: item.packaging_id,
        has_snapshot: !!item.sales_uom_abbrev_snapshot
    });

    // Remove frontend-only fields or joins
    const { product, packaging, unit_weight_kg, gross_weight_kg_snapshot, ...cleanItem } = item as any;

    // Fix: Remove temp IDs so Supabase generates a real UUID
    if (cleanItem.id && cleanItem.id.startsWith('temp-')) {
        delete cleanItem.id;
    }

    // Fallback: Populate qty_base with quantity if missing (for legacy or simple items)
    if (cleanItem.qty_base === undefined && cleanItem.quantity !== undefined) {
        cleanItem.qty_base = cleanItem.quantity;
    }

    // Populate NFe description snapshots for packaging integrity
    logger.debug('[NFe Snapshot] condition', {
        has_packaging: !!cleanItem.packaging_id,
        has_snapshot: !!cleanItem.sales_uom_abbrev_snapshot,
        should_populate: !!(cleanItem.packaging_id && !cleanItem.sales_uom_abbrev_snapshot)
    });

    if (cleanItem.packaging_id && !cleanItem.sales_uom_abbrev_snapshot) {
        logger.debug('[NFe Snapshot] populate start', { packaging_id: cleanItem.packaging_id });
        try {
            // Fetch packaging data (WITHOUT UOM join - causes multi-relationship error)
            const { data: packaging, error: pkgError } = await supabase
                .from('item_packaging')
                .select('qty_in_base, label, type')
                .eq('id', cleanItem.packaging_id)
                .single();

            if (pkgError) {
                logger.warn('[NFe Snapshot] packaging fetch error', { message: pkgError.message, code: pkgError.code });
                throw pkgError;
            }

            logger.debug('[NFe Snapshot] packaging fetched', {
                has_packaging: !!packaging,
                type: packaging?.type,
                qty_in_base: packaging?.qty_in_base,
            });
            if (packaging) {
                // Derive sales UOM from packaging type (no need for UOM table join)
                const salesUomAbbrev = deriveUomFromPackagingType(packaging.type);

                // Fetch base product UOM (also without join)
                const { data: item, error: itemError } = await supabase
                    .from('items')
                    .select('uom')
                    .eq('id', cleanItem.item_id)
                    .single();

                if (itemError) {
                    logger.warn('[NFe Snapshot] item fetch error', { message: itemError.message, code: itemError.code });
                    throw itemError;
                }

                logger.debug('[NFe Snapshot] item UOM fetched', { uom: item?.uom });
                if (item) {
                    const baseUomAbbrev = item.uom || 'UN';

                    // Populate snapshots
                    cleanItem.sales_uom_abbrev_snapshot = salesUomAbbrev;
                    cleanItem.base_uom_abbrev_snapshot = baseUomAbbrev;
                    cleanItem.conversion_factor_snapshot = packaging.qty_in_base;

                    // Build short label: "CX 12xPC"
                    cleanItem.sales_unit_label_snapshot =
                        `${salesUomAbbrev} ${packaging.qty_in_base}x${baseUomAbbrev}`;
                    logger.debug('[NFe Snapshot] populated', { sales_unit_label_snapshot: cleanItem.sales_unit_label_snapshot });
                }
            }
        } catch (err) {
            // Non-critical: snapshots are optional, don't fail the save
            logger.warn('[NFe Snapshot] populate failed', { message: err instanceof Error ? err.message : String(err) });
        }
    }

    const { data, error } = await supabase
        .from('sales_document_items')
        .upsert(cleanItem)
        .select()
        .single();
    if (error) throw error;
    return data as SalesOrderItem;
}

/**
 * Derives UOM abbreviation from packaging type (fallback)
 */
function deriveUomFromPackagingType(type: string | null): string {
    if (!type) return 'UN';

    switch (type.toUpperCase()) {
        case 'BOX': return 'CX';
        case 'PACK': return 'PC';
        case 'BALE': return 'FD';
        case 'PALLET': return 'PL';
        case 'OTHER': return 'UN';
        default: return 'UN';
    }
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

export async function cancelSalesDocument(supabase: SupabaseClient, id: string, userId: string, reason: string) {
    // 1. Check status (Safety)
    const { data: order } = await supabase.from('sales_documents').select('status_logistic').eq('id', id).single();
    if (order) {
        const lockedLogistics = ['in_route', 'delivered', 'not_delivered', 'expedition'];
        if (lockedLogistics.includes(order.status_logistic)) {
            throw new Error(`AÇÃO BLOQUEADA: Pedido com status logístico '${order.status_logistic}' não pode ser cancelado.`);
        }
    }

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

export async function archiveSalesDocument(supabase: SupabaseClient, id: string, userId: string, reason: string) {
    // 1. Check status (Safety)
    const { data: order } = await supabase.from('sales_documents').select('status_logistic').eq('id', id).single();
    if (order) {
        const lockedLogistics = ['in_route', 'delivered', 'not_delivered', 'expedition'];
        if (lockedLogistics.includes(order.status_logistic)) {
            throw new Error(`AÇÃO BLOQUEADA: Pedido com status logístico '${order.status_logistic}' não pode ser arquivado.`);
        }
    }

    // 2. Mark as deleted
    const { error } = await supabase
        .from('sales_documents')
        .update({
            deleted_at: new Date().toISOString(),
            deleted_by: userId,
            delete_reason: reason,
            status_commercial: 'cancelled' // Ensuring consistency
        })
        .eq('id', id);

    if (error) throw error;

    // 3. Log History
    await supabase.from('sales_document_history').insert({
        document_id: id,
        user_id: userId,
        event_type: 'archived',
        description: `Pedido arquivado/excluído. Motivo: ${reason}`,
        metadata: { reason }
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
        logger.error('[getLastOrderForClient] fetch last order failed', { message: orderError.message, code: orderError.code });
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
            product:items!fk_sales_item_product(id, name, un:uom, sku)
        `)
        .eq('document_id', order.id);

    if (itemsError) {
        logger.warn('[getLastOrderForClient] fetch order items failed', { message: itemsError.message, code: itemsError.code });
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
            packaging:item_packaging(gross_weight_kg, net_weight_kg),
            product:items!fk_sales_item_product!inner(
                id,
                name,
                net_weight_kg_base,
                gross_weight_kg_base,
                net_weight_g_base,
                gross_weight_g_base,
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
        if (error) {
            logger.warn('[recalculateFiscalForOrder] fetch items failed', { message: error.message, code: error.code });
        }
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

        // EXPLICIT WEIGHT RECALCULATION
        // Ensure we don't zero out weights during fiscal update
        const product = item.product as any;
        const qty = Number(item.quantity) || 0;

        let unitWeight = 0;

        if (item.packaging_id) {
            const pkg = (item as any).packaging;
            if (pkg) {
                // Prioritize gross, then net
                unitWeight = Number(pkg.gross_weight_kg) || Number(pkg.net_weight_kg) || 0;
            }
            // Fallback to existing or product base
            if (unitWeight === 0) unitWeight = Number(item.unit_weight_kg) || 0;
        } else {
            // Base Product Logic
            const grossKg = Number(product.gross_weight_kg_base);
            const grossG = Number(product.gross_weight_g_base);
            const netKg = Number(product.net_weight_kg_base);
            const netG = Number(product.net_weight_g_base);
            if (!isNaN(grossKg) && grossKg > 0) unitWeight = grossKg;
            else if (!isNaN(grossG) && grossG > 0) unitWeight = grossG / 1000.0;
            else if (!isNaN(netKg) && netKg > 0) unitWeight = netKg;
            else if (!isNaN(netG) && netG > 0) unitWeight = netG / 1000.0;
        }

        if (unitWeight > 0) {
            (updatePayload as any).unit_weight_kg = unitWeight;
            (updatePayload as any).total_weight_kg = Number((unitWeight * qty).toFixed(3));
        }

        // Actually, the user said "when the client updates fiscal data". 
        // This likely calls `recalculateFiscalForOrder`.

        // Let's look at `updatePayload` again.
        /*
            const updatePayload = {
             fiscal_status: fiscalResult.status,
             fiscal_operation_id: fiscalResult.operation?.id || null,
             cfop_code: fiscalResult.cfop || null,
             cst_icms: fiscalResult.cst_icms || null,
             ...
             ncm_snapshot: ...,
             ...
            }
        */
        // This looks correct (Patch).

        // WAIT! Migration 20260104248000_ensure_sales_items_columns.sql or similar might have added NOT NULL constraints or defaults?

        // Another possibility: The trigger that updates the PARENT total sums up items.
        // If `recalculateFiscalForOrder` updates items one by one in a loop:
        //   for (const item of items) { update(...) }
        // It fires the trigger N times.

        // If the item data being read in the trigger is somehow incomplete...
        // The trigger reads from `sales_document_items` table directly.

        // START OF FIX:
        // Let's fetch the EXISTING weight-related columns for the item and include them in the payload just to be safe?
        // No, that's redundant if Patch works.

        // Maybe the issue is simpler: The `recalculateFiscalForOrder` does NOT fetch weight info in its select:
        /*
            .select(`
                 *,
                 product:items!inner(...)
            `)
        */
        // `*` fetches all columns of `sales_document_items`.
        // So `item` variable has `qty_base`, `quantity`, etc.

        // Let's sanity check if `recalculateFiscalForOrder` is overwriting with defaults.
        // No.

        // Let's check `resolveFiscalRule` - maybe it errors out and we write error status?

        // NEW CLUE: "o peso é para aparecer em pedidos que ja foram lançados?" -> "Continua zerado" -> "Quando atualiza os dados fiscais, ele zera".
        // This strongly suggests an interaction between the fiscal update mechanism and the weight columns.

        // In `20260105180000_backfill_order_weights.sql`, we used `SUM(...)`.

        // Let's look at `trigger_update_weights` in `20260105151000...` or whichever is latest.
        // I can't see the trigger code here, but I recall it sums `net_weight_kg_base * qty_base`.
        // Those columns in `sales_document_items` are NOT being touched by this update.

        // Wait! `recalculateFiscalForOrder` is ONLY updating `sales_document_items`.
        // Is it possible that `sales_document_items` DOES NOT HAVE `net_weight_kg_base` stored?
        // Weights are on the `items` (products) table mostly, but we might have cached them or used them in the view?
        // The migration for backfill joined `items`.

        // IF the trigger relies on columns in `sales_document_items` that are actually NULL (because weights are in `items` table),
        // then the trigger computes 0.
        // BUT, the trigger should join `items`?

        // Let's verify the trigger definition. I'll read the latest trigger migration.
        // `20260104223000_fix_weight_trigger.sql`

        // I will read that migration file now.
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

export async function deleteSalesDocument(supabase: SupabaseClient, id: string) {
    // 1. Verify Status
    const { data: current, error: fetchError } = await supabase
        .from('sales_documents')
        .select('status_commercial, doc_type')
        .eq('id', id)
        .single();

    if (fetchError) throw fetchError;
    if (!current) throw new Error("Pedido não encontrado.");

    // ALLOW: 'draft', 'budget' OR doc_type='proposal'
    const allowedStatuses = ['draft', 'budget'];
    const isAllowed = allowedStatuses.includes(current.status_commercial) || current.doc_type === 'proposal';

    if (!isAllowed) {
        throw new Error("Apenas Rascunhos ou Orçamentos podem ser excluídos permanentemente. Pedidos Confirmados devem ser cancelados.");
    }

    // 2. Perform Hard Delete
    const { error: deleteError } = await supabase
        .from('sales_documents')
        .delete()
        .eq('id', id);

    if (deleteError) throw deleteError;
    return true;
}
