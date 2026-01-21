/**
 * Financial Events Data Layer
 * Event-based pre-approval system with installments
 */

import { createAdminClient } from '@/lib/supabaseServer';
import { SupabaseClient } from '@supabase/supabase-js';

export interface FinancialEvent {
    id: string;
    company_id: string;
    origin_type: 'SALE' | 'PURCHASE' | 'EXPENSE' | 'MANUAL';
    origin_id: string | null;
    origin_reference: string | null;
    partner_id: string | null;
    partner_name: string | null;
    direction: 'AR' | 'AP';
    issue_date: string;
    total_amount: number;
    status: 'pendente' | 'em_atencao' | 'aprovando' | 'aprovado' | 'reprovado';
    operational_status?: string | null;
    approved_by: string | null;
    approved_at: string | null;
    approval_snapshot: any | null;
    rejected_by: string | null;
    rejected_at: string | null;
    rejection_reason: string | null;
    attention_marked_by: string | null;
    attention_marked_at: string | null;
    attention_reason: string | null;
    notes: string | null;
    created_at: string;
    updated_at: string;
    installments?: EventInstallment[];
}

export interface EventInstallment {
    id: string;
    event_id: string;
    installment_number: number;
    due_date: string;
    amount: number;
    payment_condition: string | null;
    payment_method: string | null;
    suggested_account_id: string | null;
    category_id: string | null;
    cost_center_id: string | null;
    financial_account_id: string | null;
    notes: string | null;
    created_at: string;
    updated_at: string;
}

export interface ValidationPendency {
    key: string;
    message: string;
    severity: 'error' | 'warning';
    canAutoFix: boolean;
}

/**
 * List pending events for approval (pendente or em_atencao)
 */
export async function listPendingEvents(companyId: string): Promise<FinancialEvent[]> {
    const supabase = await createAdminClient();

    const { data, error } = await supabase
        .from('financial_events')
        .select(`
            *,
            origin_type,
            origin_id,
            installments:financial_event_installments(*)
        `)
        .eq('company_id', companyId)
        .in('status', ['pendente', 'em_atencao'])
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
}

/**
 * Get single event with all details
 */
export async function getEventWithDetails(eventId: string): Promise<FinancialEvent | null> {
    const supabase = await createAdminClient();

    const { data, error } = await supabase
        .from('financial_events')
        .select(`
      *,
      installments:financial_event_installments(*)
    `)
        .eq('id', eventId)
        .single();

    if (error) throw error;
    return data;
}

/**
 * Update event installments
 */
export async function updateEventInstallments(
    eventId: string,
    installments: Omit<EventInstallment, 'id' | 'event_id' | 'created_at' | 'updated_at'>[]
): Promise<void> {
    const supabase = await createAdminClient();

    // Strategy: Upsert based on (event_id, installment_number) unique constraint
    // This updates existing rows and inserts new ones, avoiding unique constraint violations.
    const { error } = await supabase
        .from('financial_event_installments')
        .upsert(
            installments.map(inst => ({
                ...inst,
                event_id: eventId
            })),
            { onConflict: 'event_id, installment_number' }
        );

    if (error) throw error;

    // Remove any extra installments that are no longer in the list (e.g. reduced from 5 to 3)
    // We keep installments 1..N where N is the new length.
    const maxNumber = installments.length;
    await supabase
        .from('financial_event_installments')
        .delete()
        .eq('event_id', eventId)
        .gt('installment_number', maxNumber);
}

/**
 * Update event status
 */
export async function updateEventStatus(
    eventId: string,
    status: 'pendente' | 'em_atencao' | 'aprovado' | 'reprovado',
    updates: Partial<FinancialEvent> = {}
): Promise<void> {
    const supabase = await createAdminClient();

    const { error } = await supabase
        .from('financial_events')
        .update({
            status,
            ...updates,
            updated_at: new Date().toISOString()
        })
        .eq('id', eventId);

    if (error) throw error;
}

/**
 * Mark event for attention
 */
export async function markEventAttention(
    eventId: string,
    userId: string,
    reason: string
): Promise<void> {
    const supabase = await createAdminClient();

    const { error } = await supabase
        .from('financial_events')
        .update({
            status: 'em_atencao',
            attention_marked_by: userId,
            attention_marked_at: new Date().toISOString(),
            attention_reason: reason
        })
        .eq('id', eventId);

    if (error) throw error;
}

export interface ApprovalSnapshot {
    event: {
        id: string;
        origin_type: string;
        origin_reference: string;
        partner_id: string;
        partner_name: string;
        total_amount: number;
        issue_date: string;
    };
    installments: {
        number: number;
        due_date: string;
        amount: number;
        payment_condition: string | null;
        payment_method: string | null;
        account_id: string | null;
        category_id: string | null;
        cost_center_id: string | null;
    }[];
    approved_by: string;
    approved_at: string;
    validation_passed: boolean;
}

/**
 * Approve event with atomic lock (idempotent)
 * Returns true if approved, false if already approved/in progress
 */
