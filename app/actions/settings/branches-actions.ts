"use server";

import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import { getActiveCompanyId } from '@/lib/auth/get-active-company';
import { getBranches } from '@/lib/data/company-settings';

export type ActionResult<T = void> =
    | { success: true; data: T }
    | { success: false; error: string };

// Usa getActiveCompanyId (company_members) para suportar membros que não são owners
const getCompanyId = getActiveCompanyId;

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
