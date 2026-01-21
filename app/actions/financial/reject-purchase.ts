'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

interface RejectPurchaseParams {
    purchaseOrderId: string;
    reason: string;
    userId?: string;
    eventId?: string;
}

export async function rejectPurchaseFinancial({ purchaseOrderId, reason, eventId }: RejectPurchaseParams) {
    if (!purchaseOrderId || !reason) {
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
        .from('purchase_orders')
        .select(`
            id, 
            status,
            document_number,
            company_id
        `)
        .eq('id', purchaseOrderId)
        .single();

    if (orderError || !order) {
        throw new Error('Pedido de compra não encontrado');
    }

    const { status } = order;

    // Check if "Post-Receipt"
    const isReceived = status === 'received';
    const now = new Date().toISOString();

    // --------------------------------------------------------
    // CLOSE ORIGINAL EVENT (If ID provided)
    // --------------------------------------------------------
    if (eventId) {
        await supabase
            .from('financial_events')
            .update({
                status: 'reprovado',
                rejected_by: userId,
                rejected_at: now,
                rejection_reason: reason,
                updated_at: now
            })
            .eq('id', eventId);
    }

    if (isReceived) {
        // ============================================================
        // POST-RECEIPT FLOW: "Bomba de Amanhã"
        // ============================================================

        // Block Financial Titles (AP Titles) -> ON_HOLD
        const { data: titles, error: titlesError } = await supabase
            .from('ap_titles')
            .select('id, status')
            .eq('purchase_order_id', purchaseOrderId);

        if (titlesError) throw titlesError;

        if (titles && titles.length > 0) {
            const { error: updateTitlesError } = await supabase
                .from('ap_titles')
                .update({ status: 'ON_HOLD', updated_at: now })
                .eq('purchase_order_id', purchaseOrderId);

            if (updateTitlesError) {
                console.error('Error updating AP titles to ON_HOLD', updateTitlesError);
                // Log but continue
            }
        }

        // New Audit Event for Attention
        await supabase
            .from('financial_events')
            .insert({
                origin_id: purchaseOrderId,
                origin_type: 'PURCHASE',
                company_id: order.company_id,
                direction: 'AP',
                status: 'em_atencao',
                issue_date: now,
                rejection_reason: `Rejeição Financeira (Pós-Recebimento): ${reason}`,
                rejected_by: userId,
                rejected_at: now,
                attention_marked_by: userId,
                attention_marked_at: now,
                attention_reason: reason,
                operational_status: 'EM_ATENCAO'
            });

    } else {
        // ============================================================
        // PRE-RECEIPT FLOW: "Bloqueio Operacional"
        // ============================================================

        const updates = {
            receiving_blocked: true,
            receiving_blocked_reason: reason,
            receiving_blocked_at: now,
            receiving_blocked_by: userId,
            updated_at: now
        };

        const { error: updateError } = await supabase
            .from('purchase_orders')
            .update(updates)
            .eq('id', purchaseOrderId);

        if (updateError) throw updateError;
    }

    revalidatePath(`/purchases/${purchaseOrderId}`);
    revalidatePath('/financeiro/aprovacoes');

    return { success: true };
}
