'use server';

import { createClient } from '@/utils/supabase/server';
import { SalesOrder } from '@/types/sales';
import { revalidatePath } from 'next/cache';
import { emitOffline } from '@/lib/fiscal/nfe/offline/emitOffline';
import { logger } from '@/lib/logger';

// --- Types ---

export interface NFeItem {
    id: string; // sales_order_item_id or temp-id
    product_id: string; // references items(id)
    product_code: string;
    product_name: string;
    ncm: string;
    cfop: string;
    uom: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    discount?: number;
    // Fiscal details
    origem?: number;
    cst_icms?: string;
    cst_pis?: string;
    cst_cofins?: string;
    cst_ipi?: string;
    // Values
    icms_base?: number;
    icms_rate?: number;
    icms_value?: number;
    icms_st_base?: number;
    icms_st_value?: number;
    ipi_rate?: number;
    ipi_value?: number;
    pis_value?: number;
    cofins_value?: number;
}

export interface NFeInstallment {
    number: number;
    type: 'HOJE' | 'FUTURO'; // 'HOJE' = Entry, 'FUTURO' = Installment
    method: string; // 'DINHEIRO', 'PIX', 'BOLETO', 'CARTAO', etc.
    dueDate: string;
    amount: number;
}

export interface PaymentTerm {
    id: string;
    name: string;
    description?: string;
    installments_count: number;
    first_due_days: number;
    cadence_days?: number | null;
    is_active: boolean;
}

export interface NFeBilling {
    paymentMode: string; // 'avista', 'prazo', 'misto', 'sem_pagamento'. Kept for legacy support or manual mode.
    paymentTermId?: string; // ID of selected payment term
    installments: NFeInstallment[];
}

export interface NFeTransport {
    modality: string; // '0'=Corret. Remetente, '1'=Destinatario, '9'=Sem Frete...
    volumes_qty?: number;
    species?: string;
    brand?: string;
    number?: string;
    weight_net?: number;
    weight_gross?: number;
    carrier?: {
        id?: string;
        document?: string;
        name?: string;
        ie?: string;
        address?: string;
        city?: string;
        uf?: string;
    };
}

export interface NFeDraftData {
    issuer: any; // Company Data Snapshot
    recipient: any; // Client Data Snapshot (Name, CNPJ, Address, IE)
    items: NFeItem[];
    billing: NFeBilling;
    transport: NFeTransport;
    totals: {
        products: number;
        discount: number;
        freight: number;
        insurance: number;
        others: number;
        total: number;
    };
    additional_info?: {
        fisco?: string;
        taxpayer?: string;
    };
}

export interface EmissionData {
    order: SalesOrder;
    draft: NFeDraftData | null;
    company: any;
    payment_term?: PaymentTerm | null; // The order's linked term (default)
    available_payment_terms: PaymentTerm[]; // List for dropdown
    available_uoms: string[]; // List of available UOM abbreviations
}

// --- Actions ---

