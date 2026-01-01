
import { createClient } from "@/lib/supabaseBrowser";

export interface PaymentMode {
    id: string;
    company_id: string;
    name: string;
    is_active: boolean;
    usage_count?: number;
}

export async function getPaymentModes(companyId: string) {
    const supabase = createClient();
    // note: filtering by company_id is automatic via RLS but explicit check is good practice or if using service role
    const { data, error } = await supabase
        .from('payment_modes')
        .select(`
            id, 
            name, 
            is_active,
            company_id,
            organizations:organizations(count)
        `)
        .eq('company_id', companyId)
        .order('name');

    if (error) throw error;

    return data.map((d: any) => ({
        ...d,
        usage_count: d.organizations?.[0]?.count || 0
    })) as PaymentMode[];
}

export async function createPaymentMode(companyId: string, name: string) {
    const supabase = createClient();
    const { data, error } = await supabase
        .from('payment_modes')
        .insert({ company_id: companyId, name })
        .select()
        .single();

    if (error) {
        if (error.code === '23505') {
            throw new Error("Já existe uma modalidade com este nome.");
        }
        throw error;
    }
    return data as PaymentMode;
}

export async function updatePaymentMode(id: string, name: string) {
    const supabase = createClient();
    const { data, error } = await supabase
        .from('payment_modes')
        .update({ name })
        .eq('id', id)
        .select()
        .single();

    if (error) {
        if (error.code === '23505') {
            throw new Error("Já existe uma modalidade com este nome.");
        }
        throw error;
    }
    return data as PaymentMode;
}

export async function deletePaymentMode(id: string) {
    const supabase = createClient();
    const { error } = await supabase
        .from('payment_modes')
        .delete()
        .eq('id', id);

    if (error) throw error;
}
