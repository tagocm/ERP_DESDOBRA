"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabaseBrowser";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { DecimalInput } from "@/components/ui/DecimalInput";
import { Label } from "@/components/ui/Label";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";
import { Tabs, TabsContent } from "@/components/ui/Tabs";
import { FormTabsList, FormTabsTrigger } from "@/components/ui/FormTabs";
import { useToast } from "@/components/ui/use-toast";
import { SalesOrder, SalesOrderItem, SalesOrderAdjustment, DeliveryRoute } from "@/types/sales";
import {
    upsertSalesDocument,
    upsertSalesItem,
    confirmOrder,
    deleteSalesItem,
    getLastOrderForClient,
    softDeleteSalesOrder,
    createSalesAdjustment,
    updateOrderItemFulfillment,
    dispatchOrder
} from "@/lib/data/sales-orders";
import {
    ArrowLeft,
    Save,
    CheckCircle,
    MoreVertical,
    Plus,
    Trash2,
    ChevronDown,
    ChevronUp,
    AlertCircle,
    Edit2,
    Printer,
    Loader2,
    RotateCcw,
    Archive as IconArchive,
    Package,
    DollarSign,
    Box,
    Truck
} from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from "@/components/ui/DropdownMenu";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/Dialog";
import { cn, formatCurrency } from "@/lib/utils";
import { OrganizationSelector } from "@/components/app/OrganizationSelector";
import { ProductSelector } from "@/components/app/ProductSelector";
import { useCompany } from "@/contexts/CompanyContext";
import { addOrderToRoute, getTodayRoutes, getOrCreateDailyRoute } from "@/lib/data/expedition";

interface SalesOrderFormProps {
    initialData?: SalesOrder;
    mode: 'create' | 'edit';
}