export async function getNFeEmissionData(orderId: string): Promise<EmissionData> {
    const supabase = await createClient();

    // 1. Get Order with Items, Payments, Client
    const { data: order, error: orderError } = await supabase
        .from('sales_documents')
        .select(`
            *,
            client:organizations!client_id(*, addresses(*)),
            items:sales_document_items!sales_document_items_document_id_fkey(*, packaging:item_packaging(*), product:items!sales_document_items_item_id_fkey(*, fiscal:item_fiscal_profiles(*))),
            payments:sales_document_payments(*),
            payment_term:payment_terms!fk_sales_doc_payment_terms(*),
            carrier:organizations!carrier_id(*, addresses(*))
        `)
        .eq('id', orderId)
        .single();

    if (orderError) throw orderError;

    // 2. Get User's Company (Issuer)
    // Assuming auth user context
    const { data: { user } } = await supabase.auth.getUser();
    logger.debug('[getNFeEmissionData] auth user loaded', { has_user: !!user });
    // const { data: member } = await supabase.from('company_members').select('company_id').eq('auth_user_id', user?.id).single();

    // Using company_id from order is safer if RLS matches, but let's stick to auth context or order's company
    const adminSupabase = await import('@/lib/supabaseServer').then(m => m.createAdminClient());

    // Use admin client to fetch company to avoid RLS issues for now
    const { data: company, error: companyError } = await adminSupabase
        .from('companies')
        .select(`*, addresses(*), fiscal_profile:company_settings(*)`)
        .eq('id', order.company_id)
        .single();

    logger.debug('[getNFeEmissionData] company fetched', { found: !!company });
    if (!company) {
        logger.error('[getNFeEmissionData] company not found for order', { orderId });
    }

    // 2.0 Fetch financial installments directly from financial events (even if not approved)
    const { data: financialEvent } = await adminSupabase
        .from('financial_events')
        .select(`
            id,
            status,
            created_at,
            installments:financial_event_installments(
                installment_number,
                due_date,
                amount,
                payment_method,
                payment_condition
            )
        `)
        .eq('company_id', order.company_id)
        .eq('origin_type', 'SALE')
        .eq('origin_id', orderId)
        .neq('status', 'rejected')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    // 2.1 Fetch all active payment terms for dropdown
    const { data: available_payment_terms } = await supabase
        .from('payment_terms')
        .select('*')
        .eq('company_id', order.company_id)
        .eq('is_active', true)
        .order('name');

    // 2.2 Fetch all active UOMs (Units of Measure)
    const { data: uoms } = await supabase
        .from('uoms')
        .select('abbrev, description') // fetching description too if needed, but abbrev is the key
        .eq('is_active', true)
        .or(`company_id.eq.${order.company_id},company_id.is.null`)
        .order('abbrev');

    // 3. Get Existing Draft
    const { data: nfe } = await supabase
        .from('sales_document_nfes')
        .select('*')
        .eq('document_id', orderId)
        .in('status', ['draft', 'authorized', 'processing']) // Don't fetch cancelled? Or fetch last?
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    let draft = null;
    if (nfe && nfe.status === 'draft' && nfe.draft_snapshot) {
        draft = nfe.draft_snapshot;
    }

    return {
        order: {
            ...(order as any),
            financial_event_installments: (financialEvent as any)?.installments || []
        } as any,
        draft,
        company,
        payment_term: (order as any).payment_term,
        available_payment_terms: (available_payment_terms || []) as PaymentTerm[],
        available_uoms: (uoms || []).map((u: any) => u.abbrev) // Return string array of abbreviations
    };
}

export async function saveNFeDraft(
    orderId: string,
    draftData: NFeDraftData,
    companyId?: string,
    targetStatus: 'draft' | 'processing' = 'draft'
) {
    const supabase = await createClient();
    const adminSupabase = await import('@/lib/supabaseServer').then(m => m.createAdminClient());
    const nowIso = new Date().toISOString();

    const { data: order, error: orderError } = await supabase
        .from('sales_documents')
        .select('id, company_id')
        .eq('id', orderId)
        .single();

    if (orderError || !order?.company_id) {
        logger.error('[saveNFeDraft] order access denied or not found', {
            orderId,
            message: orderError?.message,
            code: orderError?.code
        });
        throw new Error('Pedido não encontrado ou sem permissão.');
    }

    const resolvedCompanyId = companyId || order.company_id;

    // Check if draft exists
    const { data: existing, error: existingError } = await adminSupabase
        .from('sales_document_nfes')
        .select('id')
        .eq('document_id', orderId)
        .eq('status', targetStatus)
        .maybeSingle();

    if (existingError) {
        logger.error('[saveNFeDraft] failed to check existing draft', {
            orderId,
            message: existingError.message,
            code: existingError.code
        });
        throw new Error('Falha ao verificar rascunho da NF-e.');
    }

    if (existing) {
        const updateWithSnapshot = await adminSupabase
            .from('sales_document_nfes')
            .update({
                draft_snapshot: draftData,
                updated_at: nowIso
            } as any)
            .eq('id', existing.id)
            .select('id')
            .maybeSingle();

        if (updateWithSnapshot.data?.id) {
            return { success: true };
        }

        const snapshotColumnMissing = updateWithSnapshot.error?.message?.includes('draft_snapshot');
        if (!snapshotColumnMissing) {
            logger.error('[saveNFeDraft] failed to update draft', {
                orderId,
                draftId: existing.id,
                message: updateWithSnapshot.error?.message,
                code: updateWithSnapshot.error?.code
            });
            throw new Error('Falha ao atualizar rascunho da NF-e.');
        }

        const updateWithoutSnapshot = await adminSupabase
            .from('sales_document_nfes')
            .update({
                updated_at: nowIso
            })
            .eq('id', existing.id)
            .select('id')
            .maybeSingle();

        if (!updateWithoutSnapshot.data?.id) {
            logger.error('[saveNFeDraft] failed to update draft (legacy schema fallback)', {
                orderId,
                draftId: existing.id,
                message: updateWithoutSnapshot.error?.message,
                code: updateWithoutSnapshot.error?.code
            });
            throw new Error('Falha ao atualizar rascunho da NF-e.');
        }
    } else {
        const payloadVariants: Array<Record<string, unknown>> = [];
        const basePayload = {
            document_id: orderId,
            status: targetStatus,
            updated_at: nowIso
        };

        if (resolvedCompanyId) {
            payloadVariants.push({ ...basePayload, company_id: resolvedCompanyId, draft_snapshot: draftData });
            payloadVariants.push({ ...basePayload, company_id: resolvedCompanyId });
        }
        payloadVariants.push({ ...basePayload, draft_snapshot: draftData });
        payloadVariants.push(basePayload);

        let insertedId: string | null = null;
        let lastInsertErrorMessage: string | undefined;
        let lastInsertErrorCode: string | undefined;

        for (const payload of payloadVariants) {
            const { data: inserted, error: insertError } = await adminSupabase
                .from('sales_document_nfes')
                .insert(payload as any)
                .select('id')
                .maybeSingle();

            if (inserted?.id) {
                insertedId = inserted.id;
                break;
            }

            lastInsertErrorMessage = insertError?.message;
            lastInsertErrorCode = insertError?.code;
        }

        if (!insertedId) {
            logger.error('[saveNFeDraft] failed to insert draft', {
                orderId,
                companyId: resolvedCompanyId,
                targetStatus,
                message: lastInsertErrorMessage,
                code: lastInsertErrorCode
            });
            throw new Error('Falha ao criar rascunho da NF-e.');
        }
    }

    return { success: true };
}

