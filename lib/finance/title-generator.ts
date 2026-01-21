/**
 * AR/AP Title Generator
 * Creates official titles from approved financial events
 */

import { createAdminClient } from '@/lib/supabaseServer';
import { FinancialEvent } from './events-db';

/**
 * Generate AR title and installments from approved event
 */
export async function generateARTitle(event: FinancialEvent): Promise<string> {
    const supabase = await createAdminClient();

    // 1. Create ar_title
    const { data: title, error: titleError } = await supabase
        .from('ar_titles')
        .insert({
            company_id: event.company_id,
            customer_id: event.partner_id,
            issue_date: event.issue_date,
            total_amount: event.total_amount,
            status: 'aberto',
            source_event_id: event.id,
            document_number: event.origin_reference || `Evento #${event.id.slice(0, 8)}`,
            notes: event.notes
        })
        .select()
        .single();

    if (titleError || !title) {
        throw new Error(`Failed to create AR title: ${titleError?.message}`);
    }

    // 2. Create ar_installments from event installments
    if (!event.installments || event.installments.length === 0) {
        throw new Error('Cannot create AR title without installments');
    }

    const installments = event.installments.map(inst => ({
        title_id: title.id,
        installment_number: inst.installment_number,
        due_date: inst.due_date,
        original_amount: inst.amount,
        outstanding_amount: inst.amount,
        status: 'aberto',
        payment_method: inst.payment_method,
        notes: inst.notes,
        account_id: inst.suggested_account_id,
        cost_center_id: inst.cost_center_id
    }));

    const { error: instError } = await supabase
        .from('ar_installments')
        .insert(installments);

    if (instError) {
        // Rollback title creation
        await supabase.from('ar_titles').delete().eq('id', title.id);
        throw new Error(`Failed to create AR installments: ${instError.message}`);
    }

    return title.id;
}

/**
 * Generate AP title and installments from approved event
 */
export async function generateAPTitle(event: FinancialEvent): Promise<string> {
    const supabase = await createAdminClient();

    // 1. Create ap_title
    const { data: title, error: titleError } = await supabase
        .from('ap_titles')
        .insert({
            company_id: event.company_id,
            supplier_id: event.partner_id,
            issue_date: event.issue_date,
            total_amount: event.total_amount,
            status: 'aberto',
            source_event_id: event.id,
            document_number: event.origin_reference || `Evento #${event.id.slice(0, 8)}`,
            notes: event.notes
        })
        .select()
        .single();

    if (titleError || !title) {
        throw new Error(`Failed to create AP title: ${titleError?.message}`);
    }

    // 2. Create ap_installments from event installments
    if (!event.installments || event.installments.length === 0) {
        throw new Error('Cannot create AP title without installments');
    }

    const installments = event.installments.map(inst => ({
        title_id: title.id,
        installment_number: inst.installment_number,
        due_date: inst.due_date,
        original_amount: inst.amount,
        outstanding_amount: inst.amount,
        status: 'aberto',
        payment_method: inst.payment_method,
        notes: inst.notes,
        account_id: inst.suggested_account_id, // Mapped from event 'suggested_account_id' which typically holds the gl_account id
        cost_center_id: inst.cost_center_id
    }));

    const { error: instError } = await supabase
        .from('ap_installments')
        .insert(installments);

    if (instError) {
        // Rollback title creation
        await supabase.from('ap_titles').delete().eq('id', title.id);
        throw new Error(`Failed to create AP installments: ${instError.message}`);
    }

    return title.id;
}

/**
 * Generate title based on event direction (AR or AP)
 */
export async function generateTitleFromEvent(event: FinancialEvent): Promise<{ titleId: string; direction: string }> {
    if (event.direction === 'AR') {
        const titleId = await generateARTitle(event);
        return { titleId, direction: 'AR' };
    } else {
        const titleId = await generateAPTitle(event);
        return { titleId, direction: 'AP' };
    }
}
