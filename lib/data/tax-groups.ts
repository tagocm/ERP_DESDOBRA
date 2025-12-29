
import { SupabaseClient } from '@supabase/supabase-js';

export interface TaxGroup {
    id: string;
    company_id: string;
    name: string;
    description?: string;
    ncm?: string | null;
    cest?: string | null;
    origin_default?: number;
    is_active: boolean;
    observation?: string | null;
}

export async function getTaxGroups(supabase: SupabaseClient, companyId: string, onlyActive = true): Promise<TaxGroup[]> {
    let query = supabase
        .from('tax_groups')
        .select('*')
        .eq('company_id', companyId)
        .is('deleted_at', null)
        .order('name');

    if (onlyActive) {
        query = query.eq('is_active', true);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error fetching tax groups:', error);
        return [];
    }

    return data || [];
}

export async function createTaxGroup(supabase: SupabaseClient, taxGroup: Partial<TaxGroup>) {
    const { data, error } = await supabase
        .from('tax_groups')
        .insert(taxGroup)
        .select()
        .single();

    if (error) throw error;
    return data as TaxGroup;
}

export async function updateTaxGroup(supabase: SupabaseClient, id: string, updates: Partial<TaxGroup>) {
    const { data, error } = await supabase
        .from('tax_groups')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

    if (error) throw error;
    return data as TaxGroup;
}

export async function deleteTaxGroup(supabase: SupabaseClient, id: string) {
    const { error } = await supabase
        .from('tax_groups')
        .update({ deleted_at: new Date().toISOString() }) // Soft delete
        .eq('id', id);

    if (error) throw error;
}
