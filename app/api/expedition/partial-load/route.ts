
import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    const supabase = await createClient();
    const { originalOrderId, routeId, loadedItems, reason, userId } = await req.json();

    // loadedItems: { itemId: string, loadedQty: number }[]

    try {
        // 1. Fetch Original Order with Items
        const { data: originalOrder, error: fetchError } = await supabase
            .from('sales_documents')
            .select(`
                *,
                items:sales_document_items(*),
                client:organizations!client_id(trade_name)
            `)
            .eq('id', originalOrderId)
            .single();

        if (fetchError || !originalOrder) throw new Error('Order not found');

        // 2. Fetch Route Info (for notes)
        const { data: route } = await supabase
            .from('delivery_routes')
            .select('name, route_date')
            .eq('id', routeId)
            .single();

        const routeName = route?.name || 'Rota desconhecida';
        const routeDate = route?.route_date || new Date().toISOString();

        // 3. Update Original Order (Mark as loaded for this route)
        // We set loading_checked = true because as far as this route is concerned, we are done with this order.
        const originalNoteAppend = `\n[${new Date().toLocaleDateString()}] CARREGAMENTO PARCIAL na rota ${routeName}. Motivo: ${reason}.`;

        await supabase
            .from('sales_documents')
            .update({
                loading_checked: true,
                loading_checked_at: new Date().toISOString(),
                loading_checked_by: userId,
                internal_notes: (originalOrder.internal_notes || '') + originalNoteAppend
            })
            .eq('id', originalOrderId);

        // 4. Calculate Balance and Create Complementary Order
        const itemsToCreate: any[] = [];

        originalOrder.items.forEach((item: any) => {
            const loadedEntry = loadedItems.find((li: any) => li.itemId === item.id);
            const loadedQty = loadedEntry ? loadedEntry.loadedQty : item.quantity;
            const balance = item.quantity - loadedQty;

            if (balance > 0) {
                // Prepare item for new order
                // IMPORTANT: We need to omit ID and document_id
                const { id, document_id, created_at, updated_at, ...itemData } = item;
                itemsToCreate.push({
                    ...itemData,
                    quantity: balance,
                    total_amount: balance * item.unit_price, // Re-calculate total
                    notes: `Saldo do pedido #${originalOrder.document_number}`
                });
            }
        });

        if (itemsToCreate.length > 0) {
            // Create New Order
            // Remove joined fields (items, client) and system fields (id, created_at, etc)
            // Agessively remove all potential joined fields to avoid "column not found" errors
            const {
                id, document_number, created_at, updated_at,
                loading_checked, loading_checked_at, loading_checked_by,
                status_logistic,
                // Exclude joined fields
                items, client, sales_rep, carrier, payments, nfes, history, adjustments,
                ...orderData
            } = originalOrder;

            const newOrderPayload = {
                ...orderData,
                status_logistic: 'pending', // Back to pending
                internal_notes: (orderData.internal_notes || '') + `\nPEDIDO COMPLEMENTAR do #${originalOrder.document_number} (saldo não carregado em ${new Date().toLocaleDateString()} na rota ${routeName}). Motivo: ${reason}.`
            };

            console.log('Sanitized Payload Keys:', Object.keys(newOrderPayload));

            const { data: newOrder, error: createError } = await supabase
                .from('sales_documents')
                .insert(newOrderPayload)
                .select()
                .single();

            if (createError) throw createError;

            // Insert Items for new order
            const finalItems = itemsToCreate.map(item => ({
                ...item,
                document_id: newOrder.id
            }));

            const { error: itemsError } = await supabase
                .from('sales_document_items')
                .insert(finalItems);

            if (itemsError) throw itemsError;

            // Update original order to reference the new one
            await supabase
                .from('sales_documents')
                .update({
                    internal_notes: (originalOrder.internal_notes || '') + originalNoteAppend + ` Gerado PEDIDO COMPLEMENTAR #${newOrder.document_number} com os itens faltantes.`
                })
                .eq('id', originalOrderId);

            return NextResponse.json({ success: true, newOrderId: newOrder.id, newOrderNumber: newOrder.document_number });
        }

        return NextResponse.json({ success: true, message: 'Updated original order, no balance remaining.' });

    } catch (error: any) {
        console.error('Partial Load Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
