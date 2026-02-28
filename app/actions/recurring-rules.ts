'use server'

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import { getActiveCompanyId } from '@/lib/auth/get-active-company';
import { RecurringRuleStatus } from '@/types/recurring-rules';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { RecurringRule } from '@/types/recurring-rules';

function resolveActionErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message) return error.message;
    if (typeof error === 'object' && error !== null) {
        const maybeMessage = (error as { message?: unknown }).message;
        if (typeof maybeMessage === 'string' && maybeMessage.trim().length > 0) {
            return maybeMessage;
        }
    }
    return 'Unknown error';
}

function isMissingColumnError(error: unknown, columnName: string): boolean {
    if (typeof error !== 'object' || error === null) return false;
    const maybeCode = (error as { code?: unknown }).code;
    const maybeMessage = (error as { message?: unknown }).message;
    const message = typeof maybeMessage === 'string' ? maybeMessage.toLowerCase() : '';
    return (
        maybeCode === '42703'
        || maybeCode === 'PGRST204'
        || maybeCode === 'PGRST205'
        || message.includes(`could not find the '${columnName.toLowerCase()}' column`)
        || message.includes(`could not find the column '${columnName.toLowerCase()}'`)
        || message.includes(`column "${columnName.toLowerCase()}" does not exist`)
    );
}

const COMPAT_OPTIONAL_COLUMNS = [
    'frequency',
    'payment_mode_id',
    'contract_amount',
    'estimated_amount',
    'manual_installments',
] as const;

function hasAnyMissingColumnError(error: unknown): boolean {
    return COMPAT_OPTIONAL_COLUMNS.some((columnName) => isMissingColumnError(error, columnName));
}

function removeMissingColumnsFromPayload(
    payload: Record<string, unknown>,
    error: unknown
): Record<string, unknown> {
    const nextPayload = { ...payload };
    for (const columnName of COMPAT_OPTIONAL_COLUMNS) {
        if (isMissingColumnError(error, columnName)) {
            delete nextPayload[columnName];
        }
    }
    // Defensive fallback for schema-cache incompatibilities:
    // if PostgREST cache is stale and points to missing columns, strip all optional compat fields.
    if (typeof error === 'object' && error !== null) {
        const maybeMessage = (error as { message?: unknown }).message;
        const message = typeof maybeMessage === 'string' ? maybeMessage.toLowerCase() : '';
        if (message.includes('schema cache')) {
            for (const columnName of COMPAT_OPTIONAL_COLUMNS) {
                delete nextPayload[columnName];
            }
        }
    }
    return nextPayload;
}

function buildRecurringRulePayload(data: CreateRecurringRuleInput, companyId: string) {
    return {
        company_id: companyId,
        name: data.name,
        partner_name: data.partner_name,
        partner_id: data.partner_id || null,
        payment_mode_id: data.payment_mode_id || null,
        category_id: data.category_id,
        cost_center_id: data.cost_center_id || null,
        description: data.description || null,
        valid_from: data.valid_from,
        valid_to: data.valid_to || null,
        generation_mode: data.generation_mode,
        billing_plan_type: data.billing_plan_type || null,
        first_due_date: data.first_due_date || null,
        installments_count: data.installments_count || null,
        amount_type: data.amount_type,
        fixed_amount: data.fixed_amount || null,
        contract_amount: data.contract_amount || null,
        estimated_amount: data.estimated_amount || null,
        manual_installments: data.generation_mode === 'MANUAL' ? data.manual_installments : [],
        status: 'ATIVO' as const,
        updated_at: new Date().toISOString(),
    };
}

type InstallmentSeed = {
    installmentNumber: number;
    dueDate: string;
    amount: number;
};

function normalizeDate(value: string | null | undefined): string | null {
    if (!value) return null;
    const trimmed = value.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
    return trimmed;
}

function buildSeedInstallments(input: CreateRecurringRuleInput): InstallmentSeed[] {
    if (input.generation_mode === 'MANUAL') {
        const manual = (input.manual_installments || [])
            .map((item, index) => ({
                installmentNumber: Number(item.installment_number || index + 1),
                dueDate: normalizeDate(item.due_date) || '',
                amount: Number(item.amount || 0),
            }))
            .filter((item) => item.dueDate && item.amount > 0)
            .sort((a, b) => a.installmentNumber - b.installmentNumber);

        return manual;
    }

    const dueDate = normalizeDate(input.first_due_date) || normalizeDate(input.valid_from);
    if (!dueDate) return [];

    const fixedAmount = Number(input.fixed_amount || 0);
    const contractAmount = Number(input.contract_amount || 0);
    const estimatedAmount = Number(input.estimated_amount || 0);
    const amount = input.amount_type === 'FIXO'
        ? Math.max(fixedAmount, contractAmount)
        : estimatedAmount;

    if (amount <= 0) return [];

    return [{ installmentNumber: 1, dueDate, amount }];
}

