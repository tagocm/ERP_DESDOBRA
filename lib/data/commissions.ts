/**
 * Commission Data Layer
 * 
 * RECEIPT_V1 Rule: Commission based on ar_payments.paid_at
 * 
 * All queries use RLS (auth client, not service role)
 */

import { createClient } from '@/utils/supabase/server';
import type {
    CommissionPreviewDTO,
    CommissionClosingDTO,
    CommissionLineDTO,
    EligibleAllocation,
    CommissionClosingRow,
    CommissionLineRow,
} from '@/lib/domain/commission/types';
import {
    createCommissionLine,
    groupLinesByRep,
    calculateSummary,
    validatePeriod,
} from '@/lib/domain/commission/calculator';

// ============================================================================
// HELPER: Convert DB rows to DTOs
// ============================================================================

function closingRowToDTO(row: CommissionClosingRow): CommissionClosingDTO {
    return {
        id: row.id,
        companyId: row.company_id,
        periodStart: row.period_start,
        periodEnd: row.period_end,
        status: row.status as 'draft' | 'closed' | 'reopened',
        commissionRate: row.commission_rate,
        notes: row.notes,
        closedAt: row.closed_at,
        closedBy: row.closed_by,
        reopenedAt: row.reopened_at,
        reopenedBy: row.reopened_by,
        reopenReason: row.reopen_reason,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

function lineRowToDTO(row: CommissionLineRow): CommissionLineDTO {
    return {
        id: row.id,
        closingId: row.closing_id,
        companyId: row.company_id,
        salesRepId: row.sales_rep_id,
        salesRepName: row.sales_rep_name,
        salesDocumentId: row.sales_document_id,
        documentNumber: row.document_number,
        customerId: row.customer_id,
        customerName: row.customer_name,
        arPaymentAllocationId: row.ar_payment_allocation_id,
        arPaymentId: row.ar_payment_id,
        paymentDate: row.payment_date,
        allocatedAmount: Number(row.allocated_amount),
        commissionRate: Number(row.commission_rate),
        commissionAmount: Number(row.commission_amount),
        isReversal: row.is_reversal,
        createdAt: row.created_at,
    };
}

// ============================================================================
// QUERY: Fetch eligible allocations (RECEIPT_V1)
// ============================================================================

async function fetchEligibleAllocations(
    companyId: string,
    periodStart: string,
    periodEnd: string
): Promise<EligibleAllocation[]> {
    const supabase = await createClient();

    // RECEIPT_V1: Buscar ALLOCATIONS vinculadas a pagamentos confirmados no período
    // Isso evita duplicar a base quando um payment tem múltiplas allocations

    // Primeiro, buscar todos os payments elegíveis no período
    const { data: paymentsData, error: paymentsError } = await supabase
        .from('ar_payments')
        .select('id, paid_at, status')
        .eq('company_id', companyId)
        .gte('paid_at', `${periodStart}T00:00:00`)
        .lte('paid_at', `${periodEnd}T23:59:59`)
        .in('status', ['confirmed', 'reversed']);

    if (paymentsError) {
        throw new Error(`Failed to fetch payments: ${paymentsError.message}`);
    }

    if (!paymentsData || paymentsData.length === 0) {
        return [];
    }

    const allocations: EligibleAllocation[] = [];
    const paymentIds = paymentsData.map(p => p.id);

    // Buscar todas as allocations desses payments
    const { data: allocationsData, error: allocationsError } = await supabase
        .from('ar_payment_allocations')
        .select('id, amount_allocated, payment_id, installment_id')
        .in('payment_id', paymentIds);

    if (allocationsError) {
        throw new Error(`Failed to fetch allocations: ${allocationsError.message}`);
    }

    if (!allocationsData || allocationsData.length === 0) {
        return [];
    }

    // Para cada allocation, buscar dados relacionados
    for (const allocation of allocationsData) {
        // Buscar payment para obter paid_at e status
        const payment = paymentsData.find(p => p.id === allocation.payment_id);
        if (!payment) continue;

        // Buscar installment
        const { data: installment } = await supabase
            .from('ar_installments')
            .select('ar_title_id')
            .eq('id', allocation.installment_id)
            .single();

        if (!installment) continue;

        // Buscar title
        const { data: title } = await supabase
            .from('ar_titles')
            .select('sales_document_id')
            .eq('id', installment.ar_title_id)
            .single();

        if (!title) continue;

        // Buscar documento de venda
        const { data: document } = await supabase
            .from('sales_documents')
            .select('id, document_number, sales_rep_id, client_id')
            .eq('id', title.sales_document_id)
            .single();

        if (!document || !document.sales_rep_id) continue;

        // Buscar dados do representante
        const { data: rep } = await supabase
            .from('users')
            .select('id, full_name')
            .eq('id', document.sales_rep_id)
            .single();

        // Buscar dados do cliente
        const { data: customer } = await supabase
            .from('organizations')
            .select('id, name')
            .eq('id', document.client_id)
            .maybeSingle();

        allocations.push({
            allocationId: allocation.id,
            allocatedAmount: payment.status === 'reversed' ? -Number(allocation.amount_allocated) : Number(allocation.amount_allocated),
            paymentId: payment.id,
            paymentDate: payment.paid_at || '',
            isReversal: payment.status === 'reversed',
            salesDocumentId: document.id,
            documentNumber: document.document_number,
            salesRepId: document.sales_rep_id,
            salesRepName: rep?.full_name || 'Representante Desconhecido',
            customerId: customer?.id || null,
            customerName: customer?.name || null,
        });
    }

    return allocations;
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Preview commission closing without saving
 */
export async function previewClosing(
    companyId: string,
    periodStart: string,
    periodEnd: string,
    defaultRate: number
): Promise<CommissionPreviewDTO> {
    validatePeriod(periodStart, periodEnd);

    const eligibleAllocations = await fetchEligibleAllocations(companyId, periodStart, periodEnd);

    // Create lines (without IDs, not saved yet)
    const lines: CommissionLineDTO[] = eligibleAllocations.map((allocation) => {
        const lineData = createCommissionLine(
            allocation,
            '', // closingId will be set when saving
            companyId,
            defaultRate
        );

        return {
            ...lineData,
            id: '', // Temporary ID
            createdAt: new Date().toISOString(),
        };
    });

    const summary = calculateSummary(lines);
    const byRep = groupLinesByRep(lines);

    return {
        periodStart,
        periodEnd,
        defaultRate,
        lines,
        summary: {
            ...summary,
            byRep,
        },
    };
}

/**
 * Create closing draft (without lines)
 */
export async function createClosingDraft(
    companyId: string,
    periodStart: string,
    periodEnd: string,
    defaultRate: number,
    notes?: string
): Promise<{ closingId: string }> {
    validatePeriod(periodStart, periodEnd);

    const supabase = await createClient();

    const { data, error } = await supabase
        .from('commission_closings')
        .insert({
            company_id: companyId,
            period_start: periodStart,
            period_end: periodEnd,
            status: 'draft',
            commission_rate: defaultRate,
            notes: notes || null,
        })
        .select('id')
        .single();

    if (error) {
        throw new Error(`Failed to create closing draft: ${error.message}`);
    }

    return { closingId: data.id };
}

/**
 * Close period (transactional: insert lines + update status)
 */
export async function closeClosing(
    closingId: string,
    userId: string
): Promise<{ linesCount: number }> {
    const supabase = await createClient();

    // 1. Fetch closing
    const { data: closing, error: closingError } = await supabase
        .from('commission_closings')
        .select('*')
        .eq('id', closingId)
        .single();

    if (closingError || !closing) {
        throw new Error(`Closing not found: ${closingId}`);
    }

    if (closing.status !== 'draft') {
        throw new Error(`Cannot close: closing is already ${closing.status}`);
    }

    // 2. Fetch eligible allocations
    const eligibleAllocations = await fetchEligibleAllocations(
        closing.company_id,
        closing.period_start,
        closing.period_end
    );

    if (eligibleAllocations.length === 0) {
        throw new Error('No eligible allocations found for this period');
    }

    // 3. Create lines
    const linesToInsert = eligibleAllocations.map((allocation) => {
        const lineData = createCommissionLine(
            allocation,
            closingId,
            closing.company_id,
            closing.commission_rate || 5 // Fallback to 5% if not set
        );

        return {
            closing_id: lineData.closingId,
            company_id: lineData.companyId,
            sales_rep_id: lineData.salesRepId,
            sales_rep_name: lineData.salesRepName,
            sales_document_id: lineData.salesDocumentId,
            document_number: lineData.documentNumber,
            customer_id: lineData.customerId,
            customer_name: lineData.customerName,
            ar_payment_allocation_id: lineData.arPaymentAllocationId,
            ar_payment_id: lineData.arPaymentId,
            payment_date: lineData.paymentDate,
            allocated_amount: lineData.allocatedAmount,
            commission_rate: lineData.commissionRate,
            commission_amount: lineData.commissionAmount,
            is_reversal: lineData.isReversal,
        };
    });

    // 4. Insert lines (batch)
    const { error: linesError } = await supabase
        .from('commission_lines')
        .insert(linesToInsert);

    if (linesError) {
        throw new Error(`Failed to insert commission lines: ${linesError.message}`);
    }

    // 5. Update closing status
    const { error: updateError } = await supabase
        .from('commission_closings')
        .update({
            status: 'closed',
            closed_at: new Date().toISOString(),
            closed_by: userId,
        })
        .eq('id', closingId);

    if (updateError) {
        throw new Error(`Failed to update closing status: ${updateError.message}`);
    }

    return { linesCount: linesToInsert.length };
}

/**
 * List all closings for a company
 */
export async function listClosings(
    companyId: string
): Promise<CommissionClosingDTO[]> {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('commission_closings')
        .select('*')
        .eq('company_id', companyId)
        .order('period_start', { ascending: false });

    if (error) {
        throw new Error(`Failed to list closings: ${error.message}`);
    }

    return (data || []).map(closingRowToDTO);
}

/**
 * Get closing by ID with lines
 */
export async function getClosingById(
    closingId: string
): Promise<{ closing: CommissionClosingDTO; lines: CommissionLineDTO[] }> {
    const supabase = await createClient();

    // Fetch closing
    const { data: closingData, error: closingError } = await supabase
        .from('commission_closings')
        .select('*')
        .eq('id', closingId)
        .single();

    if (closingError || !closingData) {
        throw new Error(`Closing not found: ${closingId}`);
    }

    // Fetch lines
    const { data: linesData, error: linesError } = await supabase
        .from('commission_lines')
        .select('*')
        .eq('closing_id', closingId)
        .order('payment_date', { ascending: false });

    if (linesError) {
        throw new Error(`Failed to fetch commission lines: ${linesError.message}`);
    }

    return {
        closing: closingRowToDTO(closingData),
        lines: (linesData || []).map(lineRowToDTO),
    };
}

/**
 * Reopen a closed period
 */
export async function reopenClosing(
    closingId: string,
    userId: string,
    reason: string
): Promise<void> {
    const supabase = await createClient();

    // 1. Verify closing exists and is closed
    const { data: closing, error: closingError } = await supabase
        .from('commission_closings')
        .select('status')
        .eq('id', closingId)
        .single();

    if (closingError || !closing) {
        throw new Error(`Closing not found: ${closingId}`);
    }

    if (closing.status !== 'closed') {
        throw new Error(`Cannot reopen: closing is ${closing.status}`);
    }

    // 2. Delete existing lines
    const { error: deleteError } = await supabase
        .from('commission_lines')
        .delete()
        .eq('closing_id', closingId);

    if (deleteError) {
        throw new Error(`Failed to delete commission lines: ${deleteError.message}`);
    }

    // 3. Update closing status
    const { error: updateError } = await supabase
        .from('commission_closings')
        .update({
            status: 'reopened',
            reopened_at: new Date().toISOString(),
            reopened_by: userId,
            reopen_reason: reason,
        })
        .eq('id', closingId);

    if (updateError) {
        throw new Error(`Failed to reopen closing: ${updateError.message}`);
    }
}
