import { createClient } from "@/utils/supabase/server";

export interface PackagingType {
    id: string;
    company_id?: string | null;
    name: string;
    code: string;
    is_active: boolean;
    sort_order: number;
    usage_count?: number;
}

export async function getPackagingTypes(companyId: string, search?: string): Promise<PackagingType[]> {
    const supabase = await createClient();

    let query = supabase
        .from('packaging_types')
        .select('*')
        .or(`company_id.eq.${companyId},company_id.is.null`)
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });

    if (search) {
        query = query.or(`name.ilike.%${search}%,code.ilike.%${search}%`);
    }

    const { data, error } = await query;

    if (error) {
        console.error("Error fetching Packaging Types:", error);
        return [];
    }

    return data as PackagingType[];
}

export async function getAllPackagingTypesIncludingInactive(companyId: string): Promise<PackagingType[]> {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('packaging_types')
        .select('*')
        .or(`company_id.eq.${companyId},company_id.is.null`)
        .order('name', { ascending: true });

    if (error) {
        console.error("Error fetching all Packaging Types:", error);
        return [];
    }

    return data as PackagingType[];
}

export async function createPackagingType(type: Partial<PackagingType>): Promise<PackagingType | null> {
    const supabase = await createClient();

    if (!type.company_id) {
        throw new Error("Company ID is required");
    }

    const { data, error } = await supabase
        .from('packaging_types')
        .insert([{
            company_id: type.company_id,
            name: type.name,
            code: type.code?.toUpperCase(),
            is_active: type.is_active !== undefined ? type.is_active : true
        }])
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function updatePackagingType(id: string, updates: Partial<PackagingType>): Promise<PackagingType | null> {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('packaging_types')
        .update({
            name: updates.name,
            code: updates.code?.toUpperCase(),
            is_active: updates.is_active,
            updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function deletePackagingType(id: string): Promise<void> {
    const supabase = await createClient();

    // First get the code to check usage
    const { data: typeData, error: fetchError } = await supabase.from('packaging_types').select('code').eq('id', id).single();
    if (fetchError || !typeData) throw new Error("Tipo não encontrado");

    // Check usage by code string
    const { count, error: countError } = await supabase
        .from('item_packaging')
        .select('*', { count: 'exact', head: true })
        .eq('type', typeData.code);

    if (countError) throw countError;
    if (count && count > 0) {
        throw new Error(`Este tipo de embalagem está em uso por ${count} produto(s) e não pode ser excluído.`);
    }

    const { error } = await supabase
        .from('packaging_types')
        .delete()
        .eq('id', id);

    if (error) throw error;
}
