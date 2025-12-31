import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const supabase = await createClient();
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { routeId } = await request.json();

        if (!routeId) {
            return NextResponse.json({ error: 'Route ID required' }, { status: 400 });
        }

        // 1. Fetch Route Orders with relevant info
        const { data: routeOrders, error: fetchError } = await supabase
            .from('delivery_route_orders')
            .select(`
                id, loading_status, partial_payload, sales_document_id,
                sales_order:sales_documents(*)
            `)
            .eq('route_id', routeId);

        if (fetchError) throw fetchError;
        if (!routeOrders || routeOrders.length === 0) {
            throw new Error('Nenhum pedido na rota.');
        }

        // 2. Fetch Route Info (for notes)
        const { data: route } = await supabase
            .from('delivery_routes')
            .select('name, route_date')
            .eq('id', routeId)
            .single();
        const routeName = route?.name || 'Rota desconhecida';

        // 3. Process each order
        const ordersToUpdateStatus = [];

        for (const ro of routeOrders) {
            const originalOrder = ro.sales_order as any;
            if (!originalOrder) continue;

            // Derive effective status to support workaround (pending + payload flag)
            let loadingStatus = ro.loading_status;
            if (loadingStatus === 'pending' && ro.partial_payload?.status === 'not_loaded') {
                loadingStatus = 'not_loaded';
            }

            const now = new Date();
            const noteTimestamp = `[${now.toLocaleDateString()}]`;

            // A) NOT LOADED
            if (loadingStatus === 'not_loaded') {
                const { reason, text_other } = ro.partial_payload || {};
                const note = `\n${noteTimestamp} NÃO CARREGADO na rota ${routeName}. Motivo: ${reason || 'Não informado'}. ${text_other || ''}. Pedido devolvido para SANDBOX.`;

                // 1. Update Order Status and Note
                await supabase
                    .from('sales_documents')
                    .update({
                        internal_notes: (originalOrder.internal_notes || '') + note,
                        loading_checked: false,
                        status_logistic: 'pending' // Return to Sandbox
                    })
                    .eq('id', originalOrder.id);

                // 2. Update status in Route (Red Dot) instead of removing
                await supabase
                    .from('delivery_route_orders')
                    .update({ loading_status: 'not_loaded' })
                    .eq('id', ro.id);

                // await supabase
                //     .from('delivery_route_orders')
                //     .delete()
                //     .eq('id', ro.id);

                continue; // Skip moving to 'em_rota'
            }

            // B) PARTIAL COMMIT
            else if (loadingStatus === 'partial' && ro.partial_payload) {
                ordersToUpdateStatus.push(originalOrder.id);

                const { loadedItems, reason, userId } = ro.partial_payload;
                // loadedItems: { itemId: string, loadedQty: number }[]

                // --- LOGIC FROM PREVIOUS partial-load ENDPOINT ---

                // Fetch items (we need them to calculate balance)
                const { data: orderItems, error: itemsError } = await supabase
                    .from('sales_document_items')
                    .select('*')
                    .eq('document_id', originalOrder.id);

                if (itemsError) throw itemsError;

                const originalNoteAppend = `\n${noteTimestamp} CARREGAMENTO PARCIAL na rota ${routeName}. Motivo: ${reason}.`;

                // Update Original Order (Mark as loaded/checked)
                await supabase
                    .from('sales_documents')
                    .update({
                        loading_checked: true, // It is checked (partially)
                        loading_checked_at: new Date().toISOString(),
                        loading_checked_by: userId || session.user.id,
                        internal_notes: (originalOrder.internal_notes || '') + originalNoteAppend
                    })
                    .eq('id', originalOrder.id);

                // Calculate Balance
                // Calculate Balance AND Update Original Items
                const itemsToCreate: any[] = [];
                let newOriginalTotalAmount = 0;

                for (const item of orderItems) {
                    const loadedEntry = loadedItems.find((li: any) => li.itemId === item.id);
                    const loadedQty = loadedEntry ? Number(loadedEntry.loadedQty) : Number(item.quantity);
                    const balance = Number(item.quantity) - loadedQty;
                    const unitPrice = Number(item.unit_price || 0);

                    // Accumulate new total for original order (based on loaded qty)
                    newOriginalTotalAmount += (loadedQty * unitPrice);

                    if (balance > 0) {
                        const { id, document_id, created_at, updated_at, ...itemData } = item;
                        itemsToCreate.push({
                            ...itemData,
                            quantity: balance,
                            total_amount: balance * unitPrice,
                            notes: `Saldo do pedido #${originalOrder.document_number}`
                        });
                    }

                    // Update Original Item if changed
                    if (loadedQty !== Number(item.quantity)) {
                        if (loadedQty > 0) {
                            await supabase
                                .from('sales_document_items')
                                .update({
                                    quantity: loadedQty,
                                    total_amount: loadedQty * unitPrice
                                })
                                .eq('id', item.id);
                        } else {
                            // If loaded 0, remove form original order
                            await supabase
                                .from('sales_document_items')
                                .delete()
                                .eq('id', item.id);
                        }
                    }
                }

                // Update Original Order Header Total
                await supabase
                    .from('sales_documents')
                    .update({
                        total_amount: newOriginalTotalAmount,
                        // Not updating subtotal/discount/freight logic complexly here, 
                        // just ensuring total matches items for consistency
                    })
                    .eq('id', originalOrder.id);

                if (itemsToCreate.length > 0) {
                    // Create Complementary Order

                    // Calculate Total for the new order
                    const newOrderTotal = itemsToCreate.reduce((sum: number, item: any) => sum + (Number(item.quantity) * Number(item.unit_price)), 0);

                    // Clean joined fields
                    const {
                        id, document_number, created_at, updated_at,
                        loading_checked, loading_checked_at, loading_checked_by,
                        status_logistic,
                        total_amount, subtotal_amount, // Exclude original totals
                        items, client, sales_rep, carrier, payments, nfes, history, adjustments,
                        ...orderData
                    } = originalOrder;

                    // Insert New Order
                    const newOrderPayload = {
                        ...orderData,
                        total_amount: newOrderTotal,
                        subtotal_amount: newOrderTotal,
                        status_logistic: 'pending', // Goes to backlog
                        internal_notes: (orderData.internal_notes || '') + `\nPEDIDO COMPLEMENTAR do #${originalOrder.document_number} (saldo não carregado em ${new Date().toLocaleDateString()} na rota ${routeName}). Motivo: ${reason}.`
                    };

                    const { data: newOrder, error: createError } = await supabase
                        .from('sales_documents')
                        .insert(newOrderPayload)
                        .select()
                        .single();

                    if (createError) throw createError;

                    // Insert Items
                    const finalItems = itemsToCreate.map(item => ({
                        ...item,
                        document_id: newOrder.id
                    }));
                    await supabase.from('sales_document_items').insert(finalItems);

                    // Link Orders
                    await supabase
                        .from('sales_documents')
                        .update({
                            internal_notes: (originalOrder.internal_notes || '') + originalNoteAppend + ` Gerado PEDIDO COMPLEMENTAR #${newOrder.document_number} com os itens faltantes.`
                        })
                        .eq('id', originalOrder.id);
                }
            }
            // C) LOADED (Standard)
            else {
                // Assuming everything else is Loaded if validated by frontend
                ordersToUpdateStatus.push(originalOrder.id);

                await supabase
                    .from('sales_documents')
                    .update({
                        loading_checked: true,
                        loading_checked_at: now.toISOString(),
                        loading_checked_by: session.user.id
                    })
                    .eq('id', originalOrder.id);
            }
        }

        // 4. Update Status of all processed orders to 'em_rota'
        // Logic: if it's partial, it is now checked, so it goes 'em_rota'.
        // If it was already checked, it goes 'em_rota'.
        // Note: Complementary order created stays 'pending'.
        if (ordersToUpdateStatus.length > 0) {
            await supabase
                .from('sales_documents')
                .update({ status_logistic: 'em_rota' })
                .in('id', ordersToUpdateStatus)
                .not('status_logistic', 'in', '(entregue,nao_entregue)');
        }

        // 5. Update Route Status
        // If NO orders are proceeding to 'em_rota', it means all were Not Loaded (or Empty).
        // In this case, we Cancel the route (visual Red Card).
        const newRouteStatus = ordersToUpdateStatus.length === 0 ? 'cancelada' : 'em_rota';

        await supabase
            .from('delivery_routes')
            .update({ status: newRouteStatus })
            .eq('id', routeId);

        // 6. Log Route Event
        const summaryLog = routeOrders.map(ro => ({
            order_id: (ro.sales_order as any)?.id,
            document_number: (ro.sales_order as any)?.document_number,
            status: ro.loading_status,
            reason: ro.partial_payload?.reason
        }));

        await supabase.from('route_event_logs').insert({
            route_id: routeId,
            event_code: 'ROUTE_STARTED',
            payload: {
                started_at: new Date().toISOString(),
                orders_count: routeOrders.length,
                user_id: session.user.id,
                summary: summaryLog
            },
            created_by_user_id: session.user.id
        });


        return NextResponse.json({ success: true, processed: ordersToUpdateStatus.length });


    } catch (error: any) {
        console.error('Start Route Error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to start route' },
            { status: 500 }
        );
    }
}
