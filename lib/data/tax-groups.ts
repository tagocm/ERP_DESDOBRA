
import { SupabaseClient } from '@supabase/supabase-js';

export interface TaxGroup {
    id: string;
    company_id: string;
    name: string;
    description?: string;
}

export async function getTaxGroups(supabase: SupabaseClient, companyId: string): Promise<TaxGroup[]> {
    const { data, error } = await supabase
        .from('tax_groups')
        .select('*')
        .eq('company_id', companyId)
        .is('deleted_at', null)
        .order('name');

    if (error) {
        console.error('Error fetching tax groups:', error);
        return [];
    }

    return data || [];
}
