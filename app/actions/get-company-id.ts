'use server';

import { createClient } from "@/utils/supabase/server";

export async function getCompanyId(): Promise<string> {
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
