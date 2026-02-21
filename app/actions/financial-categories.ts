'use server'

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import { getActiveCompanyId } from '@/lib/auth/get-active-company';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';

export interface FinancialCategory {
    id: string;
    company_id: string;
    name: string;
    description?: string;
    is_active: boolean;
    expense_account_id?: string | null;
    created_at?: string;
    updated_at?: string;
}

export interface OperationalExpenseParentAccount {
    id: string;
    code: string;
    name: string;
}

const financialCategoryRowSchema = z.object({
    id: z.string().uuid(),
    company_id: z.string().uuid(),
    name: z.string(),
    description: z.string().nullable().optional(),
    is_active: z.boolean().nullable().transform(v => v ?? true),
    expense_account_id: z.string().uuid().nullable().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
});

const operationalExpenseParentAccountRowSchema = z.object({
    id: z.string().uuid(),
    code: z.string(),
    name: z.string(),
});

const createFinancialCategoryInputSchema = z.object({
    name: z.string().min(3, 'Nome muito curto').max(100, 'Nome muito longo'),
    parent_account_id: z.string().uuid('Subcategoria inválida'),
});

export async function getFinancialCategoriesAction(companyId: string) {
    try {
        const supabase = await createClient();
        const { data, error } = await supabase
            .from('financial_categories')
            .select('*')
            .eq('company_id', companyId)
            .eq('is_active', true)
            .order('name');

        if (error) throw error;
        const parsed = z.array(financialCategoryRowSchema).safeParse(data ?? []);
        if (!parsed.success) return { error: 'Falha ao carregar categorias financeiras.' };
        return { data: parsed.data as FinancialCategory[] };
    } catch (error: unknown) {
        return { error: error instanceof Error ? error.message : 'Erro inesperado' };
    }
}

export async function getOperationalExpenseParentAccountsAction(companyId: string) {
    try {
        const supabase = await createClient();
        const activeCompanyId = await getActiveCompanyId();
        if (!activeCompanyId) return { error: 'Empresa não encontrada' };
        if (companyId !== activeCompanyId) return { error: 'Empresa inválida' };

        // Ensure chart spine exists (idempotent). We check for root "4".
        const { data: root, error: rootError } = await supabase
            .from('gl_accounts')
            .select('id')
            .eq('company_id', activeCompanyId)
            .eq('code', '4')
            .maybeSingle();

        if (rootError) throw rootError;

        if (!root?.id) {
            const admin = createAdminClient();
            const { error: seedError } = await admin.rpc('seed_chart_spine', {
                p_company_id: activeCompanyId,
            });
            if (seedError) throw new Error(seedError.message || 'Falha ao inicializar plano de contas.');
        }

        const { data, error } = await supabase
            .from('gl_accounts')
            .select('id, code, name')
            .eq('company_id', activeCompanyId)
            .eq('type', 'SINTETICA')
            .eq('nature', 'DESPESA')
            .or('code.eq.4,code.like.4.%')
            .order('code');

        if (error) throw error;

        const parsed = z.array(operationalExpenseParentAccountRowSchema).safeParse(data ?? []);
        if (!parsed.success) return { error: 'Falha ao carregar subcategorias do plano de contas.' };

        return { data: parsed.data as OperationalExpenseParentAccount[] };
    } catch (error: unknown) {
        return { error: error instanceof Error ? error.message : 'Erro inesperado' };
    }
}

