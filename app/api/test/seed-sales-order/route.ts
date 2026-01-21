
import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
    const supabase = await createClient();

    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        // Get Company
        const { data: member } = await supabase
            .from('company_members')
            .select('company_id')
            .eq('auth_user_id', user.id)
            .limit(1)
            .single();

        if (!member) return NextResponse.json({ error: "No company found" }, { status: 403 });
        const companyId = member.company_id;

        // 1. Get/Create Client
        let { data: client } = await supabase
            .from('organizations')
            .select('id')
            .eq('company_id', companyId)
            .eq('document', '12345678000199')
            .single();

        if (!client) {
            const { data: newClient, error: clientError } = await supabase
                .from('organizations')
                .insert({
                    company_id: companyId,
                    name: 'Cliente Teste Delivery',
                    trade_name: 'Cliente Teste',
                    document: '12345678000199',
                    type: 'customer'
                })
                .select()
                .single();
            if (clientError) throw clientError;
            client = newClient;
        }

        // 2. Get/Create Item
        let { data: item } = await supabase
            .from('items')
            .select('id')
            .eq('company_id', companyId)
            .eq('code', 'TEST-DEL-001')
            .single();

        if (!item) {
            // Need UOM
            let { data: uom } = await supabase.from('uoms').select('id').eq('company_id', companyId).limit(1).single();
            // If no UOM, create one
            if (!uom) {
                const { data: newUom } = await supabase.from('uoms').insert({ company_id: companyId, code: 'UN', name: 'Unidade' }).select().single();
                uom = newUom;
            }

            const { data: newItem, error: itemError } = await supabase
                .from('items')
                .insert({
                    company_id: companyId,
                    code: 'TEST-DEL-001',
                    name: 'Produto Teste Delivery',
                    uom_id: uom.id,
                    type: 'product'
                })
                .select()
                .single();
            if (itemError) throw itemError;
            item = newItem;
        }

        // 3. Create Order
        const { data: order, error: orderError } = await supabase
            .from('sales_documents')
            .insert({
                company_id: companyId,
                client_id: client.id,
                doc_type: 'order',
                status_commercial: 'approved',
                status_logistic: 'pendente',
                date_issued: new Date().toISOString(),
                total_amount: 100.00,
                sales_rep_id: user.id
            })
            .select()
            .single();

        if (orderError) throw orderError;

        // 4. Create Item
        const { error: itemInsertError } = await supabase
            .from('sales_document_items')
            .insert({
                company_id: companyId,
                document_id: order.id,
                item_id: item.id,
                quantity: 10,
                unit_price: 10.00,
                total_amount: 100.00
            });

        if (itemInsertError) throw itemInsertError;

        return NextResponse.json({ success: true, orderId: order.id });

    } catch (error: any) {
        console.error("Seed Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
