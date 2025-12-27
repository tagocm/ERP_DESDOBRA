import { createClient } from "@/lib/supabaseBrowser";
import { Uom } from "@/types/product";

export async function getUoms(search?: string): Promise<Uom[]> {
    const supabase = createClient();

    let query = supabase
        .from('uoms')
        .select('*')
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

export async function getAllUomsIncludingInactive(): Promise<Uom[]> {
    const supabase = createClient();

    const { data, error } = await supabase
        .from('uoms')
        .select(`
            *,
            items:items(count)
        `)
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
    const supabase = createClient();

    // Get company_id from context/auth usually, but here we assume it's handled by RLS or passed in.
    // For this client-side call, we might rely on the API to set it or pass it explicitly if we are in a context.
    // However, the standard here seems to be RLS context or passed arg.
    // Let's assume we need to fetch the current user's company or it's inserted via stored proc/trigger if defaults.
    // But standard insert:
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    // Fetch company_id from user metadata or context if needed, but often we query companies table.
    // Simplifying assumption: The backend handles company check or we pass it? 
    // In `categories.ts` we didn't pass company_id explicitly in `createProductCategory`. Let's check how it worked.
    // Actually `categories.ts` uses `useCompany` context in UI and passes it? No, `createProductCategory` took `company_id`.

    // So we need company_id here.
    if (!uom.company_id) {
        // Using a workaround or requiring it.
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
    const supabase = createClient();

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
    const supabase = createClient();

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
