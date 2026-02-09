"use server";

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import {
    getDeliveryReasons,
    upsertDeliveryReason,
    deleteDeliveryReason
} from '@/lib/data/reasons';
import { DeliveryReasonGroup } from '@/types/reasons';

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
// SCHEMAS
// ============================================================================
const ReasonSchema = z.object({
    id: z.string().optional(),
    name: z.string().min(1, "Nome é obrigatório"),
    reason_group: z.enum([
        'EXPEDICAO_CARREGADO_PARCIAL',
        'EXPEDICAO_NAO_CARREGADO',
        'RETORNO_ENTREGA_PARCIAL',
        'RETORNO_NAO_ENTREGUE'
    ]),
    is_active: z.boolean().default(true),
    require_note: z.boolean().optional()
});

// ============================================================================
// ACTIONS
// ============================================================================

export async function getDeliveryReasonsAction(group?: DeliveryReasonGroup): Promise<ActionResult<any[]>> {
    try {
        const companyId = await getCompanyId();
        const supabase = await createClient();
        const data = await getDeliveryReasons(supabase, companyId, group);
        return { success: true, data: data || [] };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function upsertDeliveryReasonAction(data: z.infer<typeof ReasonSchema>): Promise<ActionResult<any>> {
    try {
        const companyId = await getCompanyId(); // Auth Check
        const supabase = await createClient();

        const validated = ReasonSchema.parse(data);

        // Map to Partial<DeliveryReason> expected by data layer
        const result = await upsertDeliveryReason(supabase, {
            ...validated,
            company_id: companyId // Enforce tenant ownership
        });

        revalidatePath('/app/configuracoes/motivos');
        return { success: true, data: result };
    } catch (e: any) {
        if (e instanceof z.ZodError) {
            return { success: false, error: (e as any).errors.map((err: any) => err.message).join(', ') };
        }
        return { success: false, error: e.message };
    }
}

export async function deleteDeliveryReasonAction(id: string): Promise<ActionResult<void>> {
    try {
        await getCompanyId();
        const supabase = await createClient();

        await deleteDeliveryReason(supabase, id);

        revalidatePath('/app/configuracoes/motivos');
        return { success: true, data: undefined };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}
