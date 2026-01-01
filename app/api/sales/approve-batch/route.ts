
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
            const isFinishedStatus = ['approved', 'confirmed', 'cancelled', 'lost', 'billed'].includes(doc.status_commercial);
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

            // 3. Update Status
            const { error: updateError } = await supabase
                .from('sales_documents')
                .update({
                    status_commercial: 'approved',
                    status_logistic: 'pending', // Sandbox
                    doc_type: 'order', // Promote to order
                    updated_at: new Date().toISOString()
                })
                .in('id', validIds);

            if (updateError) {
                console.error('Error updating status:', updateError);
                return NextResponse.json({ error: 'Erro ao atualizar status.' }, { status: 500 });
            }
        }

        return NextResponse.json({ approved: validIds.length, skipped: skippedCount });

    } catch (error: any) {
        console.error('Batch approve internal error:', error);
        return NextResponse.json({ error: 'Erro interno ao processar aprovação.' }, { status: 500 });
    }
}
