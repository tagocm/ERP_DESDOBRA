'use server'

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import { getActiveCompanyId } from '@/lib/auth/get-active-company';
import { RecurringRuleStatus } from '@/types/recurring-rules';
import { z } from 'zod';

const CreateRecurringRuleSchema = z.object({
    name: z.string().min(3, "Nome muito curto"),
    partner_name: z.string().min(3, "Fornecedor obrigatório"),
    partner_id: z.string().optional().nullable(),
    category_id: z.string().min(1, "Categoria obrigatória"),
    cost_center_id: z.string().optional().nullable(),
    description: z.string().optional().nullable(),

    // Validity
    valid_from: z.string().min(1, "Início da vigência obrigatório"),
    valid_to: z.string().optional().nullable().or(z.literal('')),

    // Billing
    generation_mode: z.enum(['AUTOMATICO', 'MANUAL']),
    billing_plan_type: z.enum(['RECORRENTE', 'PARCELADO']).optional().nullable(),
    first_due_date: z.string().optional().nullable().or(z.literal('')),
    installments_count: z.coerce.number().optional().nullable(),
    frequency: z.string().default('MENSAL'),

    // Values
    amount_type: z.enum(['FIXO', 'VARIAVEL']),
    fixed_amount: z.number().optional().nullable(),
    estimated_amount: z.number().optional().nullable(),

    status: z.enum(['ATIVO', 'RASCUNHO']),
}).refine(data => {
    if (data.valid_to && data.valid_to < data.valid_from) return false;
    return true;
}, {
    message: "Fim da vigência deve ser posterior ao início",
    path: ["valid_to"]
}).refine(data => {
    if (data.generation_mode === 'AUTOMATICO') {
        return !!data.billing_plan_type && !!data.first_due_date;
    }
    return true;
}, {
    message: "Para modo automático, plano e data do 1º vencimento são obrigatórios",
    path: ["generation_mode"]
}).refine(data => {
    if (data.billing_plan_type === 'PARCELADO' && (!data.installments_count || data.installments_count <= 0)) {
        return false;
    }
    return true;
}, {
    message: "Quantidade de lançamentos deve ser maior que zero",
    path: ["installments_count"]
}).refine(data => {
    if (data.amount_type === 'FIXO' && (!data.fixed_amount || data.fixed_amount <= 0)) {
        return false;
    }
    return true;
}, {
    message: "Valor fixo obrigatório para contratos fixos",
    path: ["fixed_amount"]
});

export type CreateRecurringRuleInput = z.infer<typeof CreateRecurringRuleSchema>;

export async function createRecurringRuleAction(input: CreateRecurringRuleInput) {
    try {
        const result = CreateRecurringRuleSchema.safeParse(input);
        if (!result.success) {
            return { error: result.error.issues[0].message };
        }

        const supabase = await createClient();
        const companyId = await getActiveCompanyId();

        if (!companyId) return { error: 'Empresa não encontrada' };

        const { error } = await supabase
            .from('recurring_rules')
            .insert({
                company_id: companyId,
                name: result.data.name,
                partner_name: result.data.partner_name,
                partner_id: result.data.partner_id || null,
                category_id: result.data.category_id,
                cost_center_id: result.data.cost_center_id || null,
                description: result.data.description || null,
                valid_from: result.data.valid_from,
                valid_to: result.data.valid_to || null,
                generation_mode: result.data.generation_mode,
                billing_plan_type: result.data.billing_plan_type || null,
                first_due_date: result.data.first_due_date || null,
                installments_count: result.data.installments_count || null,
                frequency: result.data.frequency,
                amount_type: result.data.amount_type,
                fixed_amount: result.data.fixed_amount || null,
                estimated_amount: result.data.estimated_amount || null,
                status: result.data.status,
                updated_at: new Date().toISOString()
            });

        if (error) throw error;

        revalidatePath('/app/financeiro/fatos-geradores');
        return { success: true };
    } catch (error: any) {
        console.error('Error creating recurring rule:', error);
        return { error: error.message };
    }
}

export async function updateRecurringRuleStatusAction(id: string, status: RecurringRuleStatus) {
    try {
        const supabase = await createClient();
        const companyId = await getActiveCompanyId();

        if (!companyId) return { error: 'Empresa não encontrada' };

        const { error } = await supabase
            .from('recurring_rules')
            .update({ status, updated_at: new Date().toISOString() })
            .eq('id', id)
            .eq('company_id', companyId);

        if (error) throw error;

        revalidatePath('/app/financeiro/fatos-geradores');
        return { success: true };
    } catch (error: any) {
        console.error('Error updating recurring rule status:', error);
        return { error: error.message };
    }
}

export async function deleteRecurringRuleAction(id: string) {
    try {
        const supabase = await createClient();
        const companyId = await getActiveCompanyId();

        if (!companyId) return { error: 'Empresa não encontrada' };

        // For now, simple delete if RASCUNHO
        // In real world, check for relations
        const { error } = await supabase
            .from('recurring_rules')
            .delete()
            .eq('id', id)
            .eq('company_id', companyId)
            .eq('status', 'RASCUNHO');

        if (error) throw error;

        revalidatePath('/app/financeiro/fatos-geradores');
        return { success: true };
    } catch (error: any) {
        console.error('Error deleting recurring rule:', error);
        return { error: error.message };
    }
}
