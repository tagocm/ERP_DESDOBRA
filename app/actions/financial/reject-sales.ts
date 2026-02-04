'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import { logger } from '@/lib/logger';

interface RejectSalesParams {
    salesDocumentId: string;
    reason: string;
    userId?: string;
    eventId?: string; // ID of the financial_event being rejected
}

export async function rejectSalesFinancial({ salesDocumentId, reason, eventId }: RejectSalesParams) {
    if (!salesDocumentId || !reason) {
        throw new Error('Parâmetros obrigatórios ausentes');
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        throw new Error('Usuário não autenticado');
    }

    const userId = user.id;

    // 1. Get current order status
    const { data: order, error: orderError } = await supabase
        .from('sales_documents')
        .select(`
            id, 
            status_logistic, 
            status_fiscal, 
            status_commercial,
            document_number,
            company_id,
            total_amount
        `)
        .eq('id', salesDocumentId)
        .single();

    if (orderError || !order) {
        throw new Error('Pedido de venda não encontrado');
    }

    const { status_logistic, status_fiscal } = order;

    // Check if it is "Post-Delivery" (Delivered/Returned/Authorized)
    const isPostDelivery =
        ['delivered', 'returned', 'partial'].includes(status_logistic) ||
        status_fiscal === 'authorized';

    const now = new Date().toISOString();

    // --------------------------------------------------------
    // CLOSE ORIGINAL EVENT (If ID provided)
    // --------------------------------------------------------
    if (eventId) {
        await supabase
            .from('financial_events')
            .update({
                status: 'rejected',
                rejected_by: userId,
                rejected_at: now,
                rejection_reason: reason,
                updated_at: now
            })
            .eq('id', eventId);
    }

    if (isPostDelivery) {
        // ============================================================
        // POST-DELIVERY FLOW: "Bomba de Amanhã"
        // ============================================================

        // ... (Existing Post-Delivery Logic) ...
        // Block Financial Titles
        const { data: titles, error: titlesError } = await supabase
            .from('ar_titles')
            .select('id, status')
            .eq('sales_document_id', salesDocumentId);

        if (titlesError) throw titlesError;

        if (titles && titles.length > 0) {
            const { error: updateTitlesError } = await supabase
                .from('ar_titles')
                .update({ status: 'ON_HOLD', updated_at: now })
                .eq('sales_document_id', salesDocumentId);

            if (updateTitlesError) {
                logger.warn('[rejectSalesFinancial] Failed to update titles to ON_HOLD (non-blocking)', {
                    code: updateTitlesError.code,
                    message: updateTitlesError.message
                });
            }
        }

        // Create NEW Audit Event for the "Attention" state
        await supabase
            .from('financial_events')
            .insert({
                origin_id: salesDocumentId,
                origin_type: 'SALE',
                company_id: order.company_id,
                direction: 'AR',
                total_amount: order.total_amount,
                issue_date: now,
                status: 'attention', // Mark as Attention
                rejection_reason: `Rejeição Financeira (Pós-Entrega): ${reason}`,
                rejected_by: userId,
                rejected_at: now,
                attention_marked_by: userId,
                attention_marked_at: now,
                attention_reason: reason,
                operational_status: 'attention'
            });

    } else {
        // ============================================================
        // PRE-DELIVERY FLOW: "Bloqueio Operacional"
        // ============================================================

        const updates = {
            // Block
            dispatch_blocked: true,
            dispatch_blocked_reason: reason,
            dispatch_blocked_at: now,
            dispatch_blocked_by: userId,

            // Revert Operational
            status_logistic: 'pending',
            scheduled_delivery_date: null,

            // Revert Commercial
            status_commercial: 'draft',

            // Update Financial Status
            financial_status: 'in_review',

            updated_at: now
        };

        const { error: updateError } = await supabase
            .from('sales_documents')
            .update(updates)
            .eq('id', salesDocumentId);

        if (updateError) throw updateError;

        // Register Audit
        await supabase
            .from('sales_order_history')
            .insert({
                document_id: salesDocumentId,
                user_id: userId,
                event_type: 'FINANCIAL_REJECTION',
                description: `Bloqueio Financeiro (Pré-Entrega): ${reason}`,
                metadata: { reason, previous_status: status_logistic }
            });
    }

    revalidatePath(`/sales/orders/${salesDocumentId}`);
    revalidatePath('/financeiro/aprovacoes');

    return { success: true };
}
