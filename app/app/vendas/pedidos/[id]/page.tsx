
import { createClient } from "@/utils/supabase/server";
import { SalesOrderDTOForm } from "@/components/sales/order/SalesOrderForm";
import { getSalesDocumentById } from "@/lib/data/sales-orders";
import { notFound } from "next/navigation";

export default async function EditOrderPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const supabase = await createClient();

    let order;
    try {
        order = await getSalesDocumentById(supabase, id);

        if (!order) {
            notFound();
        }
    } catch (e) {
        console.error("Error loading order:", e);
        return <div>Erro ao carregar pedido.</div>;
    }

    return <SalesOrderDTOForm initialData={order} mode="edit" />;
}
