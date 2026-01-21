'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

export interface InvoiceFilters {
    startDate?: Date;
    endDate?: Date;
    clientId?: string;
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
    const filteredData = data?.filter(doc => !idsWithNfe.has(doc.id));

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
    filters?: { startDate?: Date; endDate?: Date }
) {
    const supabase = await createClient();

    let query = supabase
        .from('sales_document_nfes')
        .select(`
            id,
            nfe_number,
            nfe_series,
            nfe_key,
            status,
            issued_at,
            document:sales_documents (
                id,
                document_number,
                total_amount,
                client:organizations!client_id (
                    trade_name,
                    document_number
                )
            )
        `)
        .neq('status', 'draft') // Exclude drafts
        .order('issued_at', { ascending: false });

    if (filters?.startDate) {
        query = query.gte('issued_at', filters.startDate.toISOString());
    }

    if (filters?.endDate) {
        query = query.lte('issued_at', filters.endDate.toISOString());
    }

    const { data, error } = await query;

    if (error) {
        // If table doesn't exist, return empty array instead of throwing to avoid breaking the UI
        if (error.code === '42P01' || error.message.includes('sales_document_nfes')) {
            console.warn('Table sales_document_nfes not found, returning empty list');
            return [];
        }
        console.error('Error fetching issued invoices:', error);
        throw new Error('Erro ao buscar NF-e emitidas');
    }

    // Transform nested client from array to single object
    const transformedData = data?.map(nfe => {
        const doc = Array.isArray(nfe.document) ? nfe.document[0] : nfe.document;
        if (!doc) return nfe;

        const client = Array.isArray(doc.client) ? doc.client[0] : doc.client;

        return {
            ...nfe,
            document: {
                ...doc,
                client
            }
        };
    });

    return transformedData;
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

    if (error || !nfe) {
        throw new Error('NF-e não encontrada');
    }

    // Get XML path from details
    const details = nfe.details as any;
    const xmlPath = details?.artifacts?.signed_xml || details?.xml_url;

    if (!xmlPath) {
        throw new Error('XML não encontrado. A NF-e pode não ter sido processada completamente.');
    }

    // Return the storage path for client-side download
    return {
        path: xmlPath,
        key: nfe.nfe_key,
        filename: `NFe-${nfe.nfe_key}.xml`
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
