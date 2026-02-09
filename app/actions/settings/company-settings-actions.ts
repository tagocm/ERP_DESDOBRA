"use server";

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import {
    getCompanySettings,
    updateCompanySettings,
    updateCompanyName
} from '@/lib/data/company-settings';

// ============================================================================
// TYPES
// ============================================================================
export type ActionResult<T = void> =
    | { success: true; data: T }
    | { success: false; error: string };

// ============================================================================
// HELPER: Get Company ID
// ============================================================================
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
const UpdateSettingsSchema = z.object({
    legal_name: z.string().nullable().optional(),
    trade_name: z.string().nullable().optional(),
    cnpj: z.string().nullable().optional(),
    ie: z.string().nullable().optional(),
    im: z.string().nullable().optional(),
    cnae_code: z.string().nullable().optional(),
    cnae_description: z.string().nullable().optional(),
    phone: z.string().nullable().optional(),
    email: z.string().email().nullable().optional().or(z.literal('')),
    website: z.string().nullable().optional(),
    address_zip: z.string().nullable().optional(),
    address_street: z.string().nullable().optional(),
    address_number: z.string().nullable().optional(),
    address_complement: z.string().nullable().optional(),
    address_neighborhood: z.string().nullable().optional(),
    address_city: z.string().nullable().optional(),
    address_state: z.string().nullable().optional(),
    address_country: z.string().nullable().optional(),
    city_code_ibge: z.string().nullable().optional(),
    tax_regime: z.enum(['simples_nacional', 'lucro_presumido', 'lucro_real']).nullable().optional(),
    nfe_environment: z.enum(['homologation', 'production']).nullable().optional(),
    nfe_series: z.string().nullable().optional(),
    nfe_next_number: z.number().int().optional(),
    default_penalty_percent: z.number().min(0).optional(),
    default_interest_percent: z.number().min(0).optional(),
    // Certificate fields
    cert_a1_storage_path: z.string().nullable().optional(),
    cert_a1_uploaded_at: z.string().nullable().optional(),
    cert_a1_expires_at: z.string().nullable().optional(),
    is_cert_password_saved: z.boolean().optional(),
    cert_password_encrypted: z.string().optional()
}).passthrough(); // Allow other fields if DB model expands without schema update

const UpdateNameSchema = z.object({
    name: z.string().min(1, "Nome é obrigatório")
});

// ============================================================================
// ACTIONS
// ============================================================================

export async function getCompanySettingsAction(): Promise<ActionResult<any>> {
    try {
        const companyId = await getCompanyId();
        const supabase = await createClient();
        const data = await getCompanySettings(supabase, companyId);
        return { success: true, data };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function updateCompanySettingsAction(data: z.infer<typeof UpdateSettingsSchema>): Promise<ActionResult<any>> {
    try {
        const companyId = await getCompanyId();
        const supabase = await createClient();

        const validated = UpdateSettingsSchema.parse(data);

        // Filter out nulls/undefined if needed, but data layer handles Partial
        const result = await updateCompanySettings(supabase, companyId, validated);

        revalidatePath('/app/configuracoes/empresa');
        return { success: true, data: result };
    } catch (e: any) {
        // Friendly error message for Zod errors
        if (e instanceof z.ZodError) {
            return { success: false, error: (e as any).errors.map((err: any) => err.message).join(', ') };
        }
        return { success: false, error: e.message };
    }
}

export async function updateCompanyNameAction(name: string): Promise<ActionResult<void>> {
    try {
        const companyId = await getCompanyId();
        const supabase = await createClient();

        const validated = UpdateNameSchema.parse({ name });

        await updateCompanyName(supabase, companyId, validated.name);

        revalidatePath('/app/configuracoes/empresa');
        return { success: true, data: undefined };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}
