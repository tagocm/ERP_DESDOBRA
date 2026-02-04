"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseBrowser";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Textarea } from "@/components/ui/Textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { Card, CardContent } from "@/components/ui/Card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { FormTabsList, FormTabsTrigger } from "@/components/ui/FormTabs";
import { useToast } from "@/components/ui/use-toast";
import {
    createPurchaseOrderAction,
    updatePurchaseOrderAction,
    receivePurchaseOrderAction,
    cancelPurchaseOrderAction,

} from "@/app/actions/purchases";
import {
    ArrowLeft,
    Save,
    CheckCircle,
    Plus,
    Trash2,
    Calendar,
    Building2,
    DollarSign,
    Package,
    Loader2,
    Calculator,
    ChevronUp,
    ChevronDown
} from "lucide-react";

import { ReceiptModal, ReceiptData } from "./ReceiptModal";

import { DecimalInput } from "@/components/ui/DecimalInput";
import { ConfirmDialogDesdobra } from "@/components/ui/ConfirmDialogDesdobra";
import { formatCurrency, cn } from "@/lib/utils";
import { useCompany } from "@/contexts/CompanyContext";
import { getPaymentModes, PaymentMode } from "@/lib/data/payment-modes";
import { OrganizationSelector } from "@/components/app/OrganizationSelector";
import { ProductSelector } from "@/components/app/ProductSelector";

interface PurchaseOrderFormProps {
    initialData?: any;
    mode: 'create' | 'edit';
}

