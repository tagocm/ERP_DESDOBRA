"use server";

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import { getActiveCompanyId } from '@/lib/auth/get-active-company';
import {
    getPaymentTerms,
    getPaymentTerm,
    upsertPaymentTerm,
    deletePaymentTerm
} from '@/lib/data/company-settings';

// ============================================================================
// COMPONENTS
// ============================================================================
export type ActionResult<T = void> =
    | { success: true; data: T }
    | { success: false; error: string };

// Usa getActiveCompanyId (company_members) para suportar membros que não são owners
const getCompanyId = getActiveCompanyId;

// ============================================================================
// SCHEMAS
// ============================================================================
const PaymentTermSchema = z.object({
    id: z.string().optional(),
    name: z.string().min(1, "Nome é obrigatório"),
    installments_count: z.number().int().min(1, "Mínimo 1 parcela"),
    first_due_days: z.number().int().min(0, "Dias para 1ª parcela inválido"),
    cadence_days: z.number().int().min(0).nullable().optional(),
    min_installment_amount: z.number().min(0).nullable().optional(),
    is_custom_name: z.boolean().default(false),
    is_active: z.boolean().default(true)
});

// ============================================================================
// ACTIONS
// ============================================================================

export async function getPaymentTermsAction(): Promise<ActionResult<any[]>> {
    try {
        const companyId = await getCompanyId();
        const supabase = await createClient();
        const data = await getPaymentTerms(supabase, companyId);
        return { success: true, data: data || [] };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function getPaymentTermAction(id: string): Promise<ActionResult<any>> {
    try {
        await getCompanyId(); // Auth check
        const supabase = await createClient();
        const data = await getPaymentTerm(supabase, id);
        return { success: true, data };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function upsertPaymentTermAction(data: z.infer<typeof PaymentTermSchema>): Promise<ActionResult<any>> {
    try {
        const companyId = await getCompanyId();
        const supabase = await createClient();

        const validated = PaymentTermSchema.parse(data);

        const result = await upsertPaymentTerm(supabase, {
            ...validated,
            company_id: companyId
        });

        revalidatePath('/app/configuracoes/empresa');
        return { success: true, data: result };
    } catch (e: any) {
        if (e instanceof z.ZodError) {
            return { success: false, error: (e as any).errors.map((err: any) => err.message).join(', ') };
        }
        return { success: false, error: e.message };
    }
}

export async function deletePaymentTermAction(id: string): Promise<ActionResult<void>> {
    try {
        await getCompanyId();
        const supabase = await createClient();

        await deletePaymentTerm(supabase, id);

        revalidatePath('/app/configuracoes/empresa');
        return { success: true, data: undefined };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}
