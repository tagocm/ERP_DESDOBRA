"use server";

import { createClient } from "@/utils/supabase/server";
import { getActiveCompanyId } from "@/lib/auth/get-active-company";
import { getTaxGroups } from "@/lib/data/tax-groups";
import { TaxGroupDTO } from "@/lib/types/fiscal-types";
import { z } from "zod";

// ============================================================================
// TYPES
// ============================================================================
export type ActionResult<T = void> =
    | { success: true; data: T }
    | { success: false; error: string };

// Usa getActiveCompanyId (company_members) para suportar membros que não são owners
const getCompanyId = getActiveCompanyId;

// ============================================================================
// ACTIONS
// ============================================================================

const ListTaxGroupsSchema = z.object({
    onlyActive: z.boolean().optional().default(true),
    companyId: z.string().uuid().optional(),
});

export async function listTaxGroupsAction(
    input?: z.infer<typeof ListTaxGroupsSchema>
): Promise<ActionResult<TaxGroupDTO[]>> {
    try {
        const validated = input ? ListTaxGroupsSchema.parse(input) : { onlyActive: true };
        const companyId = validated.companyId || await getCompanyId();
        const supabase = await createClient();

        const data = await getTaxGroups(supabase, companyId, validated.onlyActive);
        return { success: true, data };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}