export async function emitNFe(orderId: string, draftData: NFeDraftData) {
    const supabase = await createClient(); // Auth client (checks sender)
    const adminSupabase = await import('@/lib/supabaseServer').then(m => m.createAdminClient()); // Admin client (for queue insertion)

    // 0. Concurrency Check (Guardrail)
    const { data: existingProcessing } = await supabase
        .from('sales_document_nfes')
        .select('id, status')
        .eq('document_id', orderId)
        .in('status', ['processing', 'authorized'])
        .maybeSingle();

    if (existingProcessing) {
        throw new Error(`Já existe uma NF-e em ${existingProcessing.status === 'processing' ? 'processamento' : 'autorizada'} para este pedido.`);
    }

    // Get company_id (needed for draft compatibility and worker payload)
    const { data: order, error: orderError } = await supabase
        .from('sales_documents')
        .select('company_id')
        .eq('id', orderId)
        .single();

    if (orderError || !order?.company_id) {
        logger.error('[emitNFe] failed to load order company', {
            orderId,
            message: orderError?.message,
            code: orderError?.code
        });
        throw new Error('Pedido sem empresa vinculada.');
    }

    // 1. Save final state (must succeed before enqueueing worker job)
    await saveNFeDraft(orderId, draftData, order.company_id, 'processing');

    // 2. ENQUEUE JOB
    logger.debug('[emitNFe] enqueueing NFE_EMIT', { orderId });

    const { data: job, error: jobError } = await adminSupabase
        .from('jobs_queue')
        .insert({
            job_type: 'NFE_EMIT',
            payload: { orderId, companyId: order.company_id },
            status: 'pending'
        })
        .select('id')
        .single();

    if (jobError || !job) {
        if (jobError) {
            logger.error('[emitNFe] job enqueue error', { message: jobError.message, code: jobError.code });
        } else {
            logger.error('[emitNFe] job enqueue error: no job returned');
        }
        throw new Error("Falha ao enfileirar processamento.");
    }

    // Return 202-like response with Job ID
    return {
        success: true,
        jobId: job.id,
        message: 'Solicitação enfileirada com sucesso. Aguarde o processamento.'
    };
}

// NEW: Polling Action (Called by UI)
export async function pollNFeJobStatus(jobId: string) {
    const adminSupabase = await import('@/lib/supabaseServer').then(m => m.createAdminClient());

    const { data: job, error } = await adminSupabase
        .from('jobs_queue')
        .select('status, last_error, updated_at')
        .eq('id', jobId)
        .single();

    if (error || !job) return { status: 'unknown' };

    return {
        status: job.status,
        last_error: job.last_error,
        updated_at: job.updated_at
    };
}
