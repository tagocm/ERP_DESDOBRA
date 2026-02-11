'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

export interface InvoiceFilters {
    startDate?: Date;
    endDate?: Date;
    clientId?: string;
    clientSearch?: string;
}

export interface PendingInvoice {
    id: string;
    document_number: number;
    date_issued: string;
    client: {
        id: string;
        trade_name: string;
        document_number: string;
    };
    total_amount: number;
    status_fiscal: string;
}

export interface FetchIssuedInvoicesResult {
    data: any[];
    total: number;
    page: number;
    pageSize: number;
}

// Listar pedidos confirmados sem NF-e
export async function fetchPendingInvoices(
    companyId: string,
    filters?: InvoiceFilters
) {
    const supabase = await createClient();

    // Build base query with subquery to exclude orders that have NFe records
    let query = supabase
        .from('sales_documents')
        .select(`
            id,
            document_number,
            date_issued,
            total_amount,
            status_fiscal,
            client:organizations!client_id (
                id,
                trade_name,
                document_number
            )
        `)
        .eq('company_id', companyId)
        .eq('status_commercial', 'confirmed')
        .is('deleted_at', null)
        .order('date_issued', { ascending: false });

    if (filters?.startDate) {
        query = query.gte('date_issued', filters.startDate.toISOString().split('T')[0]);
    }

    if (filters?.endDate) {
        query = query.lte('date_issued', filters.endDate.toISOString().split('T')[0]);
    }

    if (filters?.clientId) {
        query = query.eq('client_id', filters.clientId);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error fetching pending invoices:', error);
        throw new Error('Erro ao buscar pedidos pendentes de NF-e');
    }

    // Filter out orders that have NFe records (do this client-side since Supabase doesn't support NOT EXISTS easily)
    // Get all document IDs that have NFe records (excluding cancelled)
    const { data: nfeRecords } = await supabase
        .from('sales_document_nfes')
        .select('document_id')
        .select('document_id')
        .in('status', ['processing', 'authorized', 'rejected']); // Exclude cancelled AND drafts

    const idsWithNfe = new Set(nfeRecords?.map(r => r.document_id) || []);

    // Filter out orders that have NFe records
    let filteredData = data?.filter(doc => !idsWithNfe.has(doc.id));

    const searchTerm = filters?.clientSearch?.trim().toLowerCase();
    if (searchTerm) {
        const normalized = searchTerm.replace(/[^\d]/g, '');
        filteredData = (filteredData || []).filter((doc: any) => {
            const clientRaw = Array.isArray(doc.client) ? doc.client[0] : doc.client;
            const tradeName = String(clientRaw?.trade_name || '').toLowerCase();
            const docNumber = String(clientRaw?.document_number || '').replace(/[^\d]/g, '');
            return tradeName.includes(searchTerm) || (normalized.length > 0 && docNumber.includes(normalized));
        });
    }

    // Transform client from array to single object
    const transformedData = filteredData?.map(doc => ({
        ...doc,
        client: Array.isArray(doc.client) ? doc.client[0] : doc.client
    }));

    return transformedData as PendingInvoice[];
}

