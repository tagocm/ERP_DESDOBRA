'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

interface ResendSalesParams {
    salesDocumentId: string;
    userNote?: string;
}

interface ResendSalesResult {
    success: boolean;
    data?: {
        eventId: string;
        documentNumber: string;
    };
    error?: string;
}

/**
 * Resends a rejected/blocked sales order for financial approval
 * 
 * This action is the official path for re-submitting orders that were
 * rejected by finance. It:
 * - Clears dispatch blocks and rejection flags
 * - Resets the order to confirmed status
 * - Resets the financial event to pending (via trigger)
 * - Records the resubmission in audit history
 * 
 * @param salesDocumentId - ID of the sales document to resend
 * @param userNote - Optional note explaining corrections made
 */
export async function resendSalesForApproval({
    salesDocumentId,
    userNote
}: ResendSalesParams): Promise<ResendSalesResult> {
    if (!salesDocumentId) {
        return { success: false, error: 'ID do pedido é obrigatório' };
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { success: false, error: 'Usuário não autenticado' };
    }

    const userId = user.id;

    try {
        // 1. Get current order status and validate eligibility
        const { data: order, error: orderError } = await supabase
            .from('sales_documents')
            .select(`
                id,
                document_number,
                status_commercial,
                status_logistic,
                status_fiscal,
                dispatch_blocked,
                dispatch_blocked_reason,
                financial_status,
                total_amount,
                company_id
            `)
            .eq('id', salesDocumentId)
            .single();

        if (orderError || !order) {
            return { success: false, error: 'Pedido não encontrado' };
        }

        // 2. Validate order is in valid state for resubmission
        const { status_logistic, status_fiscal, dispatch_blocked, financial_status } = order;

        // Check if order is pre-delivery (not yet delivered/returned)
        const isPostDelivery =
            ['delivered', 'returned', 'partial'].includes(status_logistic) ||
            status_fiscal === 'authorized';

        if (isPostDelivery) {
            return {
                success: false,
                error: 'Pedido já foi entregue ou fiscalizado. Não pode ser reenviado para aprovação.'
            };
        }

        // Check if order is actually blocked or in review
        if (!dispatch_blocked && financial_status !== 'in_review') {
            return {
                success: false,
                error: 'Pedido não está bloqueado ou em revisão financeira. Use a confirmação normal.'
            };
        }

        const now = new Date().toISOString();

        // 3. Clear blocks and reset order to confirmed state
        const { error: updateOrderError } = await supabase
            .from('sales_documents')
            .update({
                status_commercial: 'confirmed',
                dispatch_blocked: false,
                dispatch_blocked_reason: null,
                dispatch_blocked_at: null,
                dispatch_blocked_by: null,
                financial_status: null,
                status_logistic: 'pending', // Back to pending logistics
                updated_at: now
            })
            .eq('id', salesDocumentId);

        if (updateOrderError) {
            console.error('[resendSalesForApproval] Order update failed:', updateOrderError);
            throw new Error(`Falha ao atualizar pedido: ${updateOrderError.message}`);
        }

        // 4. Get the financial event (should exist from previous confirmation)
        const { data: event, error: eventError } = await supabase
            .from('financial_events')
            .select('id, status')
            .eq('company_id', order.company_id)
            .eq('origin_type', 'SALE')
            .eq('origin_id', salesDocumentId)
            .single();

        if (eventError || !event) {
            // This shouldn't happen if order was previously confirmed
            console.warn('[resendSalesForApproval] No financial event found, trigger will create one');
        }

        // 5. Explicitly reset financial event to pending
        // Note: The trigger will also do this, but we do it explicitly for clarity
        if (event && event.status === 'rejected') {
            const { error: resetEventError } = await supabase
                .from('financial_events')
                .update({
                    status: 'pending',
                    rejected_by: null,
                    rejected_at: null,
                    rejection_reason: null,
                    attention_marked_by: null,
                    attention_marked_at: null,
                    attention_reason: null,
                    total_amount: order.total_amount,
                    operational_status: 'pending',
                    updated_at: now
                })
                .eq('id', event.id);

            if (resetEventError) {
                console.error('[resendSalesForApproval] Event reset failed:', resetEventError);
                // Non-blocking - trigger will handle this
            }
        }

        // 6. Record audit trail
        const auditDescription = userNote
            ? `Reenviado para aprovação financeira: ${userNote}`
            : 'Reenviado para aprovação financeira após correções';

        const { error: historyError } = await supabase
            .from('sales_order_history')
            .insert({
                document_id: salesDocumentId,
                user_id: userId,
                event_type: 'FINANCIAL_RESUBMIT',
                description: auditDescription,
                metadata: {
                    previous_blocked: dispatch_blocked,
                    previous_block_reason: order.dispatch_blocked_reason,
                    previous_financial_status: financial_status,
                    user_note: userNote,
                    resubmitted_at: now
                }
            });

        if (historyError) {
            console.error('[resendSalesForApproval] History insert failed:', historyError);
            // Non-blocking - continue
        }

        // 7. Revalidate paths
        revalidatePath(`/app/vendas/pedidos/${salesDocumentId}`);
        revalidatePath('/app/vendas/pedidos');
        revalidatePath('/app/financeiro/aprovacoes');

        return {
            success: true,
            data: {
                eventId: event?.id || '',
                documentNumber: order.document_number || salesDocumentId
            }
        };

    } catch (error: any) {
        console.error('[resendSalesForApproval] Unexpected error:', error);
        return {
            success: false,
            error: error.message || 'Erro ao reenviar pedido para aprovação'
        };
    }
}
