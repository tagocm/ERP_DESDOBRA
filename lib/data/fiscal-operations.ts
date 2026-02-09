import { SupabaseClient } from "@supabase/supabase-js";

import { FiscalOperationDTO } from "@/lib/types/fiscal-types";
export type { FiscalOperationDTO };

export async function getFiscalOperations(
    supabase: SupabaseClient,
    companyId: string,
    filters?: {
        taxGroupId?: string;
        state?: string;
        operationType?: string;
        originState?: string; // NEW: Mandatory filter for context
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

    // Pattern B: Always filter by Origin State if provided (should be provided by UI context)
    if (filters?.originState) {
        query = query.eq('uf_origem', filters.originState);
    }

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
    return data as FiscalOperationDTO[];
}

export async function createFiscalOperation(
    supabase: SupabaseClient,
    data: Omit<FiscalOperationDTO, 'id' | 'created_at' | 'updated_at' | 'deleted_at' | 'tax_group' | 'uf_origem'>,
    originState: string // Enforce Origin
) {
    const { data: newOp, error } = await supabase
        .from('fiscal_operations')
        .insert({
            ...data,
            uf_origem: originState
        })
        .select()
        .single();

    if (error) {
        if (error.message.includes('unique_rule')) {
            throw new Error("Já existe uma operação fiscal cadastrada para esta combinação (Empresa + Grupo + UF + Perfil do Cliente + Tipo).");
        }
        throw error;
    }
    return newOp as FiscalOperationDTO;
}

export async function updateFiscalOperation(
    supabase: SupabaseClient,
    id: string,
    data: Partial<Omit<FiscalOperationDTO, 'id' | 'company_id' | 'uf_origem'>>
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
    return updated as FiscalOperationDTO;
}

export async function deleteFiscalOperation(supabase: SupabaseClient, id: string) {
    // Soft Delete
    const { error } = await supabase
        .from('fiscal_operations')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);

    if (error) throw error;
}
