
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCompany } from "@/contexts/CompanyContext";
import { createClient } from "@/lib/supabaseBrowser";
import { saveSalesOrderAction } from "@/app/actions/save-sales-order";
import { getSalesDocumentById, upsertSalesDocument, upsertSalesItem, deleteSalesItem } from "@/lib/data/sales-orders";
import { SalesOrder } from "@/types/sales";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Tabs, TabsContent } from "@/components/ui/Tabs";
import { FormTabsList, FormTabsTrigger } from "@/components/ui/FormTabs";
import { useToast } from "@/components/ui/use-toast";
import { TabGeneral } from "./TabGeneral";
import { TabItems } from "./TabItems";
import { TabPayment } from "./TabPayment";
import { TabDelivery } from "./TabDelivery";
import { TabFiscal } from "./TabFiscal";
import { TabHistory } from "./order/TabHistory";
import { Loader2, Save, Ban } from "lucide-react";
import { getFinancialBadgeStyle } from "@/lib/constants/statusColors";
import { normalizeFinancialStatus, normalizeLogisticsStatus, translateLogisticsStatusPt } from "@/lib/constants/status";

interface SalesOrderFormProps {
    id: string; // 'novo' or uuid
}

const emptyDoc: Partial<SalesOrder> = {
    doc_type: 'proposal',
    status_commercial: 'draft',
    status_logistic: 'pending',
    status_fiscal: 'none',
    date_issued: new Date().toISOString().split('T')[0],
    items: [],
    subtotal_amount: 0,
    discount_amount: 0,
    total_amount: 0,
    freight_amount: 0,
    total_weight_kg: 0,
    total_gross_weight_kg: 0
};

