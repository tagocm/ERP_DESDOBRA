import { createAdminClient } from '@/lib/supabaseServer';

export interface NfeEmissionRecord {
    id?: string;
    company_id: string;
    sales_document_id?: string;
    access_key: string;
    numero: string;
    serie: string;
    status: 'draft' | 'signed' | 'sent' | 'processing' | 'authorized' | 'rejected' | 'denied' | 'error';
    id_lote?: string;
    ind_sinc?: string;
    n_recibo?: string;
    xml_unsigned?: string;
    xml_signed: string;
    xml_sent?: string;
    xml_nfe_proc?: string;
    c_stat?: string;
    x_motivo?: string;
    dh_recbto?: string;
    n_prot?: string;
    digest_value?: string;
    tp_amb: '1' | '2';
    uf?: string;
    attempts?: number;
    error_message?: string;
}

/**
 * Check if NF-e already exists and is authorized
 * Returns existing record if authorized, null otherwise
 */
export async function checkIdempotency(accessKey: string, companyId: string): Promise<NfeEmissionRecord | null> {
    const supabase = createAdminClient();

    const { data, error } = await supabase
        .from('nfe_emissions')
        .select('*')
        .eq('access_key', accessKey)
        .eq('company_id', companyId)
        .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = not found
        throw new Error(`Erro ao verificar idempotência: ${error.message}`);
    }

    if (data && data.status === 'authorized') {
        return data as NfeEmissionRecord;
    }

    return null;
}

/**
 * Create or update NF-e emission record using service role (bypasses RLS)
 */
export async function upsertNfeEmission(record: NfeEmissionRecord): Promise<NfeEmissionRecord> {
    const supabase = createAdminClient();

    const { data, error } = await supabase
        .from('nfe_emissions')
        .upsert({
            ...record,
            updated_at: new Date().toISOString()
        }, {
            onConflict: 'company_id,access_key'
        })
        .select()
        .single();

    if (error) {
        throw new Error(`Erro ao persistir emissão: ${error.message}`);
    }

    return data as NfeEmissionRecord;
}

/**
 * Update emission status and metadata
 */
export async function updateEmissionStatus(
    accessKey: string,
    companyId: string,
    updates: Partial<NfeEmissionRecord>
): Promise<void> {
    const supabase = createAdminClient();

    const { error } = await supabase
        .from('nfe_emissions')
        .update({
            ...updates,
            updated_at: new Date().toISOString()
        })
        .eq('access_key', accessKey)
        .eq('company_id', companyId);

    if (error) {
        throw new Error(`Erro ao atualizar emissão: ${error.message}`);
    }
}

/**
 * Build nfeProc XML (NFe + protNFe)
 */
export function buildNfeProc(nfeXml: string, protNFeXml: string): string {
    // Remove XML declaration from NFe if present
    const nfeClean = nfeXml.replace(/<\?xml[^>]*\?>/g, '').trim();

    // Remove XML declaration from protNFe if present
    const protClean = protNFeXml.replace(/<\?xml[^>]*\?>/g, '').trim();

    return `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
${nfeClean}
${protClean}
</nfeProc>`;
}
