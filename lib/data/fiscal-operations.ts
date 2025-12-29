import { SupabaseClient } from "@supabase/supabase-js";

export interface FiscalOperation {
    id: string;
    company_id: string;
    tax_group_id: string;
    destination_state: string; // UF
    customer_ie_indicator: 'contributor' | 'exempt' | 'non_contributor';
    customer_is_final_consumer: boolean;
    operation_type: 'sales' | 'return' | 'shipment' | 'bonus';

    cfop: string;

    // ICMS
    icms_cst?: string;
    icms_csosn?: string;
    icms_modal_bc?: string;
    icms_reduction_bc_percent?: number;
    icms_rate_percent: number;
    icms_show_in_xml: boolean;

    // ST
    st_applies: boolean;
    st_modal_bc?: string;
    st_mva_percent?: number;
    st_reduction_bc_percent?: number;
    st_rate_percent?: number;
    st_fcp_percent?: number;

    // PIS
    pis_applies: boolean;
    pis_cst?: string;
    pis_rate_percent?: number;

    // COFINS
    cofins_applies: boolean;
    cofins_cst?: string;
    cofins_rate_percent?: number;

    // IPI
    ipi_applies: boolean;
    ipi_cst?: string;
    ipi_rate_percent?: number;

    is_active: boolean;
    created_at?: string;
    updated_at?: string;
    deleted_at?: string;

    // Joined Fields
    tax_group?: { name: string };
}

export async function getFiscalOperations(
    supabase: SupabaseClient,
    companyId: string,
    filters?: {
        taxGroupId?: string;
        state?: string;
        operationType?: string;
    }
) {
    let query = supabase
        .from('fiscal_operations')
        .select(`
            *,
            tax_group:tax_groups(name)
        `)
        .eq('company_id', companyId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

    if (filters?.taxGroupId) {
        query = query.eq('tax_group_id', filters.taxGroupId);
    }
    if (filters?.state) {
        query = query.eq('destination_state', filters.state);
    }
    if (filters?.operationType) {
        query = query.eq('operation_type', filters.operationType);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data as FiscalOperation[];
}

export async function createFiscalOperation(
    supabase: SupabaseClient,
    data: Omit<FiscalOperation, 'id' | 'created_at' | 'updated_at' | 'deleted_at' | 'tax_group'>
) {
    const { data: newOp, error } = await supabase
        .from('fiscal_operations')
        .insert(data)
        .select()
        .single();

    if (error) {
        if (error.message.includes('unique_rule')) {
            throw new Error("Já existe uma operação fiscal cadastrada para esta combinação (Empresa + Grupo + UF + Perfil do Cliente + Tipo).");
        }
        throw error;
    }
    return newOp as FiscalOperation;
}

export async function updateFiscalOperation(
    supabase: SupabaseClient,
    id: string,
    data: Partial<Omit<FiscalOperation, 'id' | 'company_id'>>
) {
    const { data: updated, error } = await supabase
        .from('fiscal_operations')
        .update(data)
        .eq('id', id)
        .select()
        .single();

    if (error) {
        if (error.message.includes('unique_rule')) {
            throw new Error("Já existe uma operação fiscal cadastrada para esta combinação.");
        }
        throw error;
    }
    return updated as FiscalOperation;
}

export async function deleteFiscalOperation(supabase: SupabaseClient, id: string) {
    // Soft Delete
    const { error } = await supabase
        .from('fiscal_operations')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);

    if (error) throw error;
}
