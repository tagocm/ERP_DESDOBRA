import { PurchaseOrderForm } from "@/components/purchases/PurchaseOrderForm";
import { getPurchaseOrderByIdAction } from "@/app/actions/purchases";
import { notFound } from "next/navigation";

export default async function PurchaseOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const { data: order, error } = await getPurchaseOrderByIdAction(id);

    if (error || !order) {
        notFound();
    }

    return (
        <PurchaseOrderForm mode="edit" initialData={order} />
    );
}