export async function approveEventAtomic(
    eventId: string,
    userId: string,
    snapshot: ApprovalSnapshot
): Promise<boolean> {
    const supabase = await createAdminClient();

    // Atomic update: only if status is pendente or em_atencao
    const { data, error } = await supabase
        .from('financial_events')
        .update({
            status: 'aprovando', // Transitional state (lock)
            approved_by: userId,
            approved_at: new Date().toISOString(),
            approval_snapshot: snapshot
        })
        .eq('id', eventId)
        .in('status', ['pendente', 'em_atencao'])
        .select('id');

    if (error) throw error;

    // If no rows updated, event was already approved/in progress
    return (data && data.length > 0);
}

/**
 * Mark event as approved after title creation
 */
export async function finalizeApproval(eventId: string): Promise<void> {
    const supabase = await createAdminClient();

    const { error } = await supabase
        .from('financial_events')
        .update({ status: 'aprovado' })
        .eq('id', eventId)
        .eq('status', 'aprovando');

    if (error) throw error;
}

/**
 * Rollback approval if title creation fails
 */
export async function rollbackApproval(eventId: string): Promise<void> {
    const supabase = await createAdminClient();

    const { error } = await supabase
        .from('financial_events')
        .update({
            status: 'em_atencao',
            attention_reason: 'Falha ao criar título oficial. Verifique os dados e tente novamente.',
            attention_marked_at: new Date().toISOString()
        })
        .eq('id', eventId)
        .eq('status', 'aprovando');

    if (error) throw error;
}

/**
 * Reject event
 */
export async function rejectEvent(
    eventId: string,
    userId: string,
    reason: string
): Promise<void> {
    const supabase = await createAdminClient();

    const { error } = await supabase
        .from('financial_events')
        .update({
            status: 'reprovado',
            rejected_by: userId,
            rejected_at: new Date().toISOString(),
            rejection_reason: reason
        })
        .eq('id', eventId);

    if (error) throw error;
}

/**
 * Validate financial event
 * Returns list of pendencies (errors/warnings)
 */
export function validateFinancialEvent(event: FinancialEvent): ValidationPendency[] {
    const pendencies: ValidationPendency[] = [];

    // 1. Partner validation
    if (!event.partner_id || !event.partner_name) {
        pendencies.push({
            key: 'partner_missing',
            message: 'Parceiro (cliente/fornecedor) não identificado',
            severity: 'error',
            canAutoFix: false
        });
    }

    // 2. Installments sum validation
    if (event.installments && event.installments.length > 0) {
        const sum = event.installments.reduce((acc, inst) => acc + inst.amount, 0);
        const diff = Math.abs(sum - event.total_amount);

        if (diff > 0.01) { // Tolerance for floating point
            pendencies.push({
                key: 'installments_sum_mismatch',
                message: `Soma das parcelas (${sum.toFixed(2)}) diverge do total (${event.total_amount.toFixed(2)})`,
                severity: 'error',
                canAutoFix: true
            });
        }
    } else {
        pendencies.push({
            key: 'installments_missing',
            message: 'Nenhuma parcela definida',
            severity: 'error',
            canAutoFix: true
        });
    }

    // 3. Due date validation
    if (event.installments) {
        event.installments.forEach((inst, idx) => {
            const dueDate = new Date(inst.due_date);
            const issueDate = new Date(event.issue_date);

            if (dueDate < issueDate) {
                pendencies.push({
                    key: `installment_${idx}_invalid_due_date`,
                    message: `Parcela ${inst.installment_number}: vencimento anterior à emissão`,
                    severity: 'error',
                    canAutoFix: false
                });
            }
        });
    }

    // 4. Origin validation
    if (!event.origin_id && !event.origin_reference) {
        pendencies.push({
            key: 'origin_missing',
            message: 'Origem do lançamento não identificada',
            severity: 'warning',
            canAutoFix: false
        });
    }

    return pendencies;
}

/**
 * Check if event can be approved (no blocking errors)
 */
export function canApproveEvent(event: FinancialEvent): boolean {
    const pendencies = validateFinancialEvent(event);
    return pendencies.filter(p => p.severity === 'error').length === 0;
}

/**
 * Auto-fix installments sum mismatch by redistributing amounts
 */
export function autoFixInstallmentsSum(event: FinancialEvent): EventInstallment[] {
    if (!event.installments || event.installments.length === 0) {
        // Create single installment
        return [{
            id: '',
            event_id: event.id,
            installment_number: 1,
            due_date: new Date(new Date(event.issue_date).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            amount: event.total_amount,
            payment_condition: '30 dias',
            payment_method: null,
            suggested_account_id: null,
            category_id: null,
            cost_center_id: null,
            financial_account_id: null,
            notes: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        }];
    }

    const count = event.installments.length;
    const amountPer = event.total_amount / count;
    const roundedAmountPer = Math.floor(amountPer * 100) / 100;
    const remainder = event.total_amount - (roundedAmountPer * count);

    return event.installments.map((inst, idx) => ({
        ...inst,
        amount: idx === 0 ? roundedAmountPer + remainder : roundedAmountPer
    }));
}