export async function createFinancialCategoryAction(input: z.infer<typeof createFinancialCategoryInputSchema>) {
    try {
        const supabase = await createClient();
        const companyId = await getActiveCompanyId();
        if (!companyId) return { error: 'Empresa não encontrada' };

        const validated = createFinancialCategoryInputSchema.safeParse(input);
        if (!validated.success) {
            return { error: validated.error.issues[0]?.message ?? 'Dados inválidos.' };
        }

        const rpcRowSchema = z.object({
            category_id: z.string().uuid(),
            category_name: z.string(),
            account_id: z.string().uuid(),
            account_code: z.string(),
            is_active: z.boolean(),
        });

        const { data: rpcData, error: rpcError } = await supabase.rpc('create_financial_category_for_operational_expense', {
            p_company_id: companyId,
            p_parent_account_id: validated.data.parent_account_id,
            p_name: validated.data.name,
        });

        if (rpcError) {
            if (rpcError.code === '23505') {
                return { error: 'Já existe uma categoria financeira com este nome.' };
            }
            throw new Error(rpcError.message || 'Falha ao criar categoria e conta contábil.');
        }

        const parsedRows = z.array(rpcRowSchema).safeParse(rpcData);
        if (!parsedRows.success || parsedRows.data.length === 0) {
            return { error: 'Falha ao criar categoria e conta contábil.' };
        }

        const row = parsedRows.data[0];
        const created: FinancialCategory = {
            id: row.category_id,
            company_id: companyId,
            name: row.category_name,
            is_active: row.is_active,
            expense_account_id: row.account_id,
        };

        revalidatePath('/app/financeiro/fatos-geradores');
        return { data: created };
    } catch (error: unknown) {
        return { error: error instanceof Error ? error.message : 'Erro inesperado' };
    }
}

export async function updateFinancialCategoryAction(id: string, name: string) {
    try {
        const supabase = await createClient();
        const companyId = await getActiveCompanyId();
        if (!companyId) return { error: 'Empresa não encontrada' };

        const updateSchema = z.object({
            id: z.string().uuid(),
            name: z.string().min(3, 'Nome muito curto').max(100, 'Nome muito longo'),
        });

        const validated = updateSchema.safeParse({ id, name });
        if (!validated.success) {
            return { error: validated.error.issues[0]?.message ?? 'Dados inválidos.' };
        }

        const { data, error } = await supabase
            .from('financial_categories')
            .update({ name: validated.data.name.trim() })
            .eq('id', validated.data.id)
            .eq('company_id', companyId)
            .select()
            .single();

        if (error) {
            if (error.code === '23505') {
                return { error: "Já existe uma categoria financeira com este nome." };
            }
            throw error;
        }

        const parsed = financialCategoryRowSchema.safeParse(data);
        if (!parsed.success) return { error: 'Falha ao atualizar categoria.' };

        const updated = parsed.data as FinancialCategory;
        if (updated.expense_account_id) {
            const { error: accError } = await supabase
                .from('gl_accounts')
                .update({ name: updated.name })
                .eq('id', updated.expense_account_id)
                .eq('company_id', companyId);
            if (accError) throw accError;
        }

        revalidatePath('/app/financeiro/fatos-geradores');
        return { data: updated };
    } catch (error: unknown) {
        return { error: error instanceof Error ? error.message : 'Erro inesperado' };
    }
}

export async function deleteFinancialCategoryAction(id: string) {
    try {
        const supabase = await createClient();
        const companyId = await getActiveCompanyId();
        if (!companyId) return { error: 'Empresa não encontrada' };

        // Fetch linked account first
        const { data: existing, error: fetchError } = await supabase
            .from('financial_categories')
            .select('id, expense_account_id')
            .eq('id', id)
            .eq('company_id', companyId)
            .maybeSingle();

        if (fetchError) throw fetchError;
        if (!existing?.id) return { error: 'Categoria não encontrada' };

        const { error } = await supabase
            .from('financial_categories')
            .update({ deleted_at: new Date().toISOString(), is_active: false })
            .eq('id', id);

        if (error) throw error;

        if (existing.expense_account_id) {
            const { error: accError } = await supabase
                .from('gl_accounts')
                .update({ is_active: false })
                .eq('id', existing.expense_account_id)
                .eq('company_id', companyId);
            if (accError) throw accError;
        }

        revalidatePath('/app/financeiro/fatos-geradores');
        return { success: true };
    } catch (error: unknown) {
        return { error: error instanceof Error ? error.message : 'Erro inesperado' };
    }
}