// Listar NF-e emitidas
export async function fetchIssuedInvoices(
    companyId: string,
    filters?: { startDate?: Date; endDate?: Date; clientSearch?: string },
    options?: { page?: number; pageSize?: number }
): Promise<FetchIssuedInvoicesResult> {
    const supabase = await createClient();
    const page = Math.max(1, options?.page || 1);
    const pageSize = Math.max(1, Math.min(100, options?.pageSize || 100));

    const startDateIso = filters?.startDate
        ? new Date(filters.startDate.getFullYear(), filters.startDate.getMonth(), filters.startDate.getDate(), 0, 0, 0, 0).toISOString()
        : undefined;
    const endDateExclusiveIso = filters?.endDate
        ? new Date(filters.endDate.getFullYear(), filters.endDate.getMonth(), filters.endDate.getDate() + 1, 0, 0, 0, 0).toISOString()
        : undefined;

    let legacyQuery = supabase
        .from('sales_document_nfes')
        .select(`
            id,
            nfe_number,
            nfe_series,
            nfe_key,
            status,
            issued_at,
            updated_at,
            created_at,
            document:sales_documents (
                id,
                company_id,
                document_number,
                total_amount,
                client:organizations!client_id (
                    trade_name,
                    document_number
                )
            )
        `)
        .eq('document.company_id', companyId)
        .neq('status', 'draft') // Exclude drafts
        .order('updated_at', { ascending: false });

    const { data: legacyData, error: legacyError } = await legacyQuery;
    if (legacyError && legacyError.code !== '42P01' && !legacyError.message.includes('sales_document_nfes')) {
        console.error('Error fetching legacy issued invoices:', legacyError);
        throw new Error('Erro ao buscar NF-e emitidas');
    }

    let transformedLegacy = (legacyData || []).map((nfe: any) => {
        const doc = Array.isArray(nfe.document) ? nfe.document[0] : nfe.document;
        if (!doc) return nfe;

        const client = Array.isArray(doc.client) ? doc.client[0] : doc.client;

        return {
            ...nfe,
            issued_at: nfe.issued_at || nfe.updated_at || nfe.created_at,
            document: {
                ...doc,
                client
            }
        };
    });

    if (startDateIso || endDateExclusiveIso) {
        transformedLegacy = transformedLegacy.filter((row: any) => {
            const emittedAt = row.issued_at ? new Date(row.issued_at).getTime() : NaN;
            if (Number.isNaN(emittedAt)) return false;
            if (startDateIso && emittedAt < new Date(startDateIso).getTime()) return false;
            if (endDateExclusiveIso && emittedAt >= new Date(endDateExclusiveIso).getTime()) return false;
            return true;
        });
    }

    // Canonical source: nfe_emissions (compat layer to keep current UI shape)
    let emissionsQuery = supabase
        .from('nfe_emissions')
        .select('id, sales_document_id, access_key, numero, serie, status, authorized_at, updated_at, created_at, xml_nfe_proc, xml_signed')
        .eq('company_id', companyId)
        .neq('status', 'draft')
        .order('updated_at', { ascending: false });

    if (startDateIso) {
        emissionsQuery = emissionsQuery.gte('updated_at', startDateIso);
    }
    if (endDateExclusiveIso) {
        emissionsQuery = emissionsQuery.lt('updated_at', endDateExclusiveIso);
    }

    const { data: emissionsData, error: emissionsError } = await emissionsQuery;
    if (emissionsError && emissionsError.code !== '42P01') {
        console.error('Error fetching canonical emissions:', emissionsError);
        throw new Error('Erro ao buscar emissões NF-e');
    }

    const emissionDocIds = Array.from(new Set((emissionsData || []).map(e => e.sales_document_id).filter(Boolean)));
    let docsMap = new Map<string, any>();
    if (emissionDocIds.length > 0) {
        const { data: docs } = await supabase
            .from('sales_documents')
            .select(`
                id,
                document_number,
                total_amount,
                client:organizations!client_id(
                    trade_name,
                    document_number
                )
            `)
            .in('id', emissionDocIds as string[]);

        docsMap = new Map((docs || []).map((doc: any) => {
            const client = Array.isArray(doc.client) ? doc.client[0] : doc.client;
            return [doc.id, { ...doc, client }];
        }));
    }

    const transformedEmissions = (emissionsData || []).map((emission: any) => ({
        id: emission.id,
        nfe_number: Number(emission.numero) || null,
        nfe_series: Number(emission.serie) || null,
        nfe_key: emission.access_key,
        status: emission.status,
        issued_at: emission.authorized_at || emission.updated_at || emission.created_at,
        document: emission.sales_document_id ? docsMap.get(emission.sales_document_id) || null : null,
        _source: 'emission',
        _xml_inline: emission.xml_nfe_proc || emission.xml_signed || null
    }));

    // Merge by access key (canonical first), keep legacy rows not present in canonical
    const byKey = new Map<string, any>();
    transformedEmissions.forEach((row: any) => {
        const key = row.nfe_key || `emission:${row.id}`;
        byKey.set(key, row);
    });
    (transformedLegacy || []).forEach((row: any) => {
        const key = row.nfe_key || `legacy:${row.id}`;
        if (!byKey.has(key)) {
            byKey.set(key, { ...row, _source: 'legacy' });
        }
    });

    let merged = Array.from(byKey.values()).sort((a: any, b: any) =>
        new Date(b.issued_at || 0).getTime() - new Date(a.issued_at || 0).getTime()
    );

    const searchTerm = filters?.clientSearch?.trim().toLowerCase();
    if (searchTerm) {
        const normalized = searchTerm.replace(/[^\d]/g, '');
        merged = merged.filter((row: any) => {
            const tradeName = String(row?.document?.client?.trade_name || '').toLowerCase();
            const legalDoc = String(row?.document?.client?.document_number || '').replace(/[^\d]/g, '');
            return tradeName.includes(searchTerm) || (normalized.length > 0 && legalDoc.includes(normalized));
        });
    }

    const total = merged.length;
    const startIndex = (page - 1) * pageSize;
    const pagedData = merged.slice(startIndex, startIndex + pageSize);

    return {
        data: pagedData,
        total,
        page,
        pageSize,
    };
}

