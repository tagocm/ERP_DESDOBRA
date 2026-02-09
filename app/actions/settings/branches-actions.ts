"use server";

import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import { getBranches } from '@/lib/data/company-settings';

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

export async function getBranchesAction(): Promise<ActionResult<any[]>> {
    try {
        const companyId = await getCompanyId();
        const supabase = await createClient();
        const data = await getBranches(supabase, companyId);
        return { success: true, data: data || [] };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}
