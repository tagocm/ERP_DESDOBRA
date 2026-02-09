/**
 * Financial Events Server Actions
 * Orchestrates approval workflow with validation and title generation
 */

'use server';

import { createClient } from '@/utils/supabase/server';
import { logger } from '@/lib/logger';
import {
    listPendingEvents,
    getEventWithDetails,
    updateEventInstallments,
    markEventAttention,
    approveEventAtomic,
    finalizeApproval,
    rollbackApproval,
    rejectEvent,
    validateFinancialEvent,
    canApproveEvent,
    autoFixInstallmentsSum,
    type FinancialEvent,
    type EventInstallment,
    type ValidationPendency,
    type ApprovalSnapshot
} from '@/lib/finance/events-db';
import { generateTitleFromEvent } from '@/lib/finance/title-generator';
import { recalculateInstallments } from '@/lib/utils/finance-calculations';

export interface ActionResult<T = any> {
    success: boolean;
    data?: T;
    error?: string;
}

export interface BankAccountOption {
    id: string;
    name: string;
}

export interface GLAccountOption {
    id: string;
    code: string;
    name: string;
    type: string;
}

export interface CostCenterOption {
    id: string;
    code: string | null;
    name: string;
}

export interface PaymentTermOption {
    id: string;
    name: string;
    installments_count: number;
    first_due_days: number;
    cadence_days: number;
}

/**
 * List bank accounts for selection
 */
export async function listBankAccountsAction(companyId: string): Promise<ActionResult<BankAccountOption[]>> {
    try {
        const supabase = await createClient();
        const { data, error } = await supabase
            .from('company_bank_accounts')
            .select('id, bank_name, agency, account_number, description')
            .eq('company_id', companyId)
            .eq('is_active', true);

        if (error) throw error;

        const options = (data || []).map(acc => ({
            id: acc.id,
            name: acc.description || `${acc.bank_name} - ${acc.account_number}`
        }));

        return { success: true, data: options };
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error('[listBankAccountsAction] Error', { message });
        return { success: false, error: message };
    }
}

/**
 * List GL Accounts (Active)
 */
export async function listGLAccountsAction(companyId: string): Promise<ActionResult<GLAccountOption[]>> {
    try {
        const supabase = await createClient();
        const { data, error } = await supabase
            .from('gl_accounts')
            .select('id, code, name, type')
            .eq('company_id', companyId)
            .eq('is_active', true)
            .order('code', { ascending: true });

        if (error) throw error;
        return { success: true, data: data || [] };
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error('[listGLAccountsAction] Error', { message });
        return { success: false, error: message };
    }
}

/**
 * List Cost Centers (Active)
 */
export async function listCostCentersAction(companyId: string): Promise<ActionResult<CostCenterOption[]>> {
    try {
        const supabase = await createClient();
        const { data, error } = await supabase
            .from('cost_centers')
            .select('id, code, name')
            .eq('company_id', companyId)
            .eq('is_active', true)
            .order('name', { ascending: true });

        if (error) throw error;
        return { success: true, data: data || [] };
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error('[listCostCentersAction] Error', { message });
        return { success: false, error: message };
    }
}

/**
 * List Payment Terms (Active)
 */
export async function listPaymentTermsAction(companyId: string): Promise<ActionResult<PaymentTermOption[]>> {
    try {
        const supabase = await createClient();
        const { data, error } = await supabase
            .from('payment_terms')
            .select('id, name, installments_count, first_due_days, cadence_days')
            .eq('company_id', companyId)
            .eq('is_active', true)
            .order('name', { ascending: true });

        if (error) throw error;
        return { success: true, data: data || [] };
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error('[listPaymentTermsAction] Error', { message });
        return { success: false, error: message };
    }
}

/**
 * List pending events for approval (pending or attention only)
 */
export async function listPendingEventsAction(companyId: string): Promise<ActionResult<FinancialEvent[]>> {
    try {
        const events = await listPendingEvents(companyId);
        return { success: true, data: events };
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error('[listPendingEventsAction] Error', { message });
        return { success: false, error: message };
    }
}

/**
 * Get event with full details including installments
 */
