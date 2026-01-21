'use server';

import { createClient } from '@/utils/supabase/server';
import { SalesOrder } from '@/types/sales';
import { revalidatePath } from 'next/cache';
import { emitOffline } from '@/lib/fiscal/nfe/offline/emitOffline';

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
            items:sales_document_items(*, packaging:item_packaging(*), product:items(*, fiscal:item_fiscal_profiles(*))),
            payments:sales_document_payments(*),
            payment_term:payment_terms(*),
            carrier:organizations!carrier_id(*, addresses(*))
        `)
        .eq('id', orderId)
        .single();

    if (orderError) throw orderError;

    // 2. Get User's Company (Issuer)
    // Assuming auth user context
    const { data: { user } } = await supabase.auth.getUser();
    console.log(`[getNFeEmissionData] Auth User ID: ${user?.id}`);
    // const { data: member } = await supabase.from('company_members').select('company_id').eq('auth_user_id', user?.id).single();

    // Using company_id from order is safer if RLS matches, but let's stick to auth context or order's company
    const adminSupabase = await import('@/lib/supabaseServer').then(m => m.createAdminClient());

    // Use admin client to fetch company to avoid RLS issues for now
    const { data: company, error: companyError } = await adminSupabase
        .from('companies')
        .select(`*, addresses(*), fiscal_profile:company_settings(*)`)
        .eq('id', order.company_id)
        .single();

    console.log(`[getNFeEmissionData] Order Company ID: ${order.company_id}`);
    console.log(`[getNFeEmissionData] Fetched Company:`, company ? `Found (${company.id})` : 'NULL');
    if (!company) {
        console.error('[getNFeEmissionData] ERROR: Company not found for order!');
    }

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
        order: order as any,
        draft,
        company,
        payment_term: (order as any).payment_term,
        available_payment_terms: (available_payment_terms || []) as PaymentTerm[],
        available_uoms: (uoms || []).map((u: any) => u.abbrev) // Return string array of abbreviations
    };
}

export async function saveNFeDraft(orderId: string, draftData: NFeDraftData) {
    const supabase = await createClient();

    // Check if draft exists
    const { data: existing } = await supabase
        .from('sales_document_nfes')
        .select('id')
        .eq('document_id', orderId)
        .eq('status', 'draft')
        .maybeSingle();

    if (existing) {
        await supabase
            .from('sales_document_nfes')
            .update({
                draft_snapshot: draftData,
                updated_at: new Date().toISOString() // Assuming column exists or use created_at
            })
            .eq('id', existing.id);
    } else {
        await supabase
            .from('sales_document_nfes')
            .insert({
                document_id: orderId,
                status: 'draft',
                draft_snapshot: draftData
            });
    }

    return { success: true };
}

export async function emitNFe(orderId: string, draftData: NFeDraftData) {
    const supabase = await createClient();

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

    // 1. Save final state
    await saveNFeDraft(orderId, draftData);

    // 2. Call Emission Logic (SEFAZ integration would go here)
    // PATCH: Call emitOffline to Generate & Sign XML (without transmission)

    // Get company_id from the order instead of draftData (more reliable)
    const { data: order } = await supabase
        .from('sales_documents')
        .select('company_id')
        .eq('id', orderId)
        .single();

    const companyId = order?.company_id;
    if (!companyId) {
        throw new Error("Pedido não encontrado ou sem empresa vinculada.");
    }

    // We also need to ensure the record exists in 'processing' state or let emitOffline handle it?
    // emitOffline expects an existing record? 
    // Checking emitOffline implementation:
    // It fetches "nfeRecord" by document_id.
    // If we just inserted it as 'draft' above (saveNFeDraft), emitOffline might fail if it looks for 'processing'?
    // emitOffline checks: .eq('document_id', orderId).order(...).limit(1).single()
    // and expects "nfeRecord".
    // So if we have a draft, emitOffline will pick it up.

    // HOWEVER, emitOffline updates status to 'processing'.
    // So we don't need to manually update status here before calling it, 
    // UNLESS emitOffline expects 'processing' to be set by caller?
    // emitOffline line 67: "Get NFe record (created by emitNFe in 'processing' state or 'draft')"
    // So it finds 'draft' too.

    // Import emitOffline dynamically or at top? Top is better.
    // Assuming import { emitOffline } from '@/lib/fiscal/nfe/offline/emitOffline'; added.

    // Call emitOffline (now supports transmit=true)
    const result = await emitOffline(orderId, companyId, true);

    if (!result.success) {
        throw new Error(result.message || "Falha na emissão.");
    }

    revalidatePath('/app/fiscal/nfe');
    return { success: true, message: result.message || 'NF-e enviada com sucesso.' };
}
