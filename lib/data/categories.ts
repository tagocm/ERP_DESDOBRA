
import { createClient } from "@/lib/supabaseBrowser";
import { ProductCategory } from "@/types/product";

export async function getCategories() {
    const supabase = createClient();
    const { data, error } = await supabase
        .from('product_categories')
        .select(`
            id, 
            name, 
            normalized_name,
            items (count)
        `)
        .order('name');

    if (error) throw error;

    // Map count
    return data.map((d: any) => ({
        ...d,
        product_count: d.items?.[0]?.count || 0
    })) as ProductCategory[];
}

export async function createCategory(name: string) {
    const supabase = createClient();
    const { data, error } = await supabase
        .from('product_categories')
        .insert({ name })
        .select()
        .single();

    if (error) {
        // Handle duplicate normalized_name specifically if needed, likely a 23505 unique_violation
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
        throw error;
    }
    return data as ProductCategory;
}

export async function deleteCategory(id: string) {
    const supabase = createClient();
    const { error } = await supabase
        .from('product_categories')
        .delete()
        .eq('id', id);

    if (error) throw error;
}
