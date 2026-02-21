import { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';
import { getSalesDocumentById, recalculateFiscalForOrder } from '@/lib/data/sales-orders';
import { buildDraftFromDb } from '@/lib/fiscal/nfe/offline/mappers';

/**
 * Validates the structural integrity of a sales order.
 * Triggers automatic corrections if discrepancies are found in:
 * - Subtotals and Totals
 * - Installment calculations
 * - Fiscal statuses/taxes
 * - NFe Draft Snapshot
 * - Connected Financial Events
 */
export async function validateOrderIntegrity(supabase: SupabaseClient, orderId: string, companyId: string) {
    logger.info(`[OrderAudit] Starting integrity check for order ${orderId}`);

    // 1. Fetch Order with full details
    const order = await getSalesDocumentById(supabase, orderId);
    if (!order) {
        throw new Error(`Pedido não encontrado: ${orderId}`);
    }

    if (order.status_commercial !== 'confirmed') {
        logger.info(`[OrderAudit] Order is not CONFIRMED (status: ${order.status_commercial}). Skipping deep audit.`);
        return { status: 'skipped', reason: 'Not confirmed' };
    }

    let needsDbUpdate = false;
    let needsNfeSnapshotSync = false;
    let needsPaymentRebuild = false;
    let needsFinancialEventSync = false;
    let hasItemTotalMismatch = false;

    // --- 1. Validate Totals ---
    let calculatedSubtotal = 0;
    for (const item of order.items || []) {
        // Items must also have correct total_amount
        const expectedItemTotal = (item.quantity * item.unit_price) - (item.discount_amount || 0);
        if (Math.abs(expectedItemTotal - item.total_amount) > 0.01) {
            logger.warn(`[OrderAudit] Item ${item.id} total mismatch: DB=${item.total_amount}, Calc=${expectedItemTotal}. Column is generated; using calculated value in-memory.`);
            item.total_amount = expectedItemTotal;
            hasItemTotalMismatch = true;
        }
        calculatedSubtotal += item.total_amount;
    }

    const calculatedTotal = calculatedSubtotal - (order.discount_amount || 0) + (order.freight_amount || 0);

    if (hasItemTotalMismatch || Math.abs(calculatedSubtotal - order.subtotal_amount) > 0.01 || Math.abs(calculatedTotal - order.total_amount) > 0.01) {
        logger.warn(`[OrderAudit] Recalculating totals. Old: Sub=${order.subtotal_amount}, Tot=${order.total_amount}. New: Sub=${calculatedSubtotal}, Tot=${calculatedTotal}`);
        order.subtotal_amount = calculatedSubtotal;
        order.total_amount = calculatedTotal;
        needsDbUpdate = true;
    }

    if (needsDbUpdate) {
        const { error: updateError } = await supabase
            .from('sales_documents')
            .update({
                subtotal_amount: order.subtotal_amount,
                total_amount: order.total_amount
            })
            .eq('id', orderId);

        if (updateError) throw updateError;

        // Re-fetch to guarantee we have fresh joined data
        logger.info(`[OrderAudit] Order totals synced. Recalculating fiscal rules.`);
        const companyRes = await supabase.from('companies').select('settings, document_number, name').eq('id', order.company_id).single();
        const clientRes = await supabase.from('organizations').select('addresses(state), tax_regime, is_final_consumer').eq('id', order.client_id).single();

        if (companyRes.data && clientRes.data) {
            const coUf = companyRes.data.settings?.address?.state || 'SP';
            const coTax = companyRes.data.settings?.tax_regime || 'simples';
            const cliUf = clientRes.data.addresses?.[0]?.state || 'SP';
            const cliType = clientRes.data.tax_regime === 'normal' ? 'contribuinte' : 'nao_contribuinte';

            await recalculateFiscalForOrder(
                supabase, orderId, order.company_id, coUf, coTax, cliUf, cliType, clientRes.data.is_final_consumer
            );
        }
    }

    // --- 2. Validate Payments (Installments) ---
    const payments = order.payments || [];
    const paymentsSum = payments.reduce((sum, p) => sum + p.amount, 0);

    if (Math.abs(paymentsSum - order.total_amount) > 0.01) {
        logger.warn(`[OrderAudit] Installments mismatch: Sum=${paymentsSum}, Total=${order.total_amount}. Auto-correcting.`);
        needsPaymentRebuild = true;

        if (payments.length === 0) {
            await supabase.from('sales_document_payments').insert({
                document_id: orderId,
                installment_number: 1,
                due_date: new Date().toISOString().split('T')[0],
                amount: order.total_amount,
                status: 'pending'
            });
        } else {
            // Apply diff to last payment
            const diff = order.total_amount - paymentsSum;
            const lastPayment = payments[payments.length - 1];
            const newAmount = lastPayment.amount + diff;

            if (newAmount < 0) {
                // Too complex to auto-correct safely by modifying just the last one if it goes negative
                logger.error(`[OrderAudit] Cannot auto-correct payments: amount would be negative. Rewriting all payments to a single one.`);
                await supabase.from('sales_document_payments').delete().eq('document_id', orderId);
                await supabase.from('sales_document_payments').insert({
                    document_id: orderId,
                    installment_number: 1,
                    due_date: lastPayment.due_date || new Date().toISOString().split('T')[0],
                    amount: order.total_amount,
                    status: 'pending'
                });
            } else {
                await supabase.from('sales_document_payments').update({ amount: newAmount }).eq('id', lastPayment.id);
            }
        }
        needsNfeSnapshotSync = true;
        needsFinancialEventSync = true;
    }

    // --- 3. Sync NF Snapshot ---
    // If order totals, items, or payments changed, the mapped NFE representation changed.
    if (needsDbUpdate || needsPaymentRebuild || needsNfeSnapshotSync) {
        logger.info(`[OrderAudit] Syncing NF snapshot`);

        // Need to refetch to get updated items/payments for drafting
        const freshOrder = await getSalesDocumentById(supabase, orderId);
        const { data: companyData } = await supabase.from('companies').select('settings, addresses(*)').eq('id', freshOrder.company_id).single();

        const keyParams = {
            cNF: Math.floor(Math.random() * 99999999).toString().padStart(8, '0'),
            cUF: '35', // Typical fallback, we use 35 heavily 
            serie: '1',
            nNF: String(freshOrder.document_number),
            tpAmb: '2' as const // Draft mostly uses 2 unless forced
        };

        try {
            const draft = buildDraftFromDb({ order: freshOrder, company: companyData, keyParams });

            // Only update draft/error NFe (don't mess with authorized ones!)
            await supabase.from('sales_document_nfes')
                .update({ draft_snapshot: draft })
                .eq('document_id', orderId)
                .in('status', ['draft', 'error', 'processing']);

        } catch (e) {
            logger.error(`[OrderAudit] Failed to sync NFe snapshot: ${e}`);
        }
    }

    // --- 4. Sync Financial Events ---
    // Make sure the financial_event totals and status match
    const { data: events } = await supabase.from('financial_events').select('*').eq('origin_id', orderId);

    if (events && events.length > 0) {
        for (const event of events) {
            if (Math.abs(event.total_amount - order.total_amount) > 0.01) {
                logger.warn(`[OrderAudit] Rebuilding financial events. Event ${event.id} total mismatch (Event=${event.total_amount}, Order=${order.total_amount}).`);
                needsFinancialEventSync = true;

                await supabase.from('financial_events').update({
                    total_amount: order.total_amount
                }).eq('id', event.id);

                // Also rebuild financial event installments
                await supabase.from('financial_event_installments').delete().eq('event_id', event.id);

                const freshOrderForPayments = await getSalesDocumentById(supabase, orderId);
                const eventInstallments = (freshOrderForPayments.payments || []).map((p, idx) => ({
                    event_id: event.id,
                    installment_number: p.installment_number || (idx + 1),
                    due_date: p.due_date,
                    amount: p.amount
                }));

                if (eventInstallments.length > 0) {
                    await supabase.from('financial_event_installments').insert(eventInstallments);
                }
            }
        }
    }

    logger.info(`[OrderAudit] Integrity OK`);
    return { status: 'success', synced: needsDbUpdate || needsPaymentRebuild || needsFinancialEventSync };
}
