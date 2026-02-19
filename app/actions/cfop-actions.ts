"use server";

import { createClient } from "@/utils/supabase/server";
import { CfopDTO } from "@/lib/types/products-dto";
import { getCfops } from "@/lib/data/cfops";

export type ActionResult<T = void> =
    | { success: true; data: T }
    | { success: false; error: string };

export async function listCfopsAction(): Promise<ActionResult<CfopDTO[]>> {
    const supabase = await createClient();

    try {
        const data = await getCfops(supabase);
        return { success: true, data: (data as CfopDTO[]) || [] };
    } catch (e) {
        console.error("Unexpected error in listCfopsAction:", e);
        return { success: false, error: "Erro inesperado" };
    }
}
