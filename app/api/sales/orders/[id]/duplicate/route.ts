import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { logger } from '@/lib/logger';

type SourceOrderItem = {
    item_id: string;
    quantity: number;
    qty_base: number | null;
    unit_price: number;
    discount_amount: number | null;
    unit_weight_kg: number | null;
    total_weight_kg: number | null;
    packaging_id: string | null;
    sales_uom_abbrev_snapshot: string | null;
    base_uom_abbrev_snapshot: string | null;
    sales_unit_label_snapshot: string | null;
    conversion_factor_snapshot: number | null;
    sales_unit_snapshot: unknown;
    weight_snapshot: unknown;
    weight_source: string | null;
    fiscal_operation_id: string | null;
    cfop_code: string | null;
    cst_icms: string | null;
    csosn: string | null;
    pis_cst: string | null;
    cofins_cst: string | null;
    ipi_cst: string | null;
    ncm_snapshot: string | null;
    cest_snapshot: string | null;
    origin_snapshot: number | null;
    st_applies: boolean | null;
    st_aliquot: number | null;
    st_value: number | null;
    pis_aliquot: number | null;
    pis_value: number | null;
    cofins_aliquot: number | null;
    cofins_value: number | null;
    ipi_applies: boolean | null;
    ipi_aliquot: number | null;
    ipi_value: number | null;
    fiscal_notes: string | null;
    fiscal_status: string | null;
    notes: string | null;
};

type SourceOrderPayment = {
    installment_number: number;
    due_date: string;
    amount: number;
    notes: string | null;
    status: string | null;
};

type SourceOrderAdjustment = {
    type: string;
    amount: number;
    reason: string | null;
};

