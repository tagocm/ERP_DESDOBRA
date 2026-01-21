
import { createClient } from "@/lib/supabaseBrowser";
import { ProductCategory } from "@/types/product";

export async function getCategories(companyId: string) {
    const supabase = createClient();
    const { data, error } = await supabase
        .from('product_categories')
        .select(`
            id, 
            name, 
            normalized_name,
            company_id,
            items:items!items_category_id_fkey(count)
        `)
        .or(`company_id.eq.${companyId},company_id.is.null`)
        .order('name');

    if (error) throw error;

    // Map count
    return data.map((d: any) => ({
        ...d,
        product_count: d.items?.[0]?.count || 0
    })) as ProductCategory[];
}

export async function createCategory(companyId: string, name: string) {
    const supabase = createClient();
    const { data, error } = await supabase
        .from('product_categories')
        .insert({ name, company_id: companyId })
        .select()
        .single();

    if (error) {
        if (error.code === '23505') {
            throw new Error("Já existe uma categoria com este nome.");
        }
        throw error;
    }
    return data as ProductCategory;
}

export async function updateCategory(id: string, name: string) {
    const supabase = createClient();
    const { data, error } = await supabase
        .from('product_categories')
        .update({ name })
        .eq('id', id)
        .select()
        .single();

    if (error) {
        if (error.code === '23505') {
            throw new Error("Já existe uma categoria com este nome.");
        }
        // Handle "PGRST116" which means no rows returned (RLS blocked or not found)
        if (error.code === 'PGRST116') {
            throw new Error("Categoria não encontrada ou permissão negada (Global?).");
        }
        throw error;
    }
    return data as ProductCategory;
}

export async function deleteCategory(id: string) {
    const supabase = createClient();
    const { data, error } = await supabase
        .from('product_categories')
        .delete()
        .eq('id', id)
        .select();

    if (error) throw error;
    if (!data || data.length === 0) {
        throw new Error("Impossível excluir: Categoria Global ou já excluída.");
    }
}
