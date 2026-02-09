"use server";

import { createClient } from "@/utils/supabase/server";
import { getTaxGroups } from "@/lib/data/tax-groups";
import { TaxGroupDTO } from "@/lib/types/fiscal-types";
import { z } from "zod";

// ============================================================================
// TYPES
// ============================================================================
export type ActionResult<T = void> =
    | { success: true; data: T }
    | { success: false; error: string };

async function getCompanyId(): Promise<string> {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) throw new Error('Usuário não autenticado');

    const { data: companies, error: companyError } = await supabase
        .from('companies')
        .select('id')
        .eq('owner_id', user.id)
        .single();

    if (companyError || !companies) throw new Error('Empresa não encontrada');

    return companies.id;
}

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