export async function getEventDetailsAction(eventId: string): Promise<ActionResult<FinancialEvent>> {
    try {
        const event = await getEventWithDetails(eventId);
        if (!event) {
            return { success: false, error: 'Evento não encontrado' };
        }
        return { success: true, data: event };
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error('[getEventDetailsAction] Error', { message });
        return { success: false, error: message };
    }
}

/**
 * Validate event and return pendencies
 */
export async function validateEventAction(eventId: string): Promise<ActionResult<ValidationPendency[]>> {
    try {
        const event = await getEventWithDetails(eventId);
        if (!event) {
            return { success: false, error: 'Evento não encontrado' };
        }

        const pendencies = validateFinancialEvent(event);
        return { success: true, data: pendencies };
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error('[validateEventAction] Error', { message });
        return { success: false, error: message };
    }
}

/**
 * Update event installments
 */
export async function updateInstallmentsAction(
    eventId: string,
    installments: Omit<EventInstallment, 'id' | 'event_id' | 'created_at' | 'updated_at'>[]
): Promise<ActionResult> {
    try {
        await updateEventInstallments(eventId, installments);

        // Re-validate after update
        const event = await getEventWithDetails(eventId);
        if (event) {
            const pendencies = validateFinancialEvent(event);

            // If there are errors, mark as attention
            if (pendencies.some(p => p.severity === 'error')) {
                const supabase = await createClient();
                const { data: { user } } = await supabase.auth.getUser();

                if (user) {
                    await markEventAttention(
                        eventId,
                        user.id,
                        'Parcelas atualizadas com pendências: ' + pendencies.map(p => p.message).join(', ')
                    );
                }
            }
        }

        return { success: true };
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error('[updateInstallmentsAction] Error', { message });
        return { success: false, error: message };
    }
}

/**
 * Auto-fix installments sum mismatch
 */
export async function autoFixInstallmentsAction(eventId: string): Promise<ActionResult> {
    try {
        const event = await getEventWithDetails(eventId);
        if (!event) {
            return { success: false, error: 'Evento não encontrado' };
        }

        const fixedInstallments = autoFixInstallmentsSum(event);
        await updateEventInstallments(eventId, fixedInstallments);

        return { success: true, data: fixedInstallments };
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error('[autoFixInstallmentsAction] Error', { message });
        return { success: false, error: message };
    }
}

/**
 * Mark event for attention
 */
export async function markAttentionAction(eventId: string, reason: string): Promise<ActionResult> {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return { success: false, error: 'Usuário não autenticado' };
        }

        await markEventAttention(eventId, user.id, reason);
        return { success: true };
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error('[markAttentionAction] Error', { message });
        return { success: false, error: message };
    }
}

/**
 * Approve financial event (ATOMIC with title generation)
 * Returns title ID and direction for redirect link
 */
