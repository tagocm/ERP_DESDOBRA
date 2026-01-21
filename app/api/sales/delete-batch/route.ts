
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
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
        }

        // 1. Fetch documents to validate status
        const { data: documents, error: fetchError } = await supabase
            .from('sales_documents')
            .select('id, status_logistic, document_number')
            .in('id', ids);

        if (fetchError) {
            console.error('Error fetching docs for deletion:', fetchError);
            return NextResponse.json({ error: 'Erro ao buscar dados.' }, { status: 500 });
        }

        if (!documents) {
            return NextResponse.json({ deleted: 0, skipped: ids.length });
        }

        // Logic: Cannot delete if status_logistic is 'em_rota', 'entregue', 'nao_entregue'
        // Blocked logic mirrors frontend 'canDelete'
        const blockedStatuses = ['em_rota', 'entregue', 'nao_entregue'];

        const validDocs = documents.filter(doc => !blockedStatuses.includes(doc.status_logistic));
        const validIds = validDocs.map(d => d.id);
        const skippedCount = ids.length - validIds.length;

        if (validIds.length > 0) {
            // 2. Soft Delete (only deleted_at exists in the table)
            const { error: deleteError } = await supabase
                .from('sales_documents')
                .update({
                    deleted_at: new Date().toISOString(),
                    status_commercial: 'cancelled' // Mark as cancelled
                })
                .in('id', validIds);

            if (deleteError) {
                console.error('Error deleting orders:', deleteError);
                return NextResponse.json({ error: 'Erro ao excluir pedidos.' }, { status: 500 });
            }


            // Log history
            // TODO: Restore when sales_document_history table is created via migration
            // const logEntries = validDocs.map(doc => ({
            //     document_id: doc.id,
            //     user_id: user.id,
            //     event_type: 'archived',
            //     description: `Pedido excluído em lote.`,
            //     metadata: { reason: 'batch_delete' }
            // }));

            // await supabase.from('sales_document_history').insert(logEntries);
        }

        return NextResponse.json({ deleted: validIds.length, skipped: skippedCount });

    } catch (error: any) {
        console.error('Batch delete internal error:', error);
        return NextResponse.json({ error: 'Erro interno ao processar exclusão.' }, { status: 500 });
    }
}