// Download NF-e XML
export async function downloadNfeXml(nfeId: string) {
    const supabase = await createClient();

    // Get NFe record to check for signed XML path
    const { data: nfe, error } = await supabase
        .from('sales_document_nfes')
        .select('details, nfe_key')
        .eq('id', nfeId)
        .single();

    if (!error && nfe) {
        // Get XML path from details
        const details = nfe.details as any;
        const xmlPath = details?.artifacts?.signed_xml || details?.xml_url;

        if (xmlPath) {
            return {
                path: xmlPath,
                key: nfe.nfe_key,
                filename: `NFe-${nfe.nfe_key}.xml`
            };
        }
    }

    // Canonical fallback: nfe_emissions
    const { data: emission, error: emissionError } = await supabase
        .from('nfe_emissions')
        .select('access_key, xml_nfe_proc, xml_signed')
        .eq('id', nfeId)
        .maybeSingle();

    if (emissionError || !emission) {
        throw new Error('NF-e não encontrada');
    }

    const inlineXml = emission.xml_nfe_proc || emission.xml_signed;
    if (!inlineXml) {
        throw new Error('XML não encontrado. A NF-e pode não ter sido processada completamente.');
    }

    return {
        key: emission.access_key,
        filename: `NFe-${emission.access_key}.xml`,
        inlineXml
    };
}

// Criar NF-e vinculada a pedido
export async function createInvoiceFromOrder(documentId: string) {
    const supabase = await createClient();

    // Get next invoice number
    const { data: company } = await supabase
        .from('sales_documents')
        .select('company_id')
        .eq('id', documentId)
        .single();

    if (!company) {
        throw new Error('Pedido não encontrado');
    }

    const { data: lastInvoice } = await supabase
        .from('sales_document_nfes')
        .select('nfe_number')
        .order('nfe_number', { ascending: false })
        .limit(1)
        .single();

    const nextNumber = (lastInvoice?.nfe_number || 0) + 1;

    // Create invoice
    const { data: invoice, error: invoiceError } = await supabase
        .from('sales_document_nfes')
        .insert({
            document_id: documentId,
            nfe_number: nextNumber,
            nfe_series: 1,
            status: 'authorized', // MVP: manual authorization
            issued_at: new Date().toISOString(),
        })
        .select()
        .single();

    if (invoiceError) {
        console.error('Error creating invoice:', invoiceError);
        throw new Error('Erro ao criar NF-e');
    }

    // Update order fiscal status
    const { error: updateError } = await supabase
        .from('sales_documents')
        .update({ status_fiscal: 'authorized' })
        .eq('id', documentId);

    if (updateError) {
        console.error('Error updating fiscal status:', updateError);
        throw new Error('Erro ao atualizar status fiscal');
    }

    revalidatePath('/app/fiscal/nfe');
    revalidatePath('/app/vendas/pedidos');

    return invoice;
}

// Cancelar NF-e
export async function cancelInvoice(invoiceId: string, reason: string) {
    const supabase = await createClient();

    const { error } = await supabase
        .from('sales_document_nfes')
        .update({
            status: 'cancelled',
            details: reason,
        })
        .eq('id', invoiceId);

    if (error) {
        console.error('Error cancelling invoice:', error);
        throw new Error('Erro ao cancelar NF-e');
    }

    // Update order status if linked
    const { data: invoice } = await supabase
        .from('sales_document_nfes')
        .select('document_id')
        .eq('id', invoiceId)
        .single();

    if (invoice?.document_id) {
        await supabase
            .from('sales_documents')
            .update({ status_fiscal: 'cancelled' })
            .eq('id', invoice.document_id);
    }

    revalidatePath('/app/fiscal/nfe');

    return true;
}
