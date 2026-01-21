
import { NextResponse } from 'next/server';
import { createClient } from "@/utils/supabase/server";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { ids } = body;

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return NextResponse.json({ error: 'Nenhum pedido selecionado.' }, { status: 400 });
        }

        const supabase = await createClient();

        // 1. Identify valid budgets
        // We select fields to determine if it is a budget
        const { data: documents, error: fetchError } = await supabase
            .from('sales_documents')
            .select('id, doc_type, status_commercial')
            .in('id', ids);

        if (fetchError) {
            console.error('Error fetching docs for approval:', fetchError);
            return NextResponse.json({ error: 'Erro ao buscar dados.' }, { status: 500 });
        }

        if (!documents) {
            return NextResponse.json({ approved: 0, skipped: ids.length });
        }

        // Logic: A budget is considered if it is NOT confirmed/approved/cancelled/lost.
        // Usually doc_type='proposal' or status='draft'/'sent'.
        const validBudgets = documents.filter(doc => {
            const isFinishedStatus = ['approved', 'confirmed', 'cancelled', 'lost'].includes(doc.status_commercial);
            if (isFinishedStatus) return false;

            return doc.doc_type === 'proposal' || doc.status_commercial === 'draft' || doc.status_commercial === 'sent';
        });

        const validIds = validBudgets.map(d => d.id);
        const skippedCount = ids.length - validIds.length;

        if (validIds.length > 0) {
            // 2. Remove from Routes (ensure they go to Sandbox / Unscheduled)
            // Ideally use RPC for atomicity, but simple separate calls work for now.
            const { error: routeError } = await supabase
                .from('delivery_route_orders')
                .delete()
                .in('sales_document_id', validIds);

            if (routeError) {
                console.error('Error clearing routes:', routeError);
                // We continue, as this might just mean no rows affected or permission issue, 
                // but we really want to approve.
            }

            // 3. Clean up any existing pending financial events for these orders
            // This prevents duplicate events if an order is being re-confirmed after rejection
            const { error: cleanupError } = await supabase
                .from('financial_events')
                .delete()
                .in('origin_id', validIds)
                .eq('origin_type', 'SALE')
                .eq('status', 'pendente');

            if (cleanupError) {
                console.error('Error cleaning up pending events:', cleanupError);
            }

            // 4. Update Status and clear dispatch blocks
            const { error: updateError } = await supabase
                .from('sales_documents')
                .update({
                    status_commercial: 'confirmed',
                    status_logistic: 'pendente', // Sandbox
                    doc_type: 'order', // Promote to order
                    dispatch_blocked: false,
                    dispatch_blocked_reason: null,
                    dispatch_blocked_at: null,
                    dispatch_blocked_by: null,
                    financial_status: 'pendente',
                    updated_at: new Date().toISOString()
                })
                .in('id', validIds);

            if (updateError) {
                console.error('Error updating status:', updateError);
                return NextResponse.json({ error: 'Erro ao atualizar status.' }, { status: 500 });
            }

            // 5. Create financial pre-approval events
            const { data: ordersForEvents, error: fetchOrdersError } = await supabase
                .from('sales_documents')
                .select('id, company_id, total_amount, date_issued, document_number, status_logistic, client_id')
                .in('id', validIds);

            if (fetchOrdersError) {
                console.error('Error fetching orders for events:', fetchOrdersError);
            } else if (ordersForEvents && ordersForEvents.length > 0) {
                // Get partner names
                const clientIds = [...new Set(ordersForEvents.map(o => o.client_id).filter(Boolean))];
                const { data: clients } = await supabase
                    .from('organizations')
                    .select('id, trade_name')
                    .in('id', clientIds);

                const clientMap = new Map(clients?.map(c => [c.id, c.trade_name]) || []);

                const eventsToCreate = ordersForEvents.map(order => ({
                    origin_id: order.id,
                    origin_type: 'SALE',
                    origin_reference: `Pedido #${order.document_number}`,
                    company_id: order.company_id,
                    partner_id: order.client_id,
                    partner_name: clientMap.get(order.client_id) || 'Cliente não identificado',
                    direction: 'AR',
                    total_amount: order.total_amount,
                    issue_date: order.date_issued || new Date().toISOString(),
                    status: 'pendente',
                    operational_status: order.status_logistic
                }));

                const { data: insertedEvents, error: eventsError } = await supabase
                    .from('financial_events')
                    .insert(eventsToCreate)
                    .select('id, total_amount, issue_date');

                if (eventsError) {
                    console.error('Error creating financial events:', eventsError);
                } else if (insertedEvents && insertedEvents.length > 0) {
                    // Create default installments (single payment, 30 days)
                    const installmentsToCreate = insertedEvents.map(event => ({
                        event_id: event.id,
                        installment_number: 1,
                        due_date: new Date(new Date(event.issue_date).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                        amount: event.total_amount,
                        payment_condition: '30 dias',
                        payment_method: 'A definir'
                    }));

                    const { error: installmentsError } = await supabase
                        .from('financial_event_installments')
                        .insert(installmentsToCreate);

                    if (installmentsError) {
                        console.error('Error creating installments:', installmentsError);
                    }
                }
            }
        }

        return NextResponse.json({ approved: validIds.length, skipped: skippedCount });

    } catch (error: any) {
        console.error('Batch approve internal error:', error);
        return NextResponse.json({ error: 'Erro interno ao processar aprovação.' }, { status: 500 });
    }
}
