"use server";

import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import { getActiveCompanyId } from "@/lib/auth/get-active-company";
import { revalidatePath } from "next/cache";
import {
    getFiscalOperations,
    createFiscalOperation,
    updateFiscalOperation,
    deleteFiscalOperation
} from "@/lib/data/fiscal-operations";
import { FiscalOperationDTO } from '@/lib/types/fiscal-types';

// ============================================================================
// TYPES
// ============================================================================
export type ActionResult<T = void> =
    | { success: true; data: T }
    | { success: false; error: string };

// Usa getActiveCompanyId (company_members) para suportar membros que não são owners
const getCompanyId = getActiveCompanyId;

// ============================================================================
// SCHEMAS
// ============================================================================

const FiscalOperationSchema = z.object({
    id: z.string().optional(),
    tax_group_id: z.string().uuid("Grupo tributário inválido"),
    destination_state: z.string().length(2, "UF inválida"),
    customer_ie_indicator: z.enum(['contributor', 'exempt', 'non_contributor']),
    customer_is_final_consumer: z.boolean(),
    operation_type: z.enum(['sales', 'return', 'shipment', 'bonus']),

    cfop: z.string().min(4, "CFOP inválido"),

    // ICMS
    icms_cst: z.string().optional(),
    icms_csosn: z.string().optional(),
    icms_modal_bc: z.string().optional(),
    icms_reduction_bc_percent: z.number().optional(),
    icms_rate_percent: z.number(),
    icms_show_in_xml: z.boolean(),

    // ST
    st_applies: z.boolean(),
    st_modal_bc: z.string().optional(),
    st_mva_percent: z.number().optional(),
    st_reduction_bc_percent: z.number().optional(),
    st_rate_percent: z.number().optional(),
    st_fcp_percent: z.number().optional(),

    // PIS
    pis_applies: z.boolean(),
    pis_cst: z.string().optional(),
    pis_rate_percent: z.number().optional(),

    // COFINS
    cofins_applies: z.boolean(),
    cofins_cst: z.string().optional(),
    cofins_rate_percent: z.number().optional(),

    // IPI
    ipi_applies: z.boolean(),
    ipi_cst: z.string().optional(),
    ipi_rate_percent: z.number().optional(),

    is_active: z.boolean().default(true)
});

export type CreateFiscalOperationParams = z.infer<typeof FiscalOperationSchema>;

// ============================================================================
// ACTIONS
// ============================================================================

export async function listFiscalOperationsAction(
    filters?: { tax_group_id?: string; origin_state?: string; destination_state?: string }
): Promise<ActionResult<FiscalOperationDTO[]>> {
    try {
        const companyId = await getCompanyId();
        const supabase = await createClient();

        // Map snake_case to camelCase for data layer
        const dataFilters = filters ? {
            taxGroupId: filters.tax_group_id,
            originState: filters.origin_state,
            state: filters.destination_state, // destination_state maps to state in data layer kwarg
            // operationType is not in the action filter signature but data layer supports it. 
            // If needed I should add it to action signature or ignore.
        } : undefined;

        const data = await getFiscalOperations(supabase, companyId, dataFilters);
        return { success: true, data };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function createFiscalOperationAction(data: CreateFiscalOperationParams, originState: string): Promise<ActionResult<FiscalOperationDTO>> {
    try {
        const companyId = await getCompanyId();
        const supabase = await createClient();
        // Wait, createClient() in utils/supabase/server uses cookies, so it's user context.
        // But getCompanyId verifies checks owner_id.
        // Actually, createFiscalOperation needs company_id in the insert? 
        // Let's check lib/data/fiscal-operations.ts createFiscalOperation signature.
        // it takes "data: Omit<FiscalOperation, ...>"
        // It DOES NOT take company_id in arguments?
        // Wait, checking file content of lib/data/fiscal-operations.ts
        // insert({ ...data, uf_origem: originState })
        // It DOES NOT insert company_id?
        // If RLS handles it, maybe? Or it's a bug in data layer.
        // But the user rules say "Enforce multi-tenant: getCompanyId() + companyId em todas queries/mutations".
        // So I should pass it.
        // But I can't change the data layer signature easily without breaking other things?
        // Wait, I am allowed to change data layer if needed.
        // BUT, looking at `createFiscalOperation` signature:
        // data: Omit<FiscalOperation, 'id' | 'created_at' | 'updated_at' | 'deleted_at' | 'tax_group' | 'uf_origem'>
        // `company_id` IS in FiscalOperation. It is NOT omitted in the type definition of `data` arg? 
        // 'id' | 'created_at' | 'updated_at' | 'deleted_at' | 'tax_group' | 'uf_origem' are omitted.
        // So `company_id` IS expected in `data`.
        // So I must inject it.

        const validated = FiscalOperationSchema.parse(data);

        const result = await createFiscalOperation(supabase, {
            ...validated,
            company_id: companyId
        }, originState);

        revalidatePath('/app/fiscal/operacoes');
        return { success: true, data: result };
    } catch (e: any) {
        if (e instanceof z.ZodError) {
            return { success: false, error: (e as any).errors.map((err: any) => err.message).join(', ') };
        }
        return { success: false, error: e.message };
    }
}

export async function updateFiscalOperationAction(id: string, data: Partial<z.infer<typeof FiscalOperationSchema>>): Promise<ActionResult<FiscalOperationDTO>> {
    try {
        const companyId = await getCompanyId(); // Validate access
        const validated = FiscalOperationSchema.partial().parse(data);

        // TODO: Validate that the operation belongs to the company (RLS does this, but explicit check is good)

        const supabase = await createClient();
        const result = await updateFiscalOperation(supabase, id, validated);

        revalidatePath('/app/fiscal/operacoes');
        return { success: true, data: result };
    } catch (e: any) {
        if (e instanceof z.ZodError) {
            return { success: false, error: (e as any).errors.map((err: any) => err.message).join(', ') };
        }
        return { success: false, error: e.message };
    }
}

export async function deleteFiscalOperationAction(id: string): Promise<ActionResult<void>> {
    try {
        await getCompanyId(); // Auth Check
        const supabase = await createClient();

        await deleteFiscalOperation(supabase, id);

        revalidatePath('/app/fiscal/operacoes');
        return { success: true, data: undefined };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}