export function SalesOrderForm({ id }: SalesOrderFormProps) {
    const isNew = id === 'novo';
    const router = useRouter();
    const { selectedCompany } = useCompany();
    const supabase = createClient();

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [data, setData] = useState<Partial<SalesOrder>>(emptyDoc);
    const [deletedItemIds, setDeletedItemIds] = useState<string[]>([]);
    const [activeTab, setActiveTab] = useState("general");
    const currentLogisticsStatus = normalizeLogisticsStatus(data.status_logistic) || data.status_logistic || "";
    const isLocked = !isNew && ['in_route', 'delivered', 'returned'].includes(currentLogisticsStatus);

    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    useEffect(() => {
        if (!isNew) {
            loadDocument(id);
        }
    }, [id]);

    const loadDocument = async (docId: string) => {
        setLoading(true);
        try {
            const doc = await getSalesDocumentById(supabase, docId);
            if (doc) setData(doc);
        } catch (e) {
            console.error(e);
            setError("Falha ao carregar pedido.");
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (field: keyof SalesOrder, value: any) => {
        setData(prev => {
            const next = { ...prev, [field]: value };

            // Auto-calc totals if items changed
            if (field === 'items') {
                const items = value as any[];
                const subtotal = items.reduce((acc, item) => acc + (Number(item.total_amount) || 0), 0);
                next.subtotal_amount = subtotal;
                const globalDisc = Number(next.discount_amount) || 0;
                next.total_amount = subtotal + (Number(next.freight_amount) || 0) - globalDisc;

                // Calculate Weights (using qty_base if available, or quantity)
                const totalNetWeight = items.reduce((acc, item) => {
                    const weightKg = Number(item.product?.net_weight_kg_base);
                    const weightG = Number(item.product?.net_weight_g_base) || 0;
                    const finalWeight = !isNaN(weightKg) && weightKg > 0 ? weightKg : (weightG / 1000);

                    const qty = Number(item.qty_base) || Number(item.quantity) || 0;
                    return acc + (finalWeight * qty);
                }, 0);

                const totalGrossWeight = items.reduce((acc, item) => {
                    const weightKg = Number(item.product?.gross_weight_kg_base);
                    const weightG = Number(item.product?.gross_weight_g_base) || 0;
                    const finalWeight = !isNaN(weightKg) && weightKg > 0 ? weightKg : (weightG / 1000);

                    const qty = Number(item.qty_base) || Number(item.quantity) || 0;
                    return acc + (finalWeight * qty);
                }, 0);

                next.total_weight_kg = totalNetWeight;
                next.total_gross_weight_kg = totalGrossWeight;
            }

            return next;
        });
    };

    // Intercept item deletion to track IDs
    const handleItemChangeWrapper = (field: keyof SalesOrder, value: any) => {
        if (field === 'items') {
            const newItems = value as any[];
            const oldItems = data.items || [];

            // Find removed items that had a real ID
            const activeIds = new Set(newItems.map(i => i.id));
            const removed = oldItems.filter(i => i.id && !i.id.startsWith('temp-') && !activeIds.has(i.id));

            if (removed.length > 0) {
                setDeletedItemIds(prev => [...prev, ...removed.map(r => r.id!)]);
            }
        }
        handleChange(field, value);
    };

    const { toast } = useToast();

    // ...

    const handleSave = async () => {
        setSaving(true);
        setError(null);
        setSuccess(null);
        try {
            // 1. Validation
            const validationErrors: string[] = [];
            if (!data.client_id) validationErrors.push("Selecione um cliente.");
            if (!selectedCompany) validationErrors.push("Empresa não selecionada.");

            if (validationErrors.length > 0) {
                toast({
                    title: "Erro de Validação",
                    description: validationErrors.join("\n"),
                    variant: "destructive"
                });
                setSaving(false);
                return;
            }

            // Prep payload
            const payload = { ...data, company_id: selectedCompany!.id };

            // 2. Call Server Action
            const result = await saveSalesOrderAction(payload, data.items || [], deletedItemIds, "");

            if (!result || !result.success || !(result as any).data) {
                // Throw specific error to be caught below
                throw new Error(result?.error || "Erro ao salvar.");
            }

            const savedDoc = (result as any).data;

            toast({
                title: "Sucesso",
                description: "Pedido salvo com sucesso.",
                variant: "default"
            });
            setDeletedItemIds([]); // Clear deleted

            if (isNew) {
                router.push(`/app/vendas/pedidos/${savedDoc.id}`);
            } else {
                // Reload
                loadDocument(savedDoc.id);
            }

        } catch (e: any) {
            console.error("Erro Técnico ao Salvar:", e);
            const msg = e.message || "";
            // If it's a known non-technical error, we might show it. 
            // But for RLS/Postgres, we hide it.
            const isTechnical = msg.includes("row-level security") || msg.includes("violates") || msg.includes("syntax");

            toast({
                title: "Erro ao Salvar",
                description: isTechnical ? "Falha interna ao processar o pedido. Tente novamente." : msg,
                variant: "destructive"
            });
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-8"><Loader2 className="animate-spin w-8 h-8" /></div>;

    const badgeClass = "px-2 py-1 rounded text-xs font-semibold mr-2";

    return (
        <div className="space-y-6">
            <PageHeader
                title={isNew ? "Novo Documento" : `Pedido #${data.document_number || '---'}`}
                subtitle={data.client?.trade_name || "Novo Cliente"}
                actions={
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => router.back()}>
                            Cancelar
                        </Button>
                        <Button onClick={handleSave} disabled={saving || isLocked} data-testid="order-save-button">
                            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            <Save className="w-4 h-4 mr-2" /> Salvar
                        </Button>
                    </div>
                }
            >
                <div className="flex items-center gap-4 mt-4">
                    <span className={`${badgeClass} bg-blue-100 text-blue-800`}>
                        Comercial: {data.status_commercial?.toUpperCase()}
                    </span>
                    <span className={`${badgeClass} bg-yellow-100 text-yellow-800`}>
                        Logístico: {translateLogisticsStatusPt(data.status_logistic).toUpperCase()}
                    </span>
                    <span className={`${badgeClass} bg-gray-100 text-gray-800`}>
                        Fiscal: {data.status_fiscal?.toUpperCase()}
                    </span>
                    <span className={`${badgeClass} ${getFinancialBadgeStyle(normalizeFinancialStatus(data.financial_status) || data.financial_status || 'pending').bg} ${getFinancialBadgeStyle(normalizeFinancialStatus(data.financial_status) || data.financial_status || 'pending').text}`}>
                        Fin.: {getFinancialBadgeStyle(normalizeFinancialStatus(data.financial_status) || data.financial_status || 'pending').label.toUpperCase()}
                    </span>
                </div>
            </PageHeader>

            <div className="px-6 pb-0">
                {isLocked && (
                    <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg flex items-center gap-3 text-amber-800 mb-6 shadow-sm">
                        <Ban className="w-5 h-5" />
                        <div className="text-sm font-medium">
                            Este pedido está com status logístico <strong>{translateLogisticsStatusPt(data.status_logistic).toUpperCase()}</strong> e não pode mais ser alterado.
                        </div>
                    </div>
                )}
            </div>

            <div className="px-6">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <FormTabsList className="px-0 border-b-0 space-x-0 bg-transparent">
                        <FormTabsTrigger value="general">Geral</FormTabsTrigger>
                        <FormTabsTrigger value="items">Itens</FormTabsTrigger>
                        <FormTabsTrigger value="payment">Pagamento</FormTabsTrigger>
                        <FormTabsTrigger value="delivery">Entrega</FormTabsTrigger>
                        <FormTabsTrigger value="fiscal">Fiscal (NF-e)</FormTabsTrigger>
                        <FormTabsTrigger value="history">Histórico</FormTabsTrigger>
                    </FormTabsList>

                    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden mt-6">
                        <div className="p-6">
                            <TabsContent value="general" className="focus-visible:outline-none mt-0">
                                <TabGeneral data={data} onChange={handleChange} disabled={isLocked} />
                            </TabsContent>
                            <TabsContent value="items" className="focus-visible:outline-none mt-0">
                                <TabItems items={data.items || []} onChange={(items) => handleItemChangeWrapper('items', items)} orderId={data.id} disabled={isLocked} />
                            </TabsContent>
                            <TabsContent value="payment" className="focus-visible:outline-none mt-0">
                                <TabPayment data={data} onChange={handleChange} disabled={isLocked} />
                            </TabsContent>
                            <TabsContent value="delivery" className="focus-visible:outline-none mt-0">
                                <TabDelivery data={data} onChange={handleChange} disabled={isLocked} />
                            </TabsContent>
                            <TabsContent value="fiscal" className="focus-visible:outline-none mt-0">
                                {data.id ? <TabFiscal order={data as any} /> : <div className="p-12 text-center text-gray-400">Salve o pedido para gerenciar documentos fiscais</div>}
                            </TabsContent>
                            <TabsContent value="history" className="focus-visible:outline-none mt-0">
                                {data.id ? <TabHistory orderId={data.id} /> : <div className="p-12 text-center text-gray-400">Salve o pedido para ver o histórico</div>}
                            </TabsContent>
                        </div>
                    </div>
                </Tabs>
            </div>
        </div>
    );
}
