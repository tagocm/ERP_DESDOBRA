"use client";

import { PageHeader } from "@/components/ui/PageHeader";
import { ModuleTabs } from "@/components/app/ModuleTabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { PurchasesTable } from "@/components/purchases/PurchasesTable";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabaseBrowser";
import { useCompany } from "@/contexts/CompanyContext";
import { useRouter } from "next/navigation";

const tabs = [
    {
        "name": "Pedidos de Compra",
        "href": "/app/compras/pedidos"
    },
    {
        "name": "Recebimento",
        "href": "/app/compras/recebimento"
    }
];

export default function Page() {
    const supabase = createClient();
    const { selectedCompany } = useCompany();
    const router = useRouter();
    const [incomingOrders, setIncomingOrders] = useState<any[]>([]);
    const [recentReceipts, setRecentReceipts] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchOrders = async () => {
        if (!selectedCompany) {
            setIsLoading(false);
            return;
        }

        setIsLoading(true);

        try {
            // Load incoming entries (Status: sent) - Waiting for receipt
            const { data: sent } = await supabase
                .from('purchase_orders')
                .select(`
                    *,
                    supplier:organizations!supplier_id(id, name:trade_name),
                    payment_term:payment_terms!payment_terms_id(name),
                    payment_mode:payment_modes!payment_mode_id(name),
                    items:purchase_order_items(id),
                    receiving_blocked, receiving_blocked_reason
                `)
                .eq('company_id', selectedCompany.id)
                .eq('status', 'sent')
                .order('ordered_at', { ascending: false });

            if (sent) setIncomingOrders(sent);

            // Load recent receipts (Status: received) - History
            const { data: received } = await supabase
                .from('purchase_orders')
                .select(`
                    *,
                    supplier:organizations!supplier_id(id, name:trade_name),
                    payment_term:payment_terms!payment_terms_id(name),
                    payment_mode:payment_modes!payment_mode_id(name),
                    items:purchase_order_items(id)
                `)
                .eq('company_id', selectedCompany.id)
                .eq('status', 'received')
                .order('updated_at', { ascending: false })
                .limit(10);

            if (received) setRecentReceipts(received);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchOrders();
    }, [selectedCompany]);

    const handleEdit = (order: any) => {
        router.push(`/app/compras/pedidos/${order.id}`);
    };

    return (
        <div className="max-w-7xl mx-auto pb-10 space-y-6">
            <PageHeader
                title="Compras"
                subtitle="Gerencie suas operações."
                children={<ModuleTabs items={tabs} />}
            />

            <div className="space-y-8">
                {/* Incoming Orders */}
                <Card>
                    <CardHeader className="border-b bg-gray-50/50">
                        <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                            Pedidos Aguardando Recebimento
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <PurchasesTable
                            data={incomingOrders}
                            isLoading={isLoading}
                            onEdit={handleEdit}
                            onRefresh={fetchOrders}
                        />
                    </CardContent>
                </Card>

                {/* Recent Receipts History */}
                <Card>
                    <CardHeader className="border-b bg-gray-50/50">
                        <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-green-500"></span>
                            Recebimentos Recentes
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <PurchasesTable
                            data={recentReceipts}
                            isLoading={isLoading}
                            onEdit={handleEdit}
                            onRefresh={fetchOrders}
                        />
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}