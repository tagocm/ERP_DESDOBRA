'use server'

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import { getActiveCompanyId } from '@/lib/auth/get-active-company';
import { z } from 'zod';

export interface FinancialCategory {
    id: string;
    company_id: string;
    name: string;
    description?: string;
    is_active: boolean;
    created_at?: string;
    updated_at?: string;
}

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
        return { data: data as FinancialCategory[] };
    } catch (error: unknown) {
        return { error: error instanceof Error ? error.message : 'Erro inesperado' };
    }
}

export async function createFinancialCategoryAction(name: string) {
    try {
        const supabase = await createClient();
        const companyId = await getActiveCompanyId();
        if (!companyId) return { error: 'Empresa não encontrada' };

        const { data, error } = await supabase
            .from('financial_categories')
            .insert({ name, company_id: companyId })
            .select()
            .single();

        if (error) {
            if (error.code === '23505') {
                return { error: "Já existe uma categoria financeira com este nome." };
            }
            throw error;
        }

        revalidatePath('/app/financeiro/fatos-geradores');
        return { data: data as FinancialCategory };
    } catch (error: unknown) {
        return { error: error instanceof Error ? error.message : 'Erro inesperado' };
    }
}

export async function updateFinancialCategoryAction(id: string, name: string) {
    try {
        const supabase = await createClient();
        const { data, error } = await supabase
            .from('financial_categories')
            .update({ name })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            if (error.code === '23505') {
                return { error: "Já existe uma categoria financeira com este nome." };
            }
            throw error;
        }

        revalidatePath('/app/financeiro/fatos-geradores');
        return { data: data as FinancialCategory };
    } catch (error: unknown) {
        return { error: error instanceof Error ? error.message : 'Erro inesperado' };
    }
}

export async function deleteFinancialCategoryAction(id: string) {
    try {
        const supabase = await createClient();
        const { error } = await supabase
            .from('financial_categories')
            .update({ deleted_at: new Date().toISOString(), is_active: false })
            .eq('id', id);

        if (error) throw error;

        revalidatePath('/app/financeiro/fatos-geradores');
        return { success: true };
    } catch (error: unknown) {
        return { error: error instanceof Error ? error.message : 'Erro inesperado' };
    }
}
