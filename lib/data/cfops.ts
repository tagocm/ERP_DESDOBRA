
import { createClient } from '@/lib/supabaseBrowser';

export interface Cfop {
    code: string;
    description: string;
    is_active: boolean;
}

export async function getCfops(search?: string): Promise<Cfop[]> {
    const supabase = createClient();
    let query = supabase
        .from('cfops')
        .select('*')
        .eq('is_active', true)
        .order('code');

    if (search) {
        query = query.or(`code.ilike.%${search}%,description.ilike.%${search}%`);
    }

    const { data, error } = await query;

    if (error) {
        console.error("Error fetching CFOPs:", error);
        throw error;
    }

    return data || [];
}