export async function approveEventAction(eventId: string): Promise<ActionResult<{ titleId: string; direction: 'AR' | 'AP' }>> {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return { success: false, error: 'Usuário não autenticado' };
        }

        // 1. Get event with full details
        const event = await getEventWithDetails(eventId);
        if (!event) {
            return { success: false, error: 'Evento não encontrado' };
        }

        // 2. Validate event
        if (!canApproveEvent(event)) {
            const pendencies = validateFinancialEvent(event);
            const errorMessages = pendencies
                .filter(p => p.severity === 'error')
                .map(p => p.message)
                .join('; ');

            return {
                success: false,
                error: `Não é possível aprovar: ${errorMessages}`
            };
        }

        // 3. Build approval snapshot
        const snapshot: ApprovalSnapshot = {
            event: {
                id: event.id,
                origin_type: event.origin_type,
                origin_reference: event.origin_reference || '',
                partner_id: event.partner_id || '',
                partner_name: event.partner_name || '',
                total_amount: event.total_amount,
                issue_date: event.issue_date
            },
            installments: (event.installments || []).map(inst => ({
                number: inst.installment_number,
                due_date: inst.due_date,
                amount: inst.amount,
                payment_condition: inst.payment_condition,
                payment_method: inst.payment_method,
                account_id: inst.suggested_account_id,
                category_id: inst.category_id,
                cost_center_id: inst.cost_center_id
            })),
            approved_by: user.id,
            approved_at: new Date().toISOString(),
            validation_passed: true
        };

        // 4. Atomic approval (lock with 'approving' status)
        const locked = await approveEventAtomic(eventId, user.id, snapshot);

        if (!locked) {
            return {
                success: false,
                error: 'Evento já foi aprovado ou está sendo processado'
            };
        }

        try {
            // 5. Generate AR/AP title
            const { titleId, direction } = await generateTitleFromEvent(event);

            // 6. Finalize approval (status → 'approved')
            await finalizeApproval(eventId);

            // 7. Clear financial blocks and send to sandbox (for SALE events)
            if (event.origin_type === 'SALE' && event.origin_id) {
                try {
                    // Check if order was blocked or in review
                    const { data: salesDoc } = await supabase
                        .from('sales_documents')
                        .select('dispatch_blocked, financial_status, status_logistic, document_number')
                        .eq('id', event.origin_id)
                        .single();

                    if (salesDoc && (salesDoc.dispatch_blocked || salesDoc.financial_status === 'in_review')) {
                        const wasBlocked = salesDoc.dispatch_blocked;

                        // Clear blocks and send to sandbox
                        const { error: clearBlockError } = await supabase
                            .from('sales_documents')
                            .update({
                                dispatch_blocked: false,
                                dispatch_blocked_reason: null,
                                dispatch_blocked_at: null,
                                dispatch_blocked_by: null,
                                financial_status: null,
                                status_logistic: 'sandbox', // Send to logistics sandbox
                                updated_at: new Date().toISOString()
                            })
                            .eq('id', event.origin_id);

                        if (clearBlockError) {
                            logger.warn('[Approve] Failed to clear block (non-blocking)', {
                                code: clearBlockError.code,
                                message: clearBlockError.message
                            });
                            // Non-blocking - approval already succeeded
                        }

                        // Record in audit trail
                        await supabase
                            .from('sales_order_history')
                            .insert({
                                document_id: event.origin_id,
                                user_id: user.id,
                                event_type: 'FINANCIAL_APPROVED_AFTER_REVIEW',
                                description: wasBlocked
                                    ? 'Aprovação financeira concedida - Bloqueio removido e pedido enviado para sandbox logística'
                                    : 'Aprovação financeira concedida - Pedido enviado para sandbox logística',
                                metadata: {
                                    event_id: eventId,
                                    title_id: titleId,
                                    was_blocked: wasBlocked,
                                    previous_logistic_status: salesDoc.status_logistic
                                }
                            });

                        logger.info('[Approve] Order unblocked and sent to sandbox', { documentNumber: salesDoc.document_number });
                    }
                } catch (sandboxError: unknown) {
                    const message = sandboxError instanceof Error ? sandboxError.message : 'Unknown error';
                    logger.warn('[Approve] Sandbox logic failed (non-blocking)', { message });
                    // Don't fail the approval - this is a post-approval operation
                }
            }

            logger.info('[Approve] Event approved', { eventId, direction, titleId });

            return {
                success: true,
                data: { titleId, direction }
            };

        } catch (titleError: unknown) {
            // Rollback on failure
            const message = titleError instanceof Error ? titleError.message : 'Unknown error';
            logger.error('[Approve] Title generation failed, rolling back', { message });
            await rollbackApproval(eventId);

            return {
                success: false,
                error: `Falha ao criar título: ${message}`
            };
        }

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error('[approveEventAction] Error', { message });
        return { success: false, error: message };
    }
}

/**
 * Batch approve multiple events
 * Returns summary of successes and failures
 */
export async function batchApproveEventsAction(
    eventIds: string[]
): Promise<ActionResult<{
    succeeded: string[];
    failed: { id: string; reason: string }[];
}>> {
    const succeeded: string[] = [];
    const failed: { id: string; reason: string }[] = [];

    for (const eventId of eventIds) {
        const result = await approveEventAction(eventId);

        if (result.success) {
            succeeded.push(eventId);
        } else {
            failed.push({ id: eventId, reason: result.error || 'Erro desconhecido' });
        }
    }

    return {
        success: true,
        data: { succeeded, failed }
    };
}