export function SalesOrderForm({ initialData, mode }: SalesOrderFormProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const supabase = createClient();
    const { toast } = useToast();
    const { selectedCompany } = useCompany();

    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [showMoreOptions, setShowMoreOptions] = useState(false);
    const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
    const [startNewAfterConfirm, setStartNewAfterConfirm] = useState(false);
    const [redirectToSeparation, setRedirectToSeparation] = useState(false);
    const [activeTab, setActiveTab] = useState("details");

    // Modals state
    const [deleteDraftOpen, setDeleteDraftOpen] = useState(false);
    const [archiveOpen, setArchiveOpen] = useState(false);
    const [archiveReason, setArchiveReason] = useState("");

    // Dispatch Modal States
    const [dispatchModalOpen, setDispatchModalOpen] = useState(false);
    const [dispatchMode, setDispatchMode] = useState<'avulsa' | 'existing'>('avulsa');
    const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
    const [availableRoutes, setAvailableRoutes] = useState<DeliveryRoute[]>([]);

    // Adjustments
    const [adjustments, setAdjustments] = useState<SalesOrderAdjustment[]>(initialData?.adjustments || []);
    const [showAdjustmentDialog, setShowAdjustmentDialog] = useState(false); // We'll just use a simple prompt or inline row for MVP

    // Metadata State (for dropdowns)
    const [priceTables, setPriceTables] = useState<any[]>([]);
    const [paymentTerms, setPaymentTerms] = useState<any[]>([]);
    const [branches, setBranches] = useState<any[]>([]);
    const [clientAddresses, setClientAddresses] = useState<any[]>([]);

    // Form State
    const [formData, setFormData] = useState<Partial<SalesOrder>>({
        status_commercial: 'draft',
        status_logistic: 'pending',
        status_fiscal: 'none',
        date_issued: new Date().toISOString().split('T')[0],
        subtotal_amount: 0,
        discount_amount: 0,
        freight_amount: 0,
        total_amount: 0,
        doc_type: 'order',
        items: [],
        ...initialData
    });

    // Customer Extra Info State (for display summary)
    const [customerInfo, setCustomerInfo] = useState<{
        tradeName?: string;
        address?: string;
        priceTableName?: string;
        paymentTermsName?: string;
        doc?: string;
        cityState?: string;
    }>({
        tradeName: initialData?.client?.trade_name,
        doc: initialData?.client?.document
    });

    // Quick Add Item State
    const [quickItem, setQuickItem] = useState<{
        product: any | null;
        quantity: number;
        price: number;
    }>({ product: null, quantity: 1, price: 0 });

    // Refs for focus management
    const quickAddProductRef = useRef<HTMLDivElement>(null);
    const quickAddQtyRef = useRef<HTMLInputElement>(null);


    // --- EFFECT: Handle Tab Query Param ---
    useEffect(() => {
        const tab = searchParams.get('tab');
        if (tab === 'separation' || tab === 'separacao') {
            setActiveTab('separation');
        }
    }, [searchParams]);

    // --- 1. Initial Data Fetching ---
    useEffect(() => {
        if (!selectedCompany) return;
        const fetchData = async () => {
            // Fetch Price Tables
            const { data: pt } = await supabase.from('price_tables').select('id, name').eq('company_id', selectedCompany.id);
            if (pt) setPriceTables(pt);

            // Fetch Payment Terms
            const { data: pay } = await supabase.from('payment_terms').select('id, name').eq('company_id', selectedCompany.id);
            if (pay) setPaymentTerms(pay);

            // Fetch Branches
            const { data: settings } = await supabase
                .from('company_settings')
                .select('branches')
                .eq('company_id', selectedCompany.id)
                .single();
            if (settings?.branches && Array.isArray(settings.branches)) {
                setBranches(settings.branches);
            }
        };
        fetchData();
    }, [selectedCompany, supabase]);

    // --- 2. Auto-fill Customer Data ---
    const handleCustomerSelect = async (org: any) => {
        if (!org) {
            setFormData(prev => ({ ...prev, client_id: undefined }));
            setCustomerInfo({});
            setClientAddresses([]);
            return;
        }

        // Fetch detailed organization info
        const { data: fullOrg } = await supabase
            .from('organizations')
            .select('*, addresses(*)')
            .eq('id', org.id)
            .single();

        if (fullOrg) {
            // Defaults
            const priceTableId = fullOrg.price_table_id || (priceTables.length > 0 ? priceTables[0].id : undefined);
            const paymentTermsId = fullOrg.payment_terms_id || (paymentTerms.length > 0 ? paymentTerms[0].id : undefined);

            // Address logic: Pick 'billing' or first available
            const addresses = fullOrg.addresses || [];
            setClientAddresses(addresses);

            const address = addresses.find((a: any) => a.type === 'billing') || addresses[0];
            const addressStr = address ? `${address.street}, ${address.number} - ${address.neighborhood}` : "Endereço não cadastrado";
            const cityState = address ? `${address.city}/${address.state}` : "";

            setFormData(prev => ({
                ...prev,
                client_id: fullOrg.id,
                price_table_id: priceTableId,
                payment_terms_id: paymentTermsId,
                delivery_address_json: address, // Snapshot
            }));

            const ptName = priceTables.find(p => p.id === priceTableId)?.name || 'Padrão';
            const payName = paymentTerms.find(p => p.id === paymentTermsId)?.name || 'Padrão';

            setCustomerInfo({
                tradeName: fullOrg.trade_name,
                doc: fullOrg.document,
                address: addressStr,
                cityState: cityState,
                priceTableName: ptName,
                paymentTermsName: payName
            });
        }
    };

    // Update address when selected from More Options
    const handleAddressChange = (addressId: string) => {
        const addr = clientAddresses.find(a => a.id === addressId);
        if (addr) {
            const addressStr = `${addr.street}, ${addr.number} - ${addr.neighborhood}`;
            const cityState = `${addr.city}/${addr.state}`;
            setFormData(prev => ({ ...prev, delivery_address_json: addr }));
            setCustomerInfo(prev => ({ ...prev, address: addressStr, cityState }));
        }
    };

    // --- 3. Item Logic ---

    // Calculate Totals
    useEffect(() => {
        const items = formData.items || [];
        const subtotal = items.reduce((acc, item) => acc + (Number(item.total_amount) || 0), 0);

        const total = subtotal + (Number(formData.freight_amount) || 0) - (Number(formData.discount_amount) || 0);

        setFormData(prev => {
            if (prev.total_amount === total && prev.subtotal_amount === subtotal) return prev;
            return {
                ...prev,
                subtotal_amount: subtotal,
                total_amount: total >= 0 ? total : 0
            };
        });
    }, [formData.items, formData.freight_amount, formData.discount_amount]);

    const handleQuickItemSelect = async (product: any) => {
        if (!product) {
            setQuickItem(prev => ({ ...prev, product: null, price: 0 }));
            return;
        }

        let price = Number(product.sale_price || product.price || 0);

        // Fetch price from selected Price Table if available
        if (formData.price_table_id) {
            const { data } = await supabase
                .from('price_table_items')
                .select('price')
                .eq('price_table_id', formData.price_table_id)
                .eq('item_id', product.id)
                .single();

            if (data && data.price !== undefined) {
                price = Number(data.price);
            }
        }

        setQuickItem({
            product: product,
            quantity: 1,
            price: price
        });

        // Focus Quantity after selection
        setTimeout(() => quickAddQtyRef.current?.focus(), 50);
    };

    const addQuickItem = () => {
        if (!quickItem.product) return;
        if (quickItem.quantity <= 0) {
            toast({ title: "Quantidade inválida", variant: "destructive" });
            return;
        }

        const total = quickItem.quantity * quickItem.price; // Discount?

        const newItem: SalesOrderItem = {
            id: `temp-${Date.now()}`,
            document_id: formData.id || '',
            item_id: quickItem.product.id,
            quantity: quickItem.quantity,
            unit_price: quickItem.price,
            discount_amount: 0,
            total_amount: total,
            product: {
                id: quickItem.product.id,
                name: quickItem.product.name,
                un: quickItem.product.un || 'UN',
                sku: quickItem.product.sku
            }
        };

        setFormData(prev => ({
            ...prev,
            items: [...(prev.items || []), newItem]
        }));

        // Reset
        setQuickItem({ product: null, quantity: 1, price: 0 });
    };

    const handleRemoveItem = (index: number) => {
        const newItems = [...(formData.items || [])];
        newItems.splice(index, 1);
        setFormData(prev => ({ ...prev, items: newItems }));
    };

    const handleUpdateItem = (index: number, field: keyof SalesOrderItem, value: any) => {
        const newItems = [...(formData.items || [])];
        const item = { ...newItems[index], [field]: value };

        // Recalculate Line Total
        if (field === 'quantity' || field === 'unit_price' || field === 'discount_amount') {
            const qty = Number(field === 'quantity' ? value : item.quantity) || 0;
            const price = Number(field === 'unit_price' ? value : item.unit_price) || 0;
            const discount = Number(field === 'discount_amount' ? value : item.discount_amount) || 0;
            item.total_amount = (qty * price) - discount;
        }

        newItems[index] = item;
        setFormData(prev => ({ ...prev, items: newItems }));
    };

    const [repeatOrderError, setRepeatOrderError] = useState(false);

    const handleRepeatLastOrder = async () => {
        if (!formData.client_id) return;

        setRepeatOrderError(false);
        setIsLoading(true);
        try {
            const lastOrder = await getLastOrderForClient(supabase, formData.client_id);

            if (!lastOrder || !lastOrder.items || lastOrder.items.length === 0) {
                setRepeatOrderError(true);
                // Auto hide after 5 seconds
                setTimeout(() => setRepeatOrderError(false), 5000);
                setIsLoading(false);
                return;
            }

            // Clone Items
            const newItems = lastOrder.items.map((item: any) => ({
                id: `copy-${Date.now()}-${Math.random()}`,
                document_id: formData.id || '',
                item_id: item.item_id,
                quantity: item.quantity,
                unit_price: item.unit_price,
                discount_amount: item.discount_amount || 0,
                total_amount: item.total_amount,
                product: {
                    id: item.product?.id || item.item_id,
                    name: item.product?.name || 'Produto',
                    un: item.product?.un || 'UN',
                    sku: item.product?.sku || ''
                }
            }));

            setFormData(prev => ({
                ...prev,
                items: newItems,
            }));

            toast({ title: "Itens copiados", description: `Copiados ${newItems.length} itens do pedido #${lastOrder.document_number || 'anterior'}.` });
        } catch (e: any) {
            console.error('Erro ao repetir pedido:', e);
            const errorMsg = e?.message || e?.error_description || 'Falha ao buscar último pedido.';
            toast({ title: "Erro", description: errorMsg, variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };


    const executeSave = async (status: 'draft' | 'confirmed') => {
        if (!formData.client_id) {
            throw new Error("Selecione o Cliente.");
        }
        if ((!formData.items || formData.items.length === 0) && status === 'confirmed') {
            throw new Error("Adicione pelo menos um item.");
        }

        console.log("ACTIVE_COMPANY_ID", selectedCompany?.id);

        if (!selectedCompany?.id) {
            throw new Error("Erro Crítico: Empresa não identificada. Recarregue a página.");
        }

        const savedOrder = await upsertSalesDocument(supabase, {
            ...formData,
            company_id: selectedCompany.id,
            status_commercial: status
        });

        if (formData.items) {
            for (const item of formData.items) {
                await upsertSalesItem(supabase, {
                    ...item,
                    document_id: savedOrder.id,
                    company_id: savedOrder.company_id // Fix: RLS requires company_id on items
                });
            }
        }
        return savedOrder;
    };

    const handleSaveDraft = async () => {
        setIsSaving(true);
        try {
            await executeSave('draft');
            toast({ title: "Orçamento Salvo", description: "Pedido salvo na lista de orçamentos." });
            router.push('/app/vendas/pedidos');
        } catch (e: any) {
            console.error(e);

            const msg = e?.message?.includes('permis')
                ? "Falha de permissão ao salvar."
                : (e?.message || "Falha ao salvar. Tente novamente.");

            toast({ title: "Erro ao salvar", description: msg, variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };
    const handleSaveDraftAndNew = async () => {
        setIsSaving(true);
        try {
            await executeSave('draft');
            toast({ title: "Orçamento Salvo", description: "Iniciando novo pedido..." });

            if (mode === 'create') {
                window.location.reload();
            } else {
                router.push('/app/vendas/pedidos/novo');
            }
        } catch (e: any) {
            toast({ title: "Erro", description: e.message, variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };

    const handleConfirmAndNew = async () => {
        handleConfirmTrigger({ isNew: true });
    };

    const handleConfirmAndNavigateToSeparation = async () => {
        handleConfirmTrigger({ redirectSeparation: true });
    };



    // --- Actions ---

    const handleConfirmTrigger = (opts?: { isNew?: boolean, redirectSeparation?: boolean } | boolean) => {
        // Handle legacy boolean call if any (though we updated internal calls)
        const isNew = typeof opts === 'boolean' ? opts : opts?.isNew || false;
        const redirectSep = typeof opts === 'object' ? opts?.redirectSeparation || false : false;

        // Validation before opening modal
        if (!formData.client_id) {
            toast({ title: "Selecione o Cliente", description: "Obrigatório para confirmar.", variant: "destructive" });
            return;
        }
        if (!formData.items || formData.items.length === 0) {
            toast({ title: "Adicione Itens", description: "O pedido deve ter pelo menos um item.", variant: "destructive" });
            return;
        }
        // Check for invalid items
        const invalidItem = formData.items.find(i => (i.quantity || 0) <= 0 || (i.unit_price || 0) < 0);
        if (invalidItem) {
            toast({ title: "Item Inválido", description: `Verifique o item "${invalidItem.product?.name}". Qtd deve ser > 0 e Preço >= 0.`, variant: "destructive" });
            return;
        }

        setStartNewAfterConfirm(isNew);
        setRedirectToSeparation(redirectSep);
        setConfirmDialogOpen(true);
    };

    const executeConfirm = async () => {
        setIsLoading(true);
        try {
            const saved = await executeSave('confirmed');

            if (startNewAfterConfirm) {
                toast({ title: "Pedido Confirmado", description: "Criando novo pedido..." });

                if (mode === 'create') {
                    window.location.reload();
                } else {
                    router.push('/app/vendas/pedidos/novo');
                }
            } else if (redirectToSeparation) {
                toast({ title: "Pedido Confirmado", description: "Redirecionando para separação..." });

                if (mode === 'edit') {
                    setActiveTab('separation');
                    setFormData(prev => ({ ...prev, status_commercial: 'confirmed', status_logistic: 'pending' }));
                    router.replace(`/app/vendas/pedidos/${saved.id}?tab=separation`);
                } else {
                    router.push(`/app/vendas/pedidos/${saved.id}?tab=separation`);
                }
            } else {
                toast({ title: "Pedido Confirmado", description: "O pedido entrou em separação." });
                router.push("/app/vendas/pedidos");
            }
        } catch (e: any) {
            console.error(e);
            toast({ title: "Erro na Confirmação", description: e.message, variant: "destructive" });
        } finally {
            setIsLoading(false);
            setConfirmDialogOpen(false);
            setStartNewAfterConfirm(false);
        }
    };


    const handleDispatch = async () => {
        if (!confirm("Confirma o despacho deste pedido?")) return;
        setIsLoading(true);
        try {
            await dispatchOrder(supabase, formData.id!, (await supabase.auth.getUser()).data.user!.id);
            toast({ title: "Pedido Despachado", description: "Status atualizado para Expedição." });
            setFormData(prev => ({ ...prev, status_logistic: 'em_rota' }));
        } catch (e: any) {
            toast({ title: "Erro", description: e.message, variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    const handleArchiveClick = () => {
        setArchiveReason("");
        setArchiveOpen(true);
    };

    const handleDeleteDraftClick = () => {
        setDeleteDraftOpen(true);
    };

    const executeDelete = async (reason: string) => {
        setIsLoading(true);
        try {
            await softDeleteSalesOrder(supabase, formData.id!, (await supabase.auth.getUser()).data.user!.id, reason || "Exclusão manual");
            toast({ title: "Sucesso", description: "Pedido removido/arquivado." });
            router.push('/app/vendas/pedidos');
        } catch (e: any) {
            toast({ title: "Erro", description: e.message, variant: "destructive" });
        } finally {
            setIsLoading(false);
            setDeleteDraftOpen(false);
            setArchiveOpen(false);
        }
    };

    const handleConfirmAndDispatch = async () => {
        // Validations (same as handleConfirmTrigger)
        if (!formData.client_id) {
            toast({ title: "Selecione o Cliente", description: "Obrigatório para confirmar.", variant: "destructive" });
            return;
        }
        if (!formData.items || formData.items.length === 0) {
            toast({ title: "Adicione Itens", description: "O pedido deve ter pelo menos um item.", variant: "destructive" });
            return;
        }
        const invalidItem = formData.items.find(i => (i.quantity || 0) <= 0 || (i.unit_price || 0) < 0);
        if (invalidItem) {
            toast({ title: "Item Inválido", description: `Verifique o item "${invalidItem.product?.name}".`, variant: "destructive" });
            return;
        }

        // Load available routes for today
        try {
            const routes = await getTodayRoutes(supabase, selectedCompany!.id);
            setAvailableRoutes(routes);
        } catch (e) {
            console.error('Error loading routes:', e);
        }

        setDispatchMode('avulsa');
        setSelectedRouteId(null);
        setDispatchModalOpen(true);
    };

    const executeDispatch = async () => {
        setIsLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user || !selectedCompany) throw new Error("Usuário ou empresa não identificados");

            // First, save/confirm the order
            const savedOrder = await executeSave('confirmed');

            let targetRouteId: string;

            if (dispatchMode === 'avulsa') {
                // Create or get daily route
                const dailyRoute = await getOrCreateDailyRoute(supabase, selectedCompany.id);
                targetRouteId = dailyRoute.id;
            } else {
                // Use selected route
                if (!selectedRouteId) {
                    toast({ title: "Selecione uma rota", variant: "destructive" });
                    setIsLoading(false);
                    return;
                }

                // Check if route is already delivered/failed
                const selectedRoute = availableRoutes.find(r => r.id === selectedRouteId);
                if (selectedRoute?.status === 'done' || selectedRoute?.status === 'closed') {
                    const statusLabel = selectedRoute.status === 'done' ? 'CONCLUÍDA' : 'FECHADA';
                    if (!confirm(`Esta rota já está marcada como ${statusLabel}. Deseja inserir este pedido e marcá-lo como ${statusLabel} também?`)) {
                        setIsLoading(false);
                        return;
                    }
                }

                targetRouteId = selectedRouteId;
            }

            // Assign order to route
            await addOrderToRoute(supabase, targetRouteId, savedOrder.id, 999, selectedCompany.id);

            toast({
                title: "Pedido confirmado e despachado",
                description: dispatchMode === 'avulsa'
                    ? "Pedido saiu para entrega imediata."
                    : "Pedido vinculado à rota selecionada."
            });

            setDispatchModalOpen(false);
            router.push("/app/vendas/pedidos");
        } catch (e: any) {
            console.error(e);
            toast({ title: "Erro no despacho", description: e.message, variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };


    const orderLabel = mode === 'create' ? 'Novo Pedido' : `Pedido #${initialData?.document_number?.toString().padStart(4, '0') || '...'}`;

    // Swap logic: Title = Client Name (if selected), Subtitle = "Novo Pedido" or "Pedido #123"
    const displayTitle = customerInfo.tradeName || orderLabel;
    const displaySubtitle = customerInfo.tradeName ? orderLabel : "Selecione um Cliente";

    return (
        <div className="pb-32 font-sans w-full">
            {/* --- HEADER --- */}
            <PageHeader
                title={displayTitle}
                subtitle={displaySubtitle}
                actions={
                    <div className="flex gap-2 items-center">
                        <Button variant="secondary" onClick={() => router.back()} disabled={isSaving} className="font-medium">
                            Cancelar
                        </Button>

                        {/* --- SPLIT BUTTON: SAVE DRAFT --- */}
                        {formData.status_fiscal !== 'authorized' && formData.status_commercial !== 'confirmed' && (
                            <div className="flex items-center -space-x-px">
                                <Button
                                    onClick={handleSaveDraft}
                                    disabled={isSaving || !formData.client_id}
                                    className="rounded-r-none border-r-0 z-10 focus:z-20 font-medium pr-2"
                                >
                                    <Save className="w-4 h-4 mr-2" /> Salvar Orçamento
                                </Button>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            className="rounded-l-none px-2 z-10 focus:z-20 pl-1 border-l-0"
                                            disabled={isSaving || !formData.client_id}
                                        >
                                            <ChevronDown className="w-4 h-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={handleSaveDraftAndNew}>
                                            <Plus className="w-4 h-4 mr-2" /> Salvar e novo
                                        </DropdownMenuItem>
                                        {mode === 'edit' && (
                                            <>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={handleDeleteDraftClick}>
                                                    <Trash2 className="w-4 h-4 mr-2" /> Excluir Orçamento
                                                </DropdownMenuItem>
                                            </>
                                        )}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        )}

                        {/* --- SPLIT BUTTON: CONFIRM --- */}
                        {formData.status_commercial === 'draft' && (
                            <div className="flex items-center -space-x-px">
                                <Button
                                    onClick={() => handleConfirmTrigger()}
                                    disabled={isSaving || isLoading || !formData.client_id || !formData.items?.length}
                                    className="bg-green-600 hover:bg-green-700 text-white rounded-r-none border-r-0 z-10 focus:z-20 font-medium pr-2"
                                >
                                    <CheckCircle className="w-4 h-4 mr-2" /> Confirmar Pedido
                                </Button>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            className="bg-green-600 hover:bg-green-700 text-white rounded-l-none px-2 z-10 focus:z-20 pl-1 border-l-0"
                                            disabled={isSaving || isLoading || !formData.client_id || !formData.items?.length}
                                        >
                                            <ChevronDown className="w-4 h-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={handleConfirmAndNew}>
                                            <Plus className="w-4 h-4 mr-2" /> Confirmar e novo
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={handleConfirmAndDispatch}>
                                            <Truck className="w-4 h-4 mr-2" /> Confirmar e sair para entrega
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={handleConfirmAndNavigateToSeparation} disabled>
                                            <Package className="w-4 h-4 mr-2" /> Confirmar e ir para Separação (Em breve)
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        )}

                        {/* --- DISPATCH ACTION (Existing) --- */}
                        {formData.status_commercial === 'confirmed' && formData.status_logistic === 'pending' && (
                            <div className="flex items-center -space-x-px">
                                <Button onClick={handleDispatch} disabled={isSaving || isLoading} className="bg-blue-600 hover:bg-blue-700 text-white rounded-r-none border-r-0 z-10 focus:z-20 pr-2">
                                    <Truck className="w-4 h-4 mr-2" /> Despachar / Enviar
                                </Button>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button className="bg-blue-600 hover:bg-blue-700 text-white rounded-l-none px-2 z-10 focus:z-20 pl-1 border-l-0" disabled={isSaving || isLoading}>
                                            <ChevronDown className="w-4 h-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={handleArchiveClick}>
                                            <IconArchive className="w-4 h-4 mr-2" /> Arquivar Pedido
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        )}

                        {/* FALLBACK ARCHIVE FOR OTHER STATES */}
                        {formData.status_commercial === 'cancelled' && (
                            <Button variant="outline" onClick={handleArchiveClick} className="text-red-600 hover:text-red-700">
                                <IconArchive className="w-4 h-4 mr-2" /> Excluir Definitivamente
                            </Button>
                        )}
                    </div>
                }
            />

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full mt-6">
                <div className="px-6 border-b border-gray-100 bg-white sticky top-0 z-20">
                    <FormTabsList>
                        <FormTabsTrigger value="details">Detalhes do Pedido</FormTabsTrigger>
                        <FormTabsTrigger value="logistics">Separação & Logística</FormTabsTrigger>
                        <FormTabsTrigger value="financial">Financeiro & Ajustes</FormTabsTrigger>
                    </FormTabsList>
                </div>

                <TabsContent value="details" className="space-y-6 px-6 py-6 focus-visible:outline-none animate-in slide-in-from-left-2 duration-300">
                    <div className="space-y-6">

                        {repeatOrderError && (
                            <Alert variant="destructive" onClose={() => setRepeatOrderError(false)}>
                                <h4 className="font-semibold">Nenhum pedido anterior encontrado</h4>
                                <p>Este cliente não possui histórico de pedidos para importação.</p>
                            </Alert>
                        )}

                        {/* --- BLOCK A: CLIENTE --- */}
                        <div className="bg-white rounded-2xl shadow-card border border-gray-100/70">
                            <div className="p-6 space-y-5">
                                {/* Selector Row */}
                                <div className="flex flex-col md:flex-row gap-6">
                                    <div className="flex-1 space-y-2">
                                        <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Cliente / Destinatário</Label>
                                        <div className="flex gap-2">
                                            <div className="flex-1">
                                                <OrganizationSelector
                                                    value={formData.client_id}
                                                    onChange={handleCustomerSelect}
                                                    type="customer"
                                                />
                                            </div>
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                title="Repetir itens do último pedido"
                                                disabled={!formData.client_id || isLoading}
                                                onClick={handleRepeatLastOrder}
                                                className="shrink-0 text-brand-600 border-brand-200 hover:bg-brand-50 h-10 w-10"
                                            >
                                                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                                            </Button>
                                        </div>
                                    </div>
                                    {/* Read-only Summary - Always visible */}
                                    <div className="flex-[2] bg-gray-50/80 rounded-2xl border border-gray-100 p-4 grid grid-cols-1 md:grid-cols-3 gap-6">
                                        <div>
                                            <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Número</span>
                                            <span className="font-medium text-gray-700 text-sm truncate block">
                                                {mode === 'create' ? '-' : initialData?.document_number?.toString().padStart(4, '0')}
                                            </span>
                                        </div>
                                        <div className="md:col-span-2">
                                            <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Localização / Tabela de Preços / Prazo</span>
                                            <div className="flex items-center gap-2 text-sm">
                                                <span className="font-medium text-gray-900 truncate">{customerInfo.cityState || '-'}</span>
                                                <span className="text-gray-300">•</span>
                                                <span className="font-medium text-brand-600 truncate">{customerInfo.priceTableName || 'Padrão'}</span>
                                                <span className="text-gray-300">•</span>
                                                <span className="font-medium text-brand-600 truncate">{customerInfo.paymentTermsName || 'Padrão'}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* More Options Toggle */}
                                <div>
                                    <button
                                        onClick={() => setShowMoreOptions(!showMoreOptions)}
                                        className="group flex items-center text-sm font-medium text-gray-500 hover:text-brand-600 transition-colors focus:outline-none"
                                    >
                                        <div className={cn("mr-2 p-1 rounded-2xl bg-gray-100 group-hover:bg-brand-50 transition-colors", showMoreOptions && "bg-brand-100 text-brand-600")}>
                                            {showMoreOptions ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                        </div>
                                        {showMoreOptions ? "Ocultar opções avançadas" : "Mostrar endereço completo, tabela e filial"}
                                    </button>

                                    {showMoreOptions && (
                                        <div className="mt-4 pt-4 border-t border-dashed border-gray-200 grid grid-cols-1 md:grid-cols-3 gap-6 animate-in slide-in-from-top-2">
                                            <div>
                                                <Label className="text-xs text-gray-500 mb-1.5 block">Tabela de Preço</Label>
                                                <Select
                                                    value={formData.price_table_id || ''}
                                                    onChange={(e) => setFormData({ ...formData, price_table_id: e.target.value })}
                                                >
                                                    <option value="">Selecione...</option>
                                                    {priceTables.map(pt => <option key={pt.id} value={pt.id}>{pt.name}</option>)}
                                                </Select>
                                            </div>
                                            <div>
                                                <Label className="text-xs text-gray-500 mb-1.5 block">Condição de Pagamento</Label>
                                                <Select
                                                    value={formData.payment_terms_id || ''}
                                                    onChange={(e) => setFormData({ ...formData, payment_terms_id: e.target.value })}
                                                >
                                                    <option value="">Selecione...</option>
                                                    {paymentTerms.map(pt => <option key={pt.id} value={pt.id}>{pt.name}</option>)}
                                                </Select>
                                            </div>
                                            <div>
                                                <Label className="text-xs text-gray-500 mb-1.5 block">Filial Emitente</Label>
                                                <Select disabled value={branches[0]?.id || ''}>
                                                    <option value="">{branches.length ? branches[0].name : "Matriz"}</option>
                                                </Select>
                                            </div>
                                            <div className="md:col-span-3">
                                                <Label className="text-xs text-gray-500 mb-1.5 block">Endereço de Entrega</Label>
                                                <Select
                                                    value={formData.delivery_address_json?.id || ''}
                                                    onChange={(e) => handleAddressChange(e.target.value)}
                                                    disabled={clientAddresses.length === 0}
                                                >
                                                    {clientAddresses.map(addr => (
                                                        <option key={addr.id} value={addr.id}>
                                                            {addr.street}, {addr.number} - {addr.city}/{addr.state} ({addr.type})
                                                        </option>
                                                    ))}
                                                    {clientAddresses.length === 0 && <option value="">Nenhum endereço cadastrado</option>}
                                                </Select>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* --- BLOCK B: ITENS --- */}
                        <div className="bg-white rounded-2xl shadow-card border border-gray-100/70 overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-50 flex justify-between items-center bg-gray-50/30">
                                <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                                    Itens do Pedido
                                    {formData.items && formData.items.length > 0 && (
                                        <span className="bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full text-xs font-bold">
                                            {formData.items.length}
                                        </span>
                                    )}
                                </h3>
                            </div>

                            {/* Quick Add Row - Proportional Layout */}
                            <div className="bg-brand-50/30 border-b border-brand-100/50 flex items-end w-full py-3 px-6 gap-4">
                                <div className="flex-1 space-y-1.5">
                                    <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Adicionar Produto</Label>
                                    <ProductSelector
                                        value={quickItem.product?.id}
                                        onChange={handleQuickItemSelect}
                                    />
                                </div>

                                <div className="w-24 space-y-1.5 flex-shrink-0">
                                    <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block text-center">Qtde</Label>
                                    <DecimalInput
                                        ref={quickAddQtyRef}
                                        className="h-9 w-full text-center border-brand-200 focus:border-brand-500 bg-white"
                                        value={quickItem.quantity}
                                        onChange={(val) => setQuickItem({ ...quickItem, quantity: val || 0 })}
                                        precision={0}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') addQuickItem();
                                        }}
                                    />
                                </div>
                                <div className="w-32 space-y-1.5 flex-shrink-0">
                                    <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block text-center">Preço</Label>
                                    <DecimalInput
                                        className="h-9 w-full text-right border-brand-200 focus:border-brand-500 bg-white"
                                        value={quickItem.price}
                                        onChange={(val) => setQuickItem({ ...quickItem, price: val || 0 })}
                                        precision={2}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') addQuickItem();
                                        }}
                                    />
                                </div>
                                <div className="w-32 flex-shrink-0">
                                    <Button className="w-full h-9 bg-brand-600 hover:bg-brand-700 text-white" onClick={addQuickItem} disabled={!quickItem.product}>
                                        <Plus className="w-4 h-4 md:mr-2" /> <span className="hidden md:inline">Adicionar</span>
                                    </Button>
                                </div>
                            </div>

                            {/* Items Table */}
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left table-fixed">
                                    <thead className="bg-gray-50/50 text-gray-500 font-medium border-b border-gray-100">
                                        <tr>
                                            <th className="py-3 px-6 w-16 text-center text-xs uppercase tracking-wider">#</th>
                                            <th className="py-3 px-6 text-xs uppercase tracking-wider">Produto</th>
                                            <th className="py-3 px-6 w-28 text-center text-xs uppercase tracking-wider">UN</th>
                                            <th className="py-3 px-6 w-32 text-center text-xs uppercase tracking-wider">Qtd</th>
                                            <th className="py-3 px-6 w-40 text-center text-xs uppercase tracking-wider">Preço</th>
                                            <th className="py-3 px-6 w-40 text-center text-xs uppercase tracking-wider">Desc.</th>
                                            <th className="py-3 px-6 w-48 text-right text-xs uppercase tracking-wider">Total</th>
                                            <th className="py-3 px-6 w-16"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {(!formData.items || formData.items.length === 0) && (
                                            <tr>
                                                <td colSpan={8} className="py-12 text-center text-gray-400">
                                                    <div className="flex flex-col items-center gap-2">
                                                        <div className="p-3 bg-gray-50 rounded-full">
                                                            <Plus className="w-6 h-6 text-gray-300" />
                                                        </div>
                                                        <p>Nenhum item adicionado.</p>
                                                        <p className="text-xs text-gray-400">Use a barra superior para adicionar produtos rapidamente.</p>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                        {formData.items?.map((item, idx) => (
                                            <tr key={item.id || idx} className="hover:bg-gray-50/80 group transition-colors">
                                                <td className="py-3 px-6 text-center text-gray-300 text-xs">{idx + 1}</td>
                                                <td className="py-3 px-6 font-medium text-gray-900">
                                                    <div className="flex flex-col">
                                                        <span>{item.product?.name}</span>
                                                        <span className="text-[10px] text-gray-400 font-mono">{item.product?.sku}</span>
                                                    </div>
                                                </td>
                                                <td className="py-3 px-6 text-center text-gray-500 text-xs">{item.product?.un}</td>
                                                <td className="py-3 px-6 text-right">
                                                    <DecimalInput
                                                        className="w-full text-center bg-white border border-gray-200 focus:border-brand-500 focus:ring-1 focus:ring-brand-500/20 rounded-2xl h-9 text-sm font-medium text-gray-700 transition-all"
                                                        value={item.quantity}
                                                        onChange={(val) => handleUpdateItem(idx, 'quantity', val || 0)}
                                                        precision={0}
                                                    />
                                                </td>
                                                <td className="py-3 px-6 text-right">
                                                    <DecimalInput
                                                        className="w-full text-right bg-white border border-gray-200 focus:border-brand-500 focus:ring-1 focus:ring-brand-500/20 rounded-2xl h-9 text-sm font-medium text-gray-700 transition-all"
                                                        value={item.unit_price}
                                                        onChange={(val) => handleUpdateItem(idx, 'unit_price', val || 0)}
                                                        precision={2}
                                                    />
                                                </td>
                                                <td className="py-3 px-6 text-right">
                                                    <DecimalInput
                                                        className="w-full text-right text-red-600 bg-white border border-gray-200 focus:border-red-500 focus:ring-1 focus:ring-red-500/20 rounded-2xl h-9 text-sm transition-all placeholder:text-gray-200"
                                                        value={item.discount_amount}
                                                        onChange={(val) => handleUpdateItem(idx, 'discount_amount', val || 0)}
                                                        precision={2}
                                                    />
                                                </td>
                                                <td className="py-3 px-6 text-right font-semibold text-gray-900 bg-gray-50/30">
                                                    {formatCurrency(item.total_amount)}
                                                </td>
                                                <td className="py-3 px-6 text-center">
                                                    <button
                                                        onClick={() => handleRemoveItem(idx)}
                                                        className="p-1.5 rounded-2xl text-gray-400 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    {/* Footer Totals */}
                                    {formData.items && formData.items.length > 0 && (
                                        <tfoot className="bg-gray-50/50 border-t border-gray-100">
                                            <tr>
                                                <td colSpan={6} className="py-3 px-6 text-right text-gray-500 text-xs uppercase tracking-wider">Subtotal</td>
                                                <td className="py-3 px-6 text-right font-medium text-gray-700">{formatCurrency(formData.subtotal_amount)}</td>
                                                <td></td>
                                            </tr>
                                            <tr>
                                                <td colSpan={6} className="py-2 px-6 text-right text-gray-500 text-xs uppercase tracking-wider">
                                                    <div className="flex items-center justify-end gap-3">
                                                        Frete
                                                        <DecimalInput
                                                            className="w-24 h-8 text-right bg-white border-gray-200 text-sm"
                                                            value={formData.freight_amount}
                                                            onChange={(val) => setFormData({ ...formData, freight_amount: val || 0 })}
                                                            precision={2}
                                                        />
                                                    </div>
                                                </td>
                                                <td className="py-2 px-6 text-right text-gray-700">{formatCurrency(formData.freight_amount)}</td>
                                                <td></td>
                                            </tr>
                                            <tr>
                                                <td colSpan={6} className="py-2 px-6 text-right text-gray-500 text-xs uppercase tracking-wider">
                                                    <div className="flex items-center justify-end gap-3">
                                                        Desconto Global
                                                        <DecimalInput
                                                            className="w-24 h-8 text-right bg-white border-gray-200 text-red-600 text-sm"
                                                            value={formData.discount_amount}
                                                            onChange={(val) => setFormData({ ...formData, discount_amount: val || 0 })}
                                                            precision={2}
                                                        />
                                                    </div>
                                                </td>

                                                <td className="py-2 px-6 text-right text-red-600 font-medium">-{formatCurrency(formData.discount_amount)}</td>
                                                <td></td>
                                            </tr>
                                            <tr className="bg-white border-t border-gray-200">
                                                <td colSpan={6} className="py-4 px-6 text-right text-sm font-bold text-gray-900 uppercase">Total do Pedido</td>
                                                <td className="py-4 px-6 text-right text-xl font-bold text-brand-700 bg-brand-50/10 whitespace-nowrap">{formatCurrency(formData.total_amount)}</td>
                                                <td></td>
                                            </tr>
                                        </tfoot>
                                    )}
                                </table>
                            </div>
                        </div>

                        {/* --- BLOCK C: FINALIZAÇÃO --- */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-white rounded-2xl shadow-card border border-gray-100/70 p-6 space-y-3">
                                <Label className="text-gray-900 font-medium flex items-center gap-2">
                                    <Edit2 className="w-3 h-3 text-gray-400" /> Observações Internas
                                </Label>
                                <Textarea
                                    placeholder="Anote detalhes importantes para a equipe..."
                                    className="bg-gray-50 border-gray-200 h-24 resize-none focus:bg-white transition-colors"
                                    value={formData.internal_notes || ''}
                                    onChange={(e) => setFormData({ ...formData, internal_notes: e.target.value })}
                                />
                            </div>
                            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-3">
                                <Label className="text-gray-900 font-medium flex items-center gap-2">
                                    <Printer className="w-3 h-3 text-gray-400" /> Observações para o Cliente
                                </Label>
                                <Textarea
                                    placeholder="Estas informações sairão na impressão do pedido..."
                                    className="bg-gray-50 border-gray-200 h-24 resize-none focus:bg-white transition-colors"
                                    value={formData.client_notes || ''}
                                    onChange={(e) => setFormData({ ...formData, client_notes: e.target.value })}
                                />
                            </div>
                        </div>

                        {/* Floating Footer Action (Mobile mainly) */}
                        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 md:hidden z-30 flex justify-between items-center safe-area-bottom">
                            <div className="flex flex-col">
                                <span className="text-xs text-gray-500 uppercase">Total</span>
                                <span className="text-lg font-bold text-brand-700">{formatCurrency(formData.total_amount)}</span>
                            </div>
                            <Button onClick={() => handleConfirmTrigger(false)} className="bg-green-600 hover:bg-green-700 text-white font-medium" disabled={isSaving || isLoading}>
                                Confirmar Pedido
                            </Button>
                        </div>
                    </div>



                </TabsContent>

                <TabsContent value="logistics" className="px-6 py-6 focus-visible:outline-none animate-in slide-in-from-left-2 duration-300">
                    <div className="bg-white rounded-2xl shadow-card border border-gray-100/70 p-12 text-center text-gray-500">
                        <Package className="w-12 h-12 mx-auto mb-4 opacity-20" />
                        <h3 className="text-lg font-medium text-gray-900">Em Desenvolvimento</h3>
                        <p>A gestão de separação e logística será implementada aqui.</p>
                    </div>
                </TabsContent>

                <TabsContent value="financial" className="px-6 py-6 focus-visible:outline-none animate-in slide-in-from-left-2 duration-300">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center text-gray-500">
                        <DollarSign className="w-12 h-12 mx-auto mb-4 opacity-20" />
                        <h3 className="text-lg font-medium text-gray-900">Financeiro & Ajustes</h3>
                        <p>Visualize pagamentos, status financeiro e crie ajustes aqui.</p>
                    </div>
                </TabsContent>
            </Tabs>
            {/* CONFIRMATION DIALOG */}
            <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirmar pedido?</DialogTitle>
                        <DialogDescription>
                            Ao confirmar, o pedido entra em Separação/Logística. Você ainda poderá editar depois.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setConfirmDialogOpen(false)}>Cancelar</Button>
                        <Button onClick={executeConfirm} className="bg-green-600 hover:bg-green-700 text-white" disabled={isLoading}>
                            {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                            Confirmar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* MODAL 1: DELETE DRAFT */}
            <AlertDialog open={deleteDraftOpen} onOpenChange={setDeleteDraftOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Excluir orçamento?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Isso remove o orçamento e todos os seus itens. Essa ação não pode ser desfeita. (Soft Delete)
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isLoading}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault();
                                executeDelete("Exclusão de Orçamento");
                            }}
                            className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
                            disabled={isLoading}
                        >
                            {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
                            Excluir
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* MODAL 2: ARCHIVE ORDER */}
            <Dialog open={archiveOpen} onOpenChange={setArchiveOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Arquivar pedido?</DialogTitle>
                        <DialogDescription>
                            O pedido ficará arquivado e não aparecerá nas listas padrão.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Label>Motivo (opcional)</Label>
                        <Textarea
                            placeholder="Desistência do cliente, erro de lançamento, etc."
                            value={archiveReason}
                            onChange={(e) => setArchiveReason(e.target.value)}
                            className="mt-2"
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setArchiveOpen(false)} disabled={isLoading}>Cancelar</Button>
                        <Button
                            variant="danger"
                            onClick={() => executeDelete(archiveReason || "Arquivado pelo usuário sem motivo")}
                            disabled={isLoading}
                        >
                            {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <IconArchive className="w-4 h-4 mr-2" />}
                            Arquivar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* DISPATCH MODAL */}
            <Dialog open={dispatchModalOpen} onOpenChange={setDispatchModalOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Sair para entrega</DialogTitle>
                        <DialogDescription>
                            Escolha como deseja lançar este pedido na logística. Rotas disponíveis apenas do dia atual.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="space-y-3">
                            <label className="flex items-center space-x-3 cursor-pointer">
                                <input
                                    type="radio"
                                    name="dispatchMode"
                                    value="avulsa"
                                    checked={dispatchMode === 'avulsa'}
                                    onChange={() => setDispatchMode('avulsa')}
                                    className="w-4 h-4 text-green-600 focus:ring-green-500"
                                />
                                <span className="text-sm font-medium text-gray-900">
                                    Rota avulsa (Hoje)
                                </span>
                            </label>

                            <label className="flex items-center space-x-3 cursor-pointer">
                                <input
                                    type="radio"
                                    name="dispatchMode"
                                    value="existing"
                                    checked={dispatchMode === 'existing'}
                                    onChange={() => setDispatchMode('existing')}
                                    className="w-4 h-4 text-green-600 focus:ring-green-500"
                                />
                                <span className="text-sm font-medium text-gray-900">
                                    Escolher uma rota existente
                                </span>
                            </label>
                        </div>

                        {dispatchMode === 'existing' && (
                            <div className="ml-7 space-y-2">
                                <Label className="text-xs text-gray-500">Selecione a rota</Label>
                                <Select
                                    value={selectedRouteId || ''}
                                    onChange={(e) => setSelectedRouteId(e.target.value)}
                                    className="w-full"
                                >
                                    <option value="">Selecione...</option>
                                    {availableRoutes.map(route => (
                                        <option key={route.id} value={route.id}>
                                            {route.name} ({route.orders?.length || 0} pedidos)
                                        </option>
                                    ))}
                                </Select>
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDispatchModalOpen(false)}>
                            Cancelar
                        </Button>
                        <Button
                            onClick={executeDispatch}
                            className="bg-green-600 hover:bg-green-700 text-white"
                            disabled={isLoading || (dispatchMode === 'existing' && !selectedRouteId)}
                        >
                            {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                            Confirmar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </div >
    );
}
