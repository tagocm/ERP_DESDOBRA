import { createClient } from "@/utils/supabase/server";
import { Uom } from "@/types/product";
export type { Uom };

export async function getUoms(companyId: string, search?: string): Promise<Uom[]> {
    const supabase = await createClient();

    let query = supabase
        .from('uoms')
        .select('*')
        .or(`company_id.eq.${companyId},company_id.is.null`)
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });

    if (search) {
        query = query.or(`name.ilike.%${search}%,abbrev.ilike.%${search}%`);
    }

    const { data, error } = await query;

    if (error) {
        console.error("Error fetching UOMs:", error);
        return [];
    }

    return data as Uom[];
}

export async function getAllUomsIncludingInactive(companyId: string): Promise<Uom[]> {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('uoms')
        .select(`
            *,
            items:items!items_uom_id_fkey(count)
        `)
        .or(`company_id.eq.${companyId},company_id.is.null`)
        .order('name', { ascending: true });

    if (error) {
        console.error("Error fetching all UOMs:", error);
        return [];
    }

    // Map count
    return data.map((u: any) => ({
        ...u,
        usage_count: u.items?.[0]?.count || 0
    })) as Uom[];
}

export async function createUom(uom: Partial<Uom>): Promise<Uom | null> {
    const supabase = await createClient();

    if (!uom.company_id) {
        throw new Error("Company ID is required");
    }

    const { data, error } = await supabase
        .from('uoms')
        .insert([{
            company_id: uom.company_id,
            name: uom.name,
            abbrev: uom.abbrev,
            is_active: uom.is_active !== undefined ? uom.is_active : true
        }])
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function updateUom(id: string, updates: Partial<Uom>): Promise<Uom | null> {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('uoms')
        .update({
            name: updates.name,
            abbrev: updates.abbrev,
            is_active: updates.is_active,
            updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function deleteUom(id: string): Promise<void> {
    const supabase = await createClient();

    // Check usage first
    const { count, error: countError } = await supabase
        .from('items')
        .select('*', { count: 'exact', head: true })
        .eq('uom_id', id);

    if (countError) throw countError;
    if (count && count > 0) {
        throw new Error(`Esta unidade está em uso por ${count} produto(s) e não pode ser excluída.`);
    }

    const { error } = await supabase
        .from('uoms')
        .delete()
        .eq('id', id);

    if (error) throw error;
}