export function PurchaseOrderForm({ initialData, mode }: PurchaseOrderFormProps) {
    const router = useRouter();
    const supabase = createClient();
    const { toast } = useToast();
    const { selectedCompany } = useCompany();

    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [activeTab, setActiveTab] = useState("items");

    // Form Data State
    const [formData, setFormData] = useState<any>({
        id: initialData?.id,
        document_number: initialData?.document_number,
        supplier_id: initialData?.supplier_id || '',
        payment_terms_id: initialData?.payment_terms_id || '',
        payment_mode_id: initialData?.payment_mode_id || '',
        price_table_id: initialData?.price_table_id || '',
        expected_at: initialData?.expected_at || '',
        notes: initialData?.notes || '',
        freight_amount: initialData?.freight_amount || 0,
        discount_amount: initialData?.discount_amount || 0,
        items: initialData?.items || [],
        status: initialData?.status || 'draft'
    });

    // Metadata State
    const [priceTables, setPriceTables] = useState<any[]>([]);
    const [paymentTerms, setPaymentTerms] = useState<any[]>([]);
    const [paymentModes, setPaymentModes] = useState<PaymentMode[]>([]);
    const [supplierInfo, setSupplierInfo] = useState<any>(null);

    // Dialog State
    const [actionDialog, setActionDialog] = useState<{
        isOpen: boolean;
        type: 'cancel' | null; // Removed 'receive' from here as it uses a dedicated modal
    }>({ isOpen: false, type: null });

    const [showReceiptModal, setShowReceiptModal] = useState(false);

    // Quick Add Item State
    const [quickItem, setQuickItem] = useState<{
        product: any | null;
        quantity: number;
        price: number;
        uom: string;
        packagingId: string | null;
        packagings: any[];
    }>({ product: null, quantity: 1, price: 0, uom: 'UN', packagingId: null, packagings: [] });

    const quickAddProductRef = useRef<HTMLInputElement>(null);
    const quickAddQtyRef = useRef<HTMLInputElement>(null);

    // --- Initial Fetch ---
    useEffect(() => {
        if (!selectedCompany) return;
        const fetchData = async () => {
            const { data: pt } = await supabase.from('price_tables').select('id, name').eq('company_id', selectedCompany.id);
            if (pt) setPriceTables(pt);

            const { data: pay } = await supabase.from('payment_terms').select('id, name').eq('company_id', selectedCompany.id);
            if (pay) setPaymentTerms(pay);

            getPaymentModes(selectedCompany.id).then(setPaymentModes).catch(console.error);

            if (initialData?.supplier) {
                setSupplierInfo(initialData.supplier);
            }
        };
        fetchData();
    }, [selectedCompany, supabase, initialData]);

    const [showMoreOptions, setShowMoreOptions] = useState(false);

    // --- Calculations ---
    const calculateTotals = () => {
        const subtotal = formData.items.reduce((acc: number, item: any) => {
            const qty = Number(item.qty_display) || 0;
            const cost = Number(item.unit_cost) || 0;
            const discount = Number(item.discount_amount) || 0;
            return acc + (qty * cost - discount);
        }, 0);

        const total = subtotal + Number(formData.freight_amount || 0) - Number(formData.discount_amount || 0);
        return { subtotal, total };
    };

    const { subtotal, total } = calculateTotals();

    // --- Handlers ---
    const handleSupplierSelect = async (org: any) => {
        if (!org) {
            setFormData((prev: any) => ({ ...prev, supplier_id: '' }));
            setSupplierInfo(null);
            return;
        }

        // Fetch detailed organization info including addresses (matching SalesOrderForm pattern)
        const { data: fullOrg } = await supabase
            .from('organizations')
            .select('*, addresses(*)')
            .eq('id', org.id)
            .single();

        const finalOrg = fullOrg || org;

        // @ts-ignore
        const addresses = finalOrg?.addresses || [];
        const address = addresses.find((a: any) => a.type === 'billing') || addresses[0];

        setFormData((prev: any) => ({
            ...prev,
            supplier_id: org.id,
            payment_terms_id: finalOrg?.payment_terms_id || prev.payment_terms_id,
            payment_mode_id: finalOrg?.payment_mode_id || prev.payment_mode_id,
        }));

        setSupplierInfo({
            ...finalOrg,
            name: finalOrg.trade_name || finalOrg.legal_name || finalOrg.name,
            city: address?.city,
            state: address?.state
        });
    };

    const handleQuickItemSelect = async (product: any) => {
        if (!product) {
            setQuickItem({ product: null, quantity: 1, price: 0, uom: 'UN', packagingId: null, packagings: [] });
            return;
        }

        // Fetch Packagings
        let packagings: any[] = [];
        try {
            const { data } = await supabase
                .from('item_packaging')
                .select('*')
                .eq('item_id', product.id)
                .eq('is_active', true)
                .is('deleted_at', null)
                .order('qty_in_base', { ascending: true });

            if (data) packagings = data;
        } catch (err) {
            console.error("Error fetching packagings", err);
        }

        // Resolve Default (Purchase Profile or Base)
        let defaultPackagingId: string | null = null;
        try {
            const { data: profile } = await supabase
                .from('item_purchase_profiles')
                .select('default_purchase_packaging_id')
                .eq('item_id', product.id)
                .single();

            if (profile?.default_purchase_packaging_id) {
                defaultPackagingId = profile.default_purchase_packaging_id;
            }
        } catch (err) {
            // ignore no profile
        }

        const selectedPkg = packagings.find(p => p.id === defaultPackagingId);

        // Safety check: if the default packaging ID is no longer in the list, fallback
        if (defaultPackagingId && !selectedPkg) {
            defaultPackagingId = null;
        }

        setQuickItem({
            product: product,
            quantity: 1,
            price: 0, // Will be updated by cost fetch downstream
            packagings: packagings,
            packagingId: defaultPackagingId,
            uom: selectedPkg ? (selectedPkg.label || selectedPkg.name) : (product.uom || 'UN') // Use label like 'Saco 25kg'
        });

        // Trigger cost fetch separately to Update Price
        fetchLastCost(product.id);
        setTimeout(() => quickAddQtyRef.current?.focus(), 50);
    };

    const fetchLastCost = async (itemId: string) => {
        if (!itemId || itemId.length < 30) { // Basic UUID length check
            console.warn("Skipping cost fetch: invalid itemId", itemId);
            return;
        }

        try {
            console.log("Fetching last cost for item:", itemId);
            const { data: lastMove, error } = await supabase
                .from('inventory_movements')
                .select('unit_cost')
                .eq('item_id', itemId)
                .eq('reason', 'purchase_in')
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (error) {
                console.error("Supabase Error fetching cost:", error);
                // Try fallback logic anyway if error is not critical
            }

            if (lastMove?.unit_cost) {
                console.log("Found last cost:", lastMove.unit_cost);
                setQuickItem(prev => ({ ...prev, price: Number(lastMove.unit_cost) }));
            } else {
                console.log("No last movement found, falling back to avg_cost");
                // Fallback to average cost if no movement
                const { data: item } = await supabase
                    .from('items')
                    .select('avg_cost')
                    .eq('id', itemId)
                    .single();
                if (item?.avg_cost) {
                    setQuickItem(prev => ({ ...prev, price: Number(item.avg_cost) }));
                }
            }
        } catch (err) {
            console.error("Error fetching cost", err);
        }
    };

    const handlePackagingChange = (pkgId: string) => {
        const pkg = quickItem.packagings.find(p => p.id === pkgId);
        setQuickItem(prev => ({
            ...prev,
            packagingId: pkgId,
            uom: pkg ? (pkg.label || pkg.name) : (prev.product?.uom || 'UN')
        }));
    };

    const addQuickItem = () => {
        if (!quickItem.product) return;
        if (quickItem.quantity <= 0) {
            toast({ title: "Quantidade inválida", variant: "destructive" });
            return;
        }

        const pkg = quickItem.packagings.find(p => p.id === quickItem.packagingId);
        const conversionFactor = pkg ? pkg.qty_in_base : 1;
        const uomLabel = pkg ? (pkg.label || pkg.name) : quickItem.product.uom || 'UN';

        const newItem = {
            item_id: quickItem.product.id,
            qty_display: quickItem.quantity,
            uom_label: uomLabel,
            conversion_factor: conversionFactor,
            unit_cost: quickItem.price,
            notes: '',
            packaging_id: quickItem.packagingId,
            discount_amount: 0,
            product: {
                ...quickItem.product,
                packagings: quickItem.packagings
            },
            item: {
                name: quickItem.product.name,
                uom: quickItem.product.uom,
                sku: quickItem.product.sku
            }
        };

        setFormData((prev: any) => ({
            ...prev,
            items: [...prev.items, newItem]
        }));

        setQuickItem({ product: null, quantity: 1, price: 0, uom: 'UN', packagingId: null, packagings: [] });
        setTimeout(() => quickAddProductRef.current?.focus(), 50);
    };

    const removeItem = (index: number) => {
        const newItems = [...formData.items];
        newItems.splice(index, 1);
        setFormData((prev: any) => ({ ...prev, items: newItems }));
    };

    const handleSave = async () => {
        if (!formData.supplier_id) {
            toast({ title: "Selecione um fornecedor", variant: "destructive" });
            return;
        }
        if (formData.items.length === 0) {
            toast({ title: "Adicione ao menos um item", variant: "destructive" });
            return;
        }

        setIsSaving(true);
        try {
            const payload = {
                supplier_id: formData.supplier_id,
                expected_at: formData.expected_at || null,
                notes: formData.notes,
                payment_terms_id: formData.payment_terms_id || null,
                payment_mode_id: formData.payment_mode_id || null,
                price_table_id: formData.price_table_id || null,
                freight_amount: Number(formData.freight_amount),
                discount_amount: Number(formData.discount_amount),
                subtotal_amount: subtotal,
                total_amount: total,
                items: formData.items.map((item: any) => ({
                    id: item.id,
                    item_id: item.item_id,
                    qty_display: Number(item.qty_display),
                    uom_label: item.uom_label,
                    conversion_factor: Number(item.conversion_factor || 1),
                    unit_cost: Number(item.unit_cost),
                    discount_amount: Number(item.discount_amount || 0),
                    notes: item.notes
                }))
            };

            if (mode === 'create') {
                const { data } = await createPurchaseOrderAction(payload);
                // @ts-ignore
                if (data?.id) {
                    // @ts-ignore
                    router.push(`/app/compras/pedidos`);
                    toast({ title: "Pedido criado com sucesso!" });
                }
            } else {
                await updatePurchaseOrderAction(formData.id, payload);
                toast({ title: "Pedido atualizado com sucesso!" });
                router.push(`/app/compras/pedidos`);
            }
        } catch (error: any) {
            console.error(error);
            toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };

    const handleUpdateItem = (index: number, field: string, value: any) => {
        const newItems = [...formData.items];
        const updatedItem = { ...newItems[index], [field]: value };

        // Handle Packaging Change to update Factor & Label
        if (field === 'packaging_id') {
            const product = updatedItem.product || updatedItem.item;
            const packagings = product?.packagings || [];
            if (value === 'base') {
                updatedItem.uom_label = product?.uom || 'UN';
                updatedItem.conversion_factor = 1;
            } else {
                const pkg = packagings.find((p: any) => p.id === value);
                if (pkg) {
                    updatedItem.uom_label = pkg.label || pkg.name;
                    updatedItem.conversion_factor = Number(pkg.qty_in_base);
                }
            }
        }

        newItems[index] = updatedItem;
        setFormData((prev: any) => ({ ...prev, items: newItems }));
    };

    const handleReceiveClick = () => {
        setShowReceiptModal(true);
    };

    const handleReceiptConfirm = async (data: ReceiptData) => {
        setIsSaving(true);
        try {
            await receivePurchaseOrderAction(formData.id, data);
            toast({ title: "Recebimento confirmado!", description: "Estoque movimentado com sucesso." });
            router.refresh();
        } catch (error: any) {
            console.error("Receipt error", error);
            toast({
                title: "Erro no recebimento",
                description: error.message,
                variant: "destructive"
            });
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancelClick = () => {
        setActionDialog({ isOpen: true, type: 'cancel' });
    };



    const handleConfirmAction = async () => {
        const { type } = actionDialog;
        if (!type) return;

        setIsSaving(true);
        try {
            if (type === 'cancel') {
                await cancelPurchaseOrderAction(formData.id, "Cancelado via interface web");
                toast({ title: "Pedido cancelado" });
                await cancelPurchaseOrderAction(formData.id, "Cancelado via interface web");
                toast({ title: "Pedido cancelado" });
            }
            router.refresh();
        } catch (error: any) {
            console.error(error);
            toast({
                title: "Erro na operação",
                description: error.message,
                variant: "destructive"
            });
        } finally {
            setIsSaving(false);
            setActionDialog({ isOpen: false, type: null });
        }
    };

    const isLocked = formData.status === 'received' || formData.status === 'cancelled';
    const statusLabel = formData.status === 'draft' ? 'Rascunho' :
        formData.status === 'sent' ? 'Enviado' :
            formData.status === 'received' ? 'Recebido' : 'Cancelado';

    const orderLabel = formData.document_number
        ? `Pedido #${formData.document_number.toString().padStart(4, '0')}`
        : 'Novo Pedido de Compra';

    const displayTitle = supplierInfo?.name || orderLabel;
    const displaySubtitle = supplierInfo?.name ? orderLabel : 'Selecione um Fornecedor';

    return (
        <div className="pb-32 font-sans w-full">
            <ReceiptModal
                open={showReceiptModal}
                onOpenChange={setShowReceiptModal}
                onConfirm={handleReceiptConfirm}
                purchaseOrder={formData}
                paymentTerms={paymentTerms}
                paymentModes={paymentModes}
            />

            <ConfirmDialogDesdobra
                open={actionDialog.isOpen}
                onOpenChange={(open) => !open && setActionDialog(prev => ({ ...prev, isOpen: false }))}
                title="Cancelar Pedido"
                description={
                    <div className="space-y-4">
                        <p>
                            "Tem certeza que deseja cancelar este pedido? Esta ação não pode ser desfeita e os itens não entrarão no estoque."
                        </p>

                    </div>
                }
                confirmText="Sim, Cancelar"
                cancelText="Voltar"
                variant="danger"
                onConfirm={handleConfirmAction}
                isLoading={isSaving}
            />

            {/* --- HEADER --- */}
            <PageHeader
                title={displayTitle}
                subtitle={displaySubtitle}
                actions={
                    <div className="flex gap-2 items-center">
                        <Button variant="ghost" onClick={() => router.back()} disabled={isSaving} className="text-gray-500">
                            Voltar
                        </Button>

                        <div className="h-4 w-px bg-gray-200 mx-2" />

                        {statusLabel === 'Rascunho' && (
                            <Button
                                onClick={handleSave} // Need to verify if handleSave exists or is handleQuickSave
                                disabled={isSaving}
                                className="bg-amber-500 hover:bg-amber-600 text-white font-medium"
                            >
                                <Save className="w-4 h-4 mr-2" /> Salvar Rascunho
                            </Button>
                        )}

                        {statusLabel === 'Enviado' && (
                            <Button
                                onClick={() => setShowReceiptModal(true)}
                                disabled={isLocked}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-medium"
                            >
                                <Package className="w-4 h-4 mr-2" /> Receber Itens
                            </Button>
                        )}

                        {!isLocked && formData.id && (
                            <>
                                <Button
                                    variant="outline"
                                    onClick={handleCancelClick}
                                    disabled={isSaving}
                                    className="text-gray-600"
                                >
                                    Cancelar
                                </Button>

                            </>
                        )}
                    </div>
                }
            />

            <div className="w-full mt-6">
                <Tabs defaultValue="items" className="w-full">
                    <div className="px-6 mb-2 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <FormTabsList className="w-auto shrink-0">
                            <FormTabsTrigger value="items">Detalhes do Pedido</FormTabsTrigger>
                            <FormTabsTrigger value="financial">Financeiro</FormTabsTrigger>
                        </FormTabsList>

                        <div className="flex items-center gap-2">
                            {/* Status Badges can go here if needed, copying purely layout for now */}
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-100 whitespace-nowrap">
                                <span className="text-xs font-semibold text-blue-700 uppercase tracking-tight">Status</span>
                                <span className="text-sm font-bold text-blue-900">{statusLabel}</span>
                            </div>
                        </div>
                    </div>

                    <TabsContent value="items" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
                        <div className="space-y-6 px-6 py-6">

                            {isLocked && (
                                <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-center gap-3 text-amber-800 shadow-card">
                                    <CheckCircle className="w-5 h-5 text-amber-600" />
                                    <div className="text-sm font-medium leading-relaxed">
                                        Este pedido está com status <strong>{statusLabel.toUpperCase()}</strong> e não pode ser alterado.
                                    </div>
                                </div>
                            )}

                            {/* --- SUPERIOR CARDS --- */}
                            <div className="bg-white rounded-2xl shadow-card border border-gray-100/70">
                                <div className="p-6 space-y-5">
                                    {/* Selector Row */}
                                    <div className="flex flex-col md:flex-row gap-6">
                                        <div className="flex-1 space-y-2">
                                            <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Fornecedor</Label>
                                            <div className="flex gap-2">
                                                <div className="flex-1">
                                                    <OrganizationSelector
                                                        value={formData.supplier_id}
                                                        onChange={handleSupplierSelect}
                                                        type="supplier"
                                                        disabled={isLocked}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                        {/* Read-only Summary */}
                                        <div className="flex-[2] bg-gray-50/80 rounded-2xl border border-gray-100 p-4 grid grid-cols-1 md:grid-cols-[auto_1fr] gap-10">
                                            <div className="min-w-[60px]">
                                                <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Número</span>
                                                <span className="font-medium text-gray-700 text-sm truncate block">
                                                    {mode === 'create' ? '-' : initialData?.document_number?.toString().padStart(4, '0')}
                                                </span>
                                            </div>
                                            <div>
                                                <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Localização / Prazo / Modalidade</span>
                                                <div className="flex items-center gap-2 text-sm">
                                                    <span className="font-medium text-gray-900 truncate">{supplierInfo?.city || '-'} / {supplierInfo?.state || '-'}</span>
                                                    <span className="text-gray-300">•</span>
                                                    <span className="font-medium text-brand-600 truncate">
                                                        {paymentTerms.find(t => t.id === formData.payment_terms_id)?.name || 'Padrão'}
                                                    </span>
                                                    <span className="text-gray-300">•</span>
                                                    <span className="font-medium text-brand-600 truncate">
                                                        {paymentModes.find(m => m.id === formData.payment_mode_id)?.name || 'Padrão'}
                                                    </span>
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
                                                {showMoreOptions ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                            </div>
                                            {showMoreOptions ? "Ocultar opções avançadas" : "Mostrar data prevista e condições de pagamento"}
                                        </button>

                                        {showMoreOptions && (
                                            <div className="mt-4 pt-4 border-t border-dashed border-gray-200 grid grid-cols-1 md:grid-cols-4 gap-6 animate-in slide-in-from-top-2">
                                                <div>
                                                    <Label className="text-xs text-gray-500 mb-1.5 block">Tabela de Preço</Label>
                                                    <Select
                                                        value={formData.price_table_id || ''}
                                                        onValueChange={(val) => setFormData((prev: any) => ({ ...prev, price_table_id: val }))}
                                                        disabled={isLocked}
                                                    >
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Selecione..." />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="none">Padrão</SelectItem>
                                                            {priceTables.map(pt => (
                                                                <SelectItem key={pt.id} value={pt.id}>{pt.name}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div>
                                                    <Label className="text-xs text-gray-500 mb-1.5 block">Prazo de Pagamento</Label>
                                                    <Select
                                                        value={formData.payment_terms_id || ''}
                                                        onValueChange={(val) => setFormData({ ...formData, payment_terms_id: val })}
                                                        disabled={isLocked}
                                                    >
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Selecione..." />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {paymentTerms.map(pt => (
                                                                <SelectItem key={pt.id} value={pt.id}>{pt.name}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div>
                                                    <Label className="text-xs text-gray-500 mb-1.5 block">Modalidade de Pagamento</Label>
                                                    <Select
                                                        value={formData.payment_mode_id || ''}
                                                        onValueChange={(val) => setFormData({ ...formData, payment_mode_id: val })}
                                                        disabled={isLocked}
                                                    >
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Selecione..." />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {paymentModes.map(pm => (
                                                                <SelectItem key={pm.id} value={pm.id}>{pm.name}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div>
                                                    <Label className="text-xs text-gray-500 mb-1.5 block">Data Prevista</Label>
                                                    <div className="relative">
                                                        <Input
                                                            type="date"
                                                            value={formData.expected_at ? formData.expected_at.split('T')[0] : ''}
                                                            onChange={(e) => setFormData({ ...formData, expected_at: e.target.value })}
                                                            disabled={isLocked}
                                                            className="h-10"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* --- ITEMS TABLE --- */}

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
                                {!isLocked && (
                                    <div className="bg-brand-50/30 border-b border-brand-100/50 flex flex-col md:flex-row items-end w-full py-3 px-6 gap-4">
                                        <div className="flex-1 w-full space-y-1.5">
                                            <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Adicionar Produto</Label>
                                            <ProductSelector
                                                ref={quickAddProductRef}
                                                value={quickItem.product?.id}
                                                onChange={handleQuickItemSelect}
                                            />
                                        </div>

                                        <div className="w-full md:w-60 space-y-1.5 flex-shrink-0">
                                            <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block text-center">UN</Label>
                                            <Select
                                                value={quickItem.packagingId || 'base'}
                                                onValueChange={handlePackagingChange}
                                                disabled={!quickItem.product}
                                            >
                                                <SelectTrigger className="h-9 w-full bg-white border-brand-200 focus:border-brand-500 text-xs">
                                                    <SelectValue placeholder="UN" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="base">{quickItem.product?.uom || 'UN'} (Base)</SelectItem>
                                                    {quickItem.packagings?.map((pkg: any) => (
                                                        <SelectItem key={pkg.id} value={pkg.id}>
                                                            {pkg.label || pkg.name} ({pkg.qty_in_base} {quickItem.product?.uom})
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="w-full md:w-24 space-y-1.5 flex-shrink-0">
                                            <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block text-center">Qtde</Label>
                                            <Input
                                                ref={quickAddQtyRef}
                                                type="number"
                                                className="h-9 w-full text-center border-brand-200 focus:border-brand-500 bg-white"
                                                value={quickItem.quantity}
                                                onChange={(e) => setQuickItem({ ...quickItem, quantity: Number(e.target.value) })}
                                                min={0.001}
                                                step={0.001}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') addQuickItem();
                                                }}
                                            />
                                        </div>

                                        <div className="w-full md:w-32 space-y-1.5 flex-shrink-0">
                                            <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block text-center">Custo Unit.</Label>
                                            <DecimalInput
                                                className="h-9 w-full text-right border-brand-200 focus:border-brand-500 bg-white"
                                                value={quickItem.price}
                                                onChange={(val) => setQuickItem({ ...quickItem, price: val || 0 })}
                                                precision={2}
                                                prefix="R$ "
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') addQuickItem();
                                                }}
                                            />
                                        </div>

                                        <div className="w-full md:w-32 flex-shrink-0">
                                            <Button
                                                className="w-full h-9 bg-brand-600 hover:bg-brand-700 text-white"
                                                onClick={addQuickItem}
                                                disabled={!quickItem.product}
                                            >
                                                <Plus className="w-4 h-4 md:mr-2" /> <span className="hidden md:inline">Adicionar</span>
                                            </Button>
                                        </div>
                                    </div>
                                )}

                                {/* Items Table */}
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left table-fixed min-w-[800px]">
                                        <thead className="bg-gray-50/50 text-gray-500 font-medium border-b border-gray-100">
                                            <tr>
                                                <th className="py-3 px-6 w-16 text-center text-xs uppercase tracking-wider">#</th>
                                                <th className="py-3 px-6 text-xs uppercase tracking-wider">PRODUTO</th>
                                                <th className="py-3 px-6 w-28 text-center text-xs uppercase tracking-wider">UN</th>
                                                <th className="py-3 px-6 w-32 text-center text-xs uppercase tracking-wider">QTDE</th>
                                                <th className="py-3 px-6 w-40 text-center text-xs uppercase tracking-wider">CUSTO</th>
                                                <th className="py-3 px-6 w-40 text-center text-xs uppercase tracking-wider">DESC.</th>
                                                <th className="py-3 px-6 w-48 text-right text-xs uppercase tracking-wider">TOTAL</th>
                                                {!isLocked && <th className="py-3 px-6 w-16"></th>}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {formData.items.length === 0 ? (
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
                                            ) : (
                                                formData.items.map((item: any, idx: number) => (
                                                    <tr key={idx} className="hover:bg-gray-50/80 group transition-colors">
                                                        <td className="py-3 px-6 text-center text-gray-300 text-xs">
                                                            {idx + 1}
                                                        </td>
                                                        <td className="py-3 px-6 font-medium text-gray-900 align-top">
                                                            <div className="flex flex-col">
                                                                <span className="line-clamp-2">{item.product?.name || item.item?.name}</span>
                                                                <span className="text-[10px] text-gray-400 font-mono mt-0.5">SKU: {item.product?.sku || item.item?.sku || '-'}</span>
                                                                {item.notes && (
                                                                    <span className="text-xs text-amber-600 italic mt-1 bg-amber-50 px-1.5 py-0.5 rounded w-fit">
                                                                        Obs: {item.notes}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="py-3 px-6 text-center align-top">
                                                            <div className="flex justify-center">
                                                                {(item.product?.packagings && item.product.packagings.length > 0) ? (
                                                                    <Select
                                                                        value={item.packaging_id || 'base'}
                                                                        onValueChange={(val) => handleUpdateItem(idx, 'packaging_id', val)}
                                                                        disabled={isLocked}
                                                                    >
                                                                        <SelectTrigger className="h-8 text-xs border-0 bg-transparent hover:bg-gray-100 w-auto min-w-[80px]">
                                                                            <SelectValue placeholder={item.product?.uom || 'UN'} />
                                                                        </SelectTrigger>
                                                                        <SelectContent>
                                                                            <SelectItem value="base">
                                                                                UNIDADE (1 {item.product?.uom || 'UN'})
                                                                            </SelectItem>
                                                                            {item.product.packagings.map((p: any) => (
                                                                                <SelectItem key={p.id} value={p.id}>
                                                                                    {p.label || p.name} ({Number(p.qty_in_base)} {item.product?.uom || 'UN'})
                                                                                </SelectItem>
                                                                            ))}
                                                                        </SelectContent>
                                                                    </Select>
                                                                ) : (
                                                                    <span className="text-gray-500 text-xs">{item.product?.uom || 'UN'}</span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="py-3 px-6 align-top">
                                                            {isLocked ? (
                                                                <div className="text-center py-1.5 font-medium text-gray-700">
                                                                    {Number(item.qty_display).toLocaleString('pt-BR')}
                                                                </div>
                                                            ) : (
                                                                <Input
                                                                    type="number"
                                                                    className="h-8 text-center text-sm"
                                                                    value={item.qty_display}
                                                                    onChange={e => handleUpdateItem(idx, 'qty_display', e.target.value)}
                                                                    min={0}
                                                                />
                                                            )}
                                                        </td>
                                                        <td className="py-3 px-6 align-top">
                                                            {isLocked ? (
                                                                <div className="text-right py-1.5 font-medium text-gray-700">
                                                                    {formatCurrency(item.unit_cost)}
                                                                </div>
                                                            ) : (
                                                                <DecimalInput
                                                                    value={item.unit_cost}
                                                                    onChange={val => handleUpdateItem(idx, 'unit_cost', val)}
                                                                    className="h-8 text-right text-sm"
                                                                    prefix="R$ "
                                                                    precision={2}
                                                                />
                                                            )}
                                                        </td>
                                                        <td className="py-3 px-6 align-top">
                                                            {isLocked ? (
                                                                <div className="text-right py-1.5 text-gray-500">
                                                                    {item.discount_amount > 0 ? formatCurrency(item.discount_amount) : '-'}
                                                                </div>
                                                            ) : (
                                                                <DecimalInput
                                                                    value={item.discount_amount}
                                                                    onChange={val => handleUpdateItem(idx, 'discount_amount', val)}
                                                                    className="h-8 text-right text-red-600 text-sm"
                                                                    prefix="- R$ "
                                                                />
                                                            )}
                                                        </td>
                                                        <td className="py-3 px-6 align-top text-right font-bold text-gray-900 py-2">
                                                            {formatCurrency(
                                                                (Number(item.qty_display) * Number(item.conversion_factor || 1) * Number(item.unit_cost)) - Number(item.discount_amount || 0)
                                                            )}
                                                        </td>
                                                        {!isLocked && (
                                                            <td className="py-3 px-6 align-top text-center">
                                                                <Button
                                                                    size="icon"
                                                                    variant="ghost"
                                                                    onClick={() => removeItem(idx)}
                                                                    className="h-8 w-8 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </Button>
                                                            </td>
                                                        )}
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                        {/* Footer Totals */}
                                        {formData.items && formData.items.length > 0 && (
                                            <tfoot className="bg-gray-50/50 border-t border-gray-100">
                                                <tr>
                                                    <td colSpan={6} className="py-3 px-6 text-right text-gray-500 text-xs uppercase tracking-wider">Subtotal</td>
                                                    <td className="py-3 px-6 text-right font-medium text-gray-700">{formatCurrency(subtotal)}</td>
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
                                                                disabled={isLocked}
                                                            />
                                                        </div>
                                                    </td>
                                                    <td className="py-2 px-6 text-right text-gray-700">{formData.freight_amount > 0 ? `+${formatCurrency(formData.freight_amount)}` : '-'}</td>
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
                                                                disabled={isLocked}
                                                            />
                                                        </div>
                                                    </td>

                                                    <td className="py-2 px-6 text-right text-red-600 font-medium">{formData.discount_amount > 0 ? `-${formatCurrency(formData.discount_amount)}` : '-'}</td>
                                                    <td></td>
                                                </tr>
                                                <tr className="bg-white border-t border-gray-200">
                                                    <td colSpan={6} className="py-4 px-6 text-right text-sm font-bold text-gray-900 uppercase">Total do Pedido</td>
                                                    <td className="py-4 px-6 text-right text-xl font-bold text-brand-700 bg-brand-50/10 whitespace-nowrap">{formatCurrency(total)}</td>
                                                    <td></td>
                                                </tr>
                                            </tfoot>
                                        )}
                                    </table>
                                </div>

                            </div>
                        </div>
                    </TabsContent >

                    <TabsContent value="financial" className="mt-0">
                        <div className="space-y-6 px-6 py-6">
                            <Card className="border-0 ring-1 ring-gray-100">
                                <CardContent className="p-8 grid grid-cols-1 md:grid-cols-2 gap-12">
                                    <div className="space-y-6">
                                        <h3 className="font-bold text-gray-900 flex items-center gap-2 text-sm uppercase tracking-wide">
                                            <DollarSign className="w-4 h-4 text-brand-600" /> Condições de Pagamento
                                        </h3>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label>Condição</Label>
                                                <Select
                                                    value={formData.payment_terms_id || ''}
                                                    onValueChange={v => setFormData({ ...formData, payment_terms_id: v })}
                                                    disabled={isLocked}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Selecione..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {paymentTerms.map(t => (
                                                            <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Forma</Label>
                                                <Select
                                                    value={formData.payment_mode_id || ''}
                                                    onValueChange={v => setFormData({ ...formData, payment_mode_id: v })}
                                                    disabled={isLocked}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Selecione..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {paymentModes.map(m => (
                                                            <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <Label>Observações Gerais</Label>
                                            <Textarea
                                                value={formData.notes || ''}
                                                onChange={e => setFormData({ ...formData, notes: e.target.value })}
                                                disabled={isLocked}
                                                className="h-24 resize-none"
                                                placeholder="Observações internas sobre o pedido..."
                                            />
                                        </div>
                                    </div>


                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>
                </Tabs >
            </div >



        </div >

    );
}