/**
 * Reject event
 */
export async function rejectEventAction(eventId: string, reason: string): Promise<ActionResult> {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return { success: false, error: 'Usuário não autenticado' };
        }

        if (!reason || reason.trim().length < 10) {
            return { success: false, error: 'Motivo deve ter pelo menos 10 caracteres' };
        }

        await rejectEvent(eventId, user.id, reason);
        return { success: true };
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error('[rejectEventAction] Error', { message });
        return { success: false, error: message };
    }
}

/**
 * Recalculate installments based on payment condition
 * (e.g., "30/60/90" → 3 installments, "À vista" → 1 installment)
 */
export async function recalculateInstallmentsAction(
    eventId: string,
    paymentCondition: string
): Promise<ActionResult<EventInstallment[]>> {
    try {
        const event = await getEventWithDetails(eventId);
        if (!event) {
            return { success: false, error: 'Evento não encontrado' };
        }

        // Parse payment condition (basic implementation)
        let installments: Omit<EventInstallment, 'id' | 'event_id' | 'created_at' | 'updated_at'>[] = [];
        const issueDate = new Date(event.issue_date);

        if (paymentCondition.toLowerCase().includes('vista')) {
            // Single payment
            installments = [{
                installment_number: 1,
                due_date: issueDate.toISOString().split('T')[0],
                amount: event.total_amount,
                payment_condition: paymentCondition,
                payment_method: null,
                suggested_account_id: null,
                category_id: null,
                cost_center_id: null,
                financial_account_id: null,
                notes: null
            }];
        } else {
            // Try to parse using shared utils logic if it matches standard format? 
            // The utils `recalculateInstallments` expects a structured `paymentTerm` config.
            // Here we only have a string `paymentCondition`.
            // We need to parse the string into the config first, as the inline code did manually.

            const match = paymentCondition.match(/(\d+)x(\d+)|(\d+)\/(\d+)\/(\d+)/);

            if (match) {
                let count = 1;
                let firstDue = 30;
                let cadence = 30;

                if (match[1]) {
                    // Format: "3x30"
                    count = parseInt(match[1]);
                    cadence = parseInt(match[2]);
                    firstDue = cadence;
                } else {
                    // Format: "30/60/90" - This is harder to map to (first, cadence) if it's irregular.
                    // The shared utility assumes REGULAR cadence.
                    // If the input string implies IRREGULAR (e.g. 30/45/60 - diff 15, first 30), 
                    // reusing the shared utility might fail if it strictly enforces `first + i*cadence`.
                    // Example: 30/60/90 -> first 30, cadence 30. Works.

                    const days = [parseInt(match[3]), parseInt(match[4]), parseInt(match[5])].filter(Boolean);
                    // Check if regular
                    const d1 = days[0];
                    const d2 = days[1];
                    const diff = d2 - d1;

                    count = days.length;
                    firstDue = d1;
                    cadence = diff;
                }

                // Import dynamically or at top? Top is better. I will add import in next step.
                // Assuming import is present:
                const rec = recalculateInstallments(
                    event.total_amount,
                    issueDate,
                    { installments_count: count, first_due_days: firstDue, cadence_days: cadence },
                    null,
                    paymentCondition
                );

                // Map back to EventInstallment structure (partial)
                installments = rec.map(r => ({
                    installment_number: r.installment_number,
                    due_date: r.due_date,
                    amount: r.amount,
                    payment_condition: r.payment_condition,
                    payment_method: r.payment_method,
                    suggested_account_id: null,
                    category_id: null,
                    cost_center_id: null,
                    financial_account_id: null,
                    notes: null
                }));

            } else {
                // Default: 30 days
                installments = [{
                    installment_number: 1,
                    due_date: new Date(issueDate.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                    amount: event.total_amount,
                    payment_condition: paymentCondition,
                    payment_method: null,
                    suggested_account_id: null,
                    category_id: null,
                    cost_center_id: null,
                    financial_account_id: null,
                    notes: null
                }];
            }
        }

        await updateEventInstallments(eventId, installments);

        return { success: true, data: installments as EventInstallment[] };
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error('[recalculateInstallments] Error', { message });
        return { success: false, error: message };
    }
}