async function seedInitialFinancialEventFromRecurringRule(
    supabase: Awaited<ReturnType<typeof createClient>>,
    companyId: string,
    recurringRuleId: string,
    input: CreateRecurringRuleInput
): Promise<void> {
    const installments = buildSeedInstallments(input);
    if (installments.length === 0) return;

    const issueDate = installments[0].dueDate;
    const totalAmount = installments.reduce((sum, item) => sum + item.amount, 0);
    if (totalAmount <= 0) return;

    const { data: categoryData, error: categoryError } = await supabase
        .from('financial_categories')
        .select('expense_account_id')
        .eq('id', input.category_id)
        .maybeSingle();

    if (categoryError) {
        throw categoryError;
    }

    const { data: bankAccounts, error: bankAccountsError } = await supabase
        .from('company_bank_accounts')
        .select('id, is_default')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: true })
        .limit(1);

    if (bankAccountsError) {
        throw bankAccountsError;
    }

    const defaultFinancialAccountId = bankAccounts?.[0]?.id ?? null;

    let paymentModeName: string | null = null;
    if (input.payment_mode_id) {
        const { data: paymentModeData, error: paymentModeError } = await supabase
            .from('payment_modes')
            .select('name')
            .eq('id', input.payment_mode_id)
            .maybeSingle();

        if (paymentModeError) {
            throw paymentModeError;
        }
        paymentModeName = paymentModeData?.name || null;
    }

    const { data: eventData, error: eventError } = await supabase
        .from('financial_events')
        .insert({
            company_id: companyId,
            origin_type: 'MANUAL',
            origin_id: recurringRuleId,
            origin_reference: `Fato gerador: ${input.name}`,
            partner_id: input.partner_id || null,
            partner_name: input.partner_name,
            direction: 'AP',
            issue_date: issueDate,
            total_amount: totalAmount,
            status: 'pending',
            notes: `Gerado automaticamente pelo fato gerador: ${input.name}`,
            operational_status: 'pending',
        })
        .select('id')
        .single();

    if (eventError) {
        if ((eventError as { code?: string }).code === '23505') {
            return;
        }
        throw eventError;
    }

    const { error: installmentError } = await supabase
        .from('financial_event_installments')
        .insert(
            installments.map((item) => ({
                event_id: eventData.id,
                installment_number: item.installmentNumber,
                due_date: item.dueDate,
                amount: item.amount,
                payment_condition: 'Fato gerador',
                payment_method: paymentModeName,
                suggested_account_id: categoryData?.expense_account_id || null,
                category_id: input.category_id || null,
                cost_center_id: input.cost_center_id || null,
                financial_account_id: defaultFinancialAccountId,
                notes: null,
            }))
        );

    if (installmentError) {
        throw installmentError;
    }
}

const CreateRecurringRuleSchema = z.object({
    name: z.string().min(3, "Nome muito curto"),
    partner_name: z.string().min(3, "Fornecedor obrigatório"),
    partner_id: z.string().optional().nullable(),
    payment_mode_id: z.string().uuid("Forma de pagamento inválida").optional().nullable(),
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
    contract_amount: z.number().optional().nullable(),
    estimated_amount: z.number().optional().nullable(),

    status: z.enum(['ATIVO', 'RASCUNHO']).default('ATIVO'),
    manual_installments: z.array(
        z.object({
            installment_number: z.coerce.number().int().positive("Número da parcela deve ser maior que zero"),
            due_date: z.string().min(1, "Data da parcela obrigatória"),
            amount: z.number().positive("Valor da parcela deve ser maior que zero"),
        })
    ).optional().default([]),
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
    if (data.generation_mode === 'AUTOMATICO' && data.amount_type === 'FIXO') {
        const recurring = Number(data.fixed_amount || 0);
        const contract = Number(data.contract_amount || 0);
        if (recurring > 0 || contract > 0) return true;
        return false;
    }
    return true;
}, {
    message: "No modo automático, preencha o Valor Recorrente ou o Valor do Contrato",
    path: ["fixed_amount"]
}).refine(data => {
    if (data.generation_mode === 'MANUAL') {
        return (data.manual_installments?.length || 0) > 0;
    }
    return true;
}, {
    message: "Adicione ao menos uma parcela no modo manual",
    path: ["manual_installments"]
});

