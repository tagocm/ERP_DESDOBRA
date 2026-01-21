
import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function POST(
    request: Request,
    props: { params: Promise<{ routeId: string }> }
) {
    const params = await props.params;
    const { routeId } = params;
    const supabase = await createClient();

    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { data: route } = await supabase.from('delivery_routes').select('company_id').eq('id', routeId).single();
        if (!route) return NextResponse.json({ error: "Route not found" }, { status: 404 });

        const companyId = route.company_id;

        // Verify membership
        const { data: member } = await supabase
            .from('company_members')
            .select('company_id')
            .eq('company_id', companyId)
            .eq('auth_user_id', user.id)
            .single();

        if (!member) return NextResponse.json({ error: "Unauthorized for this company" }, { status: 403 });

        // 1. Fetch Unprocessed Events (Occurrences)
        const { data: occurrences, error: occError } = await supabase
            .from('order_delivery_events')
            .select(`
                *,
                reason:delivery_reasons(*)
            `)
            .eq('route_id', routeId)
            .is('processed_at', null);

        if (occError) throw occError;

        if (!occurrences || occurrences.length === 0) {
            return NextResponse.json({ processed: 0, new_orders: 0 });
        }

        let processedCount = 0;
        let newOrdersCount = 0;
        const processingResults = [];

        // 2. Process Each Event
        for (const occ of occurrences) {
            const resultLog: any = { actions: [] };
            const reason = occ.reason;
            const orderId = occ.order_id;

            // Common: Remove from Route
            // Only remove if it is NOT a Partial Load (Partial must stay in route to be delivered)
            if (occ.event_type !== 'CARREGAMENTO_PARCIAL') {
                await supabase.from('delivery_route_orders').delete()
                    .eq('route_id', routeId)
                    .eq('sales_document_id', orderId);
                resultLog.actions.push("removed_from_route");
            } else {
                resultLog.actions.push("kept_in_route_for_partial");
            }

            // Common: Add Internal Note
            const reasonName = reason?.name || occ.event_type;
            const noteText = `[RETORNO DE ROTA] Ocorrência: ${occ.event_type} | Motivo: ${reasonName} | Obs: ${occ.note || ''} | Rota: ${routeId}`;

            const { data: order } = await supabase.from('sales_documents').select('internal_notes, total_amount').eq('id', orderId).single();
            const newNotes = (order?.internal_notes ? order.internal_notes + '\n' : '') + noteText;

            const updatePayload: any = { internal_notes: newNotes };

            // Update Order Data (Notes + Flags)
            await supabase.from('sales_documents').update(updatePayload).eq('id', orderId);
            resultLog.actions.push("updated_notes_flags");

            // Specific Logic
            if (occ.event_type === 'NAO_CARREGAMENTO') {
                // Return to sandbox
                await supabase.from('sales_documents')
                    .update({ status_logistic: 'pendente' })
                    .eq('id', orderId);
                resultLog.actions.push("status_logistic_pendente");
            }
            else if (occ.event_type === 'CARREGAMENTO_PARCIAL') {
                const generateDifference = occ.payload?.actions?.generateDifference === true;
                const payloadItems = occ.payload?.items || [];

                let hasDifference = false;
                const diffItems = [];
                const itemSummaries: string[] = [];

                for (const pItem of payloadItems) {
                    const loadedQty = Number(pItem.loadedQty);
                    const { data: sItem } = await supabase.from('sales_document_items').select('*').eq('id', pItem.itemId).single();

                    if (sItem) {
                        const originalQty = Number(sItem.quantity);
                        const diff = originalQty - loadedQty;

                        // Fetch product name for the log
                        const { data: prod } = await supabase.from('items').select('name').eq('id', sItem.item_id).single();
                        const pName = prod?.name || 'Produto';

                        if (diff > 0) {
                            itemSummaries.push(`${pName}: carregado ${loadedQty} de ${originalQty} (faltou ${diff})`);
                            hasDifference = true;
                            diffItems.push({ ...sItem, quantity: diff });
                        } else {
                            itemSummaries.push(`${pName}: carregado ${loadedQty} de ${originalQty}`);
                        }

                        // Update Original Item
                        if (loadedQty === 0) {
                            await supabase.from('sales_document_items').delete().eq('id', pItem.itemId);
                        } else {
                            await supabase.from('sales_document_items').update({ quantity: loadedQty }).eq('id', pItem.itemId);
                        }
                    }
                }

                const obsText = occ.note || '';
                const itemsSummaryLine = itemSummaries.length > 0 ? `Itens: ${itemSummaries.join('; ')}.` : '';
                const pLogEntry = `[EXPEDIÇÃO] CARREGAMENTO PARCIAL. Motivo: ${reasonName}.${obsText ? ` Obs: ${obsText}.` : ''} Pedido ajustado para quantidades carregadas.\n${itemsSummaryLine}`;

                const { data: currentOrder } = await supabase.from('sales_documents').select('internal_notes, id, document_number, client_id, price_table_id, payment_condition_id, branch_id, delivery_address, seller_id').eq('id', orderId).single();
                let updatedNotes = (currentOrder?.internal_notes ? currentOrder.internal_notes + '\n\n' : '') + pLogEntry;

                if (generateDifference && hasDifference && currentOrder) {
                    const { data: newOrder, error: newOrderError } = await supabase
                        .from('sales_documents')
                        .insert({
                            company_id: companyId,
                            doc_type: 'order',
                            status_commercial: 'pendente',
                            status_logistic: 'pendente',
                            client_id: currentOrder.client_id,
                            price_table_id: currentOrder.price_table_id,
                            payment_condition_id: currentOrder.payment_condition_id,
                            branch_id: currentOrder.branch_id,
                            delivery_address: currentOrder.delivery_address,
                            seller_id: currentOrder.seller_id,
                            origin_sales_document_id: currentOrder.id,
                            internal_notes: `[EXPEDIÇÃO] Pedido criado automaticamente com a DIFERENÇA não carregada do Pedido #${currentOrder.document_number}.`
                        })
                        .select()
                        .single();

                    if (newOrder) {
                        const newItems = diffItems.map(di => ({
                            company_id: companyId,
                            sales_document_id: newOrder.id,
                            item_id: di.item_id,
                            quantity: di.quantity,
                            unit_price: di.unit_price,
                            total_amount: Number(di.unit_price) * Number(di.quantity)
                        }));

                        if (newItems.length > 0) {
                            await supabase.from('sales_document_items').insert(newItems);
                        }

                        resultLog.actions.push("created_difference_order", newOrder.id);
                        newOrdersCount++;

                        const crossRef = `[EXPEDIÇÃO] Gerado Pedido #${newOrder.document_number || 'ID:' + newOrder.id} com a diferença não carregada.`;
                        updatedNotes += '\n' + crossRef;
                    }
                }

                await supabase.from('sales_documents').update({ internal_notes: updatedNotes }).eq('id', orderId);
                resultLog.actions.push("updated_original_notes");
            }

            // Mark Event Processed
            await supabase.from('order_delivery_events')
                .update({
                    processed_at: new Date().toISOString(),
                    processed_by: user.id,
                    processing_result: resultLog
                })
                .eq('id', occ.id);

            processedCount++;
            processingResults.push({ id: occ.id, result: resultLog });
        }

        return NextResponse.json({
            processed: processedCount,
            new_orders: newOrdersCount,
            results: processingResults
        });

    } catch (error: any) {
        console.error("Error processing occurrences:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