export async function POST(
    request: Request,
    props: { params: Promise<{ id: string }> }
) {
    try {
        const params = await props.params;
        const sourceOrderId = params.id;
        const supabase = await createClient();

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { data: sourceOrder, error: sourceError } = await supabase
            .from('sales_documents')
            .select(`
                id,
                company_id,
                client_id,
                sales_rep_id,
                carrier_id,
                price_table_id,
                payment_mode_id,
                payment_terms_id,
                date_issued,
                valid_until,
                subtotal_amount,
                discount_amount,
                freight_amount,
                total_amount,
                freight_mode,
                route_tag,
                delivery_address_json,
                delivery_date,
                client_notes,
                internal_notes,
                total_weight_kg,
                total_gross_weight_kg,
                items:sales_document_items(*),
                payments:sales_document_payments(*),
                adjustments:sales_document_adjustments(*)
            `)
            .eq('id', sourceOrderId)
            .single();

        if (sourceError || !sourceOrder) {
            const message = sourceError?.message || 'Pedido não encontrado';
            return NextResponse.json({ error: message }, { status: 404 });
        }

        const sourceDate = sourceOrder.date_issued || new Date().toISOString().split('T')[0];

        let safeSalesRepId: string | null = sourceOrder.sales_rep_id || null;
        if (safeSalesRepId) {
            const { data: rep, error: repError } = await supabase
                .from('users')
                .select('id')
                .eq('id', safeSalesRepId)
                .maybeSingle();

            if (repError || !rep) {
                logger.warn('[sales/orders/duplicate] Invalid sales_rep_id on source order; duplicating with null representative', {
                    sourceOrderId,
                    salesRepId: safeSalesRepId,
                    repError: repError?.message
                });
                safeSalesRepId = null;
            }
        }

        const orderInsertPayload = {
            company_id: sourceOrder.company_id,
            client_id: sourceOrder.client_id,
            sales_rep_id: safeSalesRepId,
            carrier_id: sourceOrder.carrier_id,
            price_table_id: sourceOrder.price_table_id,
            payment_mode_id: sourceOrder.payment_mode_id,
            payment_terms_id: sourceOrder.payment_terms_id,
            date_issued: sourceDate,
            valid_until: sourceOrder.valid_until,
            doc_type: 'proposal',
            status_commercial: 'draft',
            status_logistic: 'pending',
            status_fiscal: 'none',
            financial_status: 'pending',
            subtotal_amount: sourceOrder.subtotal_amount,
            discount_amount: sourceOrder.discount_amount,
            freight_amount: sourceOrder.freight_amount,
            total_amount: sourceOrder.total_amount,
            freight_mode: sourceOrder.freight_mode,
            route_tag: sourceOrder.route_tag,
            delivery_address_json: sourceOrder.delivery_address_json,
            delivery_date: sourceOrder.delivery_date,
            client_notes: sourceOrder.client_notes,
            internal_notes: sourceOrder.internal_notes,
            total_weight_kg: sourceOrder.total_weight_kg,
            total_gross_weight_kg: sourceOrder.total_gross_weight_kg,
        };

        const { data: newOrder, error: insertOrderError } = await supabase
            .from('sales_documents')
            .insert(orderInsertPayload)
            .select('id, document_number')
            .single();

        if (insertOrderError || !newOrder) {
            throw new Error(`Falha ao criar orçamento duplicado: ${insertOrderError?.message || 'erro desconhecido'}`);
        }

        const sourceItems = (Array.isArray(sourceOrder.items) ? sourceOrder.items : []) as SourceOrderItem[];
        if (sourceItems.length > 0) {
            const itemsPayload = sourceItems.map((item) => ({
                company_id: sourceOrder.company_id,
                document_id: newOrder.id,
                item_id: item.item_id,
                quantity: item.quantity,
                qty_base: item.qty_base,
                unit_price: item.unit_price,
                discount_amount: item.discount_amount,
                unit_weight_kg: item.unit_weight_kg,
                total_weight_kg: item.total_weight_kg,
                packaging_id: item.packaging_id,
                sales_uom_abbrev_snapshot: item.sales_uom_abbrev_snapshot,
                base_uom_abbrev_snapshot: item.base_uom_abbrev_snapshot,
                sales_unit_label_snapshot: item.sales_unit_label_snapshot,
                conversion_factor_snapshot: item.conversion_factor_snapshot,
                sales_unit_snapshot: item.sales_unit_snapshot,
                weight_snapshot: item.weight_snapshot,
                weight_source: item.weight_source,
                fiscal_operation_id: item.fiscal_operation_id,
                cfop_code: item.cfop_code,
                cst_icms: item.cst_icms,
                csosn: item.csosn,
                pis_cst: item.pis_cst,
                cofins_cst: item.cofins_cst,
                ipi_cst: item.ipi_cst,
                ncm_snapshot: item.ncm_snapshot,
                cest_snapshot: item.cest_snapshot,
                origin_snapshot: item.origin_snapshot,
                st_applies: item.st_applies,
                st_aliquot: item.st_aliquot,
                st_value: item.st_value,
                pis_aliquot: item.pis_aliquot,
                pis_value: item.pis_value,
                cofins_aliquot: item.cofins_aliquot,
                cofins_value: item.cofins_value,
                ipi_applies: item.ipi_applies,
                ipi_aliquot: item.ipi_aliquot,
                ipi_value: item.ipi_value,
                fiscal_notes: item.fiscal_notes,
                fiscal_status: item.fiscal_status,
                notes: item.notes
            }));

            const { error: insertItemsError } = await supabase
                .from('sales_document_items')
                .insert(itemsPayload);

            if (insertItemsError) {
                throw new Error(`Falha ao copiar itens: ${insertItemsError.message}`);
            }
        }

        const sourcePayments = (Array.isArray(sourceOrder.payments) ? sourceOrder.payments : []) as SourceOrderPayment[];
        if (sourcePayments.length > 0) {
            const paymentsPayload = sourcePayments.map((payment) => ({
                document_id: newOrder.id,
                installment_number: payment.installment_number,
                due_date: payment.due_date,
                amount: payment.amount,
                notes: payment.notes,
                status: 'pending'
            }));

            const { error: insertPaymentsError } = await supabase
                .from('sales_document_payments')
                .insert(paymentsPayload);

            if (insertPaymentsError) {
                throw new Error(`Falha ao copiar parcelas: ${insertPaymentsError.message}`);
            }
        }

        const sourceAdjustments = (Array.isArray(sourceOrder.adjustments) ? sourceOrder.adjustments : []) as SourceOrderAdjustment[];
        if (sourceAdjustments.length > 0) {
            const adjustmentsPayload = sourceAdjustments.map((adjustment) => ({
                company_id: sourceOrder.company_id,
                sales_document_id: newOrder.id,
                type: adjustment.type,
                amount: adjustment.amount,
                reason: adjustment.reason,
                created_by: session.user.id
            }));

            const { error: insertAdjustmentsError } = await supabase
                .from('sales_document_adjustments')
                .insert(adjustmentsPayload);

            if (insertAdjustmentsError) {
                throw new Error(`Falha ao copiar ajustes: ${insertAdjustmentsError.message}`);
            }
        }

        return NextResponse.json({
            success: true,
            data: {
                id: newOrder.id,
                document_number: newOrder.document_number
            }
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error('[sales/orders/duplicate] Error', { message });
        return NextResponse.json(
            { error: process.env.NODE_ENV === 'production' ? 'Erro ao duplicar pedido' : message },
            { status: 500 }
        );
    }
}