export type CreateRecurringRuleInput = z.infer<typeof CreateRecurringRuleSchema>;

export async function getRecurringRuleByIdAction(id: string) {
    try {
        const supabase = await createClient();
        const companyId = await getActiveCompanyId();

        if (!companyId) return { error: 'Empresa não encontrada' };
        if (!id) return { error: 'ID do fato gerador não informado' };

        const { data, error } = await supabase
            .from('recurring_rules')
            .select('*')
            .eq('id', id)
            .eq('company_id', companyId)
            .maybeSingle();

        if (error) throw error;
        if (!data) return { error: 'Fato gerador não encontrado' };

        return { success: true, data: data as RecurringRule };
    } catch (error: unknown) {
        const message = resolveActionErrorMessage(error);
        logger.error('[recurring-rules/get-by-id] Error', { message });
        return { error: message };
    }
}

export async function createRecurringRuleAction(input: CreateRecurringRuleInput) {
    try {
        const result = CreateRecurringRuleSchema.safeParse(input);
        if (!result.success) {
            return { error: result.error.issues[0].message };
        }

        const supabase = await createClient();
        const companyId = await getActiveCompanyId();

        if (!companyId) return { error: 'Empresa não encontrada' };

        const basePayload = buildRecurringRulePayload(result.data, companyId);

        const payloadWithFrequency = {
            ...basePayload,
            frequency: result.data.frequency,
        };

        const insertResult = await supabase
            .from('recurring_rules')
            .insert(payloadWithFrequency)
            .select('id')
            .single();

        let recurringRuleId: string | null = insertResult.data?.id ?? null;

        if (insertResult.error && hasAnyMissingColumnError(insertResult.error)) {
            const legacyPayload = removeMissingColumnsFromPayload(payloadWithFrequency as Record<string, unknown>, insertResult.error);
            const fallbackResult = await supabase
                .from('recurring_rules')
                .insert(legacyPayload)
                .select('id')
                .single();
            if (fallbackResult.error) throw fallbackResult.error;
            recurringRuleId = fallbackResult.data?.id ?? null;
        } else if (insertResult.error) {
            throw insertResult.error;
        }

        if (!recurringRuleId) {
            throw new Error('Não foi possível identificar o fato gerador criado.');
        }

        await seedInitialFinancialEventFromRecurringRule(supabase, companyId, recurringRuleId, result.data);

        revalidatePath('/app/financeiro/fatos-geradores');
        revalidatePath('/app/financeiro/aprovacao');
        return { success: true };
    } catch (error: unknown) {
        const message = resolveActionErrorMessage(error);
        logger.error('[recurring-rules/create] Error', { message });
        return { error: message };
    }
}

export async function updateRecurringRuleAction(id: string, input: CreateRecurringRuleInput) {
    try {
        const result = CreateRecurringRuleSchema.safeParse(input);
        if (!result.success) {
            return { error: result.error.issues[0].message };
        }

        const supabase = await createClient();
        const companyId = await getActiveCompanyId();
        if (!companyId) return { error: 'Empresa não encontrada' };

        const basePayload = buildRecurringRulePayload(result.data, companyId);
        const payloadWithFrequency = {
            ...basePayload,
            frequency: result.data.frequency,
        };

        const updateResult = await supabase
            .from('recurring_rules')
            .update(payloadWithFrequency)
            .eq('id', id)
            .eq('company_id', companyId);

        if (updateResult.error && hasAnyMissingColumnError(updateResult.error)) {
            const legacyPayload = removeMissingColumnsFromPayload(payloadWithFrequency as Record<string, unknown>, updateResult.error);
            const fallbackResult = await supabase
                .from('recurring_rules')
                .update(legacyPayload)
                .eq('id', id)
                .eq('company_id', companyId);
            if (fallbackResult.error) throw fallbackResult.error;
        } else if (updateResult.error) {
            throw updateResult.error;
        }

        revalidatePath('/app/financeiro/fatos-geradores');
        revalidatePath('/app/financeiro/aprovacao');
        return { success: true };
    } catch (error: unknown) {
        const message = resolveActionErrorMessage(error);
        logger.error('[recurring-rules/update] Error', { message });
        return { error: message };
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
    } catch (error: unknown) {
        const message = resolveActionErrorMessage(error);
        logger.error('[recurring-rules/update-status] Error', { message });
        return { error: message };
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
    } catch (error: unknown) {
        const message = resolveActionErrorMessage(error);
        logger.error('[recurring-rules/delete] Error', { message });
        return { error: message };
    }
}
