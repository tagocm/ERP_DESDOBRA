"use server";

import { createClient } from "@/utils/supabase/server";
import { CfopDTO } from "@/lib/types/products-dto";

export type ActionResult<T = void> =
    | { success: true; data: T }
    | { success: false; error: string };

export async function listCfopsAction(): Promise<ActionResult<CfopDTO[]>> {
    const supabase = await createClient();

    // CFOPs might be public/system data, so maybe no company check needed? 
    // But usually we respect RLS.
    // The original getCfops didn't take company_id, just supabase client.

    try {
        const { data, error } = await supabase
            .from('cfops')
            .select('*')
            .order('code');

        if (error) {
            console.error("Error fetching CFOPs:", error);
            return { success: false, error: "Erro ao carregar CFOPs" };
        }

        return { success: true, data: (data as CfopDTO[]) || [] };
    } catch (e) {
        console.error("Unexpected error in listCfopsAction:", e);
        return { success: false, error: "Erro inesperado" };
    }
}
