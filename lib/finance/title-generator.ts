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

    if (!event.origin_id) {
        throw new Error('Failed to create AR title: origin_id (sales_document_id) is required');
    }
    if (!event.partner_id) {
        throw new Error('Failed to create AR title: partner_id (customer_id) is required');
    }

    const ensureInstallmentsForTitle = async (titleId: string) => {
        if (!event.installments || event.installments.length === 0) {
            throw new Error('Cannot create AR title without installments');
        }

        const { data: existingInstallments, error: existingInstError } = await supabase
            .from('ar_installments')
            .select('id')
            .eq('ar_title_id', titleId)
            .limit(1);

        if (existingInstError) {
            throw new Error(`Failed to verify AR installments: ${existingInstError.message}`);
        }

        if (existingInstallments && existingInstallments.length > 0) {
            return;
        }

        const installments = event.installments.map(inst => ({
            company_id: event.company_id,
            ar_title_id: titleId,
            installment_number: inst.installment_number,
            due_date: inst.due_date,
            amount_original: inst.amount,
            amount_paid: 0,
            amount_open: inst.amount,
            status: 'OPEN',
            payment_method: inst.payment_method,
            account_id: inst.suggested_account_id,
            financial_account_id: inst.financial_account_id,
            cost_center_id: inst.cost_center_id
        }));

        const { error: instError } = await supabase
            .from('ar_installments')
            .insert(installments);

        if (instError) {
            throw new Error(`Failed to create AR installments: ${instError.message}`);
        }
    };

    // Idempotency: if title already exists for this sales document, reuse it.
    const { data: existingTitle, error: existingTitleError } = await supabase
        .from('ar_titles')
        .select('id, source_event_id')
        .eq('company_id', event.company_id)
        .eq('sales_document_id', event.origin_id)
        .maybeSingle();

    if (existingTitleError) {
        throw new Error(`Failed to check existing AR title: ${existingTitleError.message}`);
    }

    if (existingTitle?.id) {
        if (!existingTitle.source_event_id) {
            await supabase
                .from('ar_titles')
                .update({ source_event_id: event.id })
                .eq('id', existingTitle.id);
        }
        await ensureInstallmentsForTitle(existingTitle.id);
        return existingTitle.id;
    }

    // 1. Create ar_title
    const { data: title, error: titleError } = await supabase
        .from('ar_titles')
        .insert({
            company_id: event.company_id,
            sales_document_id: event.origin_id,
            customer_id: event.partner_id,
            date_issued: event.issue_date,
            amount_total: event.total_amount,
            amount_paid: 0,
            amount_open: event.total_amount,
            status: 'OPEN',
            source_event_id: event.id,
            document_number: event.origin_reference || `Evento #${event.id.slice(0, 8)}`
        })
        .select()
        .single();

    if (titleError) {
        // Race-safe fallback: another process may have created the same title
        // between existence check and insert.
        if (titleError.code === '23505' || (titleError.message || '').includes('ar_titles_sales_doc_unique')) {
            const { data: concurrentTitle, error: concurrentFetchError } = await supabase
                .from('ar_titles')
                .select('id')
                .eq('company_id', event.company_id)
                .eq('sales_document_id', event.origin_id)
                .maybeSingle();

            if (concurrentFetchError || !concurrentTitle?.id) {
                throw new Error(`Failed to create AR title: ${titleError.message}`);
            }

            await ensureInstallmentsForTitle(concurrentTitle.id);
            return concurrentTitle.id;
        }

        throw new Error(`Failed to create AR title: ${titleError.message}`);
    }

    if (!title) {
        throw new Error('Failed to create AR title: insert returned no data');
    }

    // 2. Create ar_installments from event installments (if absent)
    try {
        await ensureInstallmentsForTitle(title.id);
    } catch (error) {
        // Rollback title creation
        await supabase.from('ar_titles').delete().eq('id', title.id);
        throw error;
    }

    return title.id;
}

/**
 * Generate AP title and installments from approved event
 */
export async function generateAPTitle(event: FinancialEvent): Promise<string> {
    const supabase = await createAdminClient();

    if (!event.partner_id) {
        throw new Error('Failed to create AP title: partner_id (supplier_id) is required');
    }

    // 1. Create ap_title
    const { data: title, error: titleError } = await supabase
        .from('ap_titles')
        .insert({
            company_id: event.company_id,
            purchase_order_id: event.origin_type === 'PURCHASE' ? event.origin_id : null,
            supplier_id: event.partner_id,
            date_issued: event.issue_date,
            amount_total: event.total_amount,
            amount_paid: 0,
            amount_open: event.total_amount,
            status: 'OPEN',
            source_event_id: event.id,
            document_number: event.origin_reference || `Evento #${event.id.slice(0, 8)}`,
            description: event.notes || null
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
        company_id: event.company_id,
        ap_title_id: title.id,
        installment_number: inst.installment_number,
        due_date: inst.due_date,
        amount_original: inst.amount,
        amount_paid: 0,
        amount_open: inst.amount,
        status: 'OPEN',
        account_id: inst.suggested_account_id, // Mapped from event 'suggested_account_id' which typically holds the gl_account id
        financial_account_id: inst.financial_account_id,
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
export async function generateTitleFromEvent(event: FinancialEvent): Promise<{ titleId: string; direction: 'AR' | 'AP' }> {
    if (event.direction === 'AR') {
        const titleId = await generateARTitle(event);
        return { titleId, direction: 'AR' };
    } else {
        const titleId = await generateAPTitle(event);
        return { titleId, direction: 'AP' };
    }
}
