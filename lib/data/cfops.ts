
import { SupabaseClient } from "@supabase/supabase-js";

import { CfopDTO } from "@/lib/types/fiscal-types";
export type { CfopDTO };

export async function getCfops(supabase: SupabaseClient) {
    const { data, error } = await supabase
        .from('cfop')
        .select('*')
        .eq('ativo', true)
        .order('codigo', { ascending: true });

    if (error) {
        console.error('Error fetching CFOPs:', error);
        return [];
    }

    return data as CfopDTO[];
}
