"use server";

import { createClient } from "@/utils/supabase/server";
import { getCfops } from "@/lib/data/cfops";
import { CfopDTO } from "@/lib/types/fiscal-types";

// ============================================================================
// TYPES
// ============================================================================
export type ActionResult<T = void> =
    | { success: true; data: T }
    | { success: false; error: string };

// ============================================================================
// ACTIONS
// ============================================================================

export async function listCfopsAction(): Promise<ActionResult<CfopDTO[]>> {
    try {
        const supabase = await createClient();
        // CFOPs are global usually, but we check if getCfops needs companyId?
        // Checking getCfops signature: getCfops(supabase) -> no companyId.
        // It filters by active=true.

        const data = await getCfops(supabase);
        return { success: true, data: data };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}
