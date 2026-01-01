"use client";

import { useEffect, useState, useRef, Fragment } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabaseBrowser";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
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
import { Input } from "@/components/ui/Input";
import { DecimalInput } from "@/components/ui/DecimalInput";
import { Label } from "@/components/ui/Label";
import { Textarea } from "@/components/ui/Textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";
import { Tabs, TabsContent } from "@/components/ui/Tabs";
import { FormTabsList, FormTabsTrigger } from "@/components/ui/FormTabs";
import { TabDelivery } from "@/components/sales/TabDelivery";
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
    dispatchOrder,
    getSalesOrderTotals,
    cleanupUserDrafts
} from "@/lib/data/sales-orders";
import { recalculateFiscalForOrder } from "@/lib/data/sales-orders";
import { getPaymentModes, PaymentMode } from "@/lib/clients-db";
import {
    ArrowLeft,
    Save,
    CheckCircle,
    CheckCircle2,
    MoreVertical,
    Plus,
    Trash2,
    ChevronDown,
    ChevronUp,
    ChevronRight,
    AlertCircle,
    Calculator,
    Edit2,
    Printer,
    Loader2,
    RotateCcw,
    Archive as IconArchive,
    Package,
    DollarSign,
    Box,
    Truck,
    Clock
} from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from "@/components/ui/DropdownMenu";
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

    // Handler for generic field updates (passed to Tabs)
    const handleFieldChange = (field: keyof SalesOrder, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const [archiveOpen, setArchiveOpen] = useState(false);
    const [archiveReason, setArchiveReason] = useState("");

    // Dispatch Modal States
    const [confirmModalOpen, setConfirmModalOpen] = useState(false);
    const [freightConfirmOpen, setFreightConfirmOpen] = useState(false);
    const [pendingFreightData, setPendingFreightData] = useState<any>(null);
    const [modalAction, setModalAction] = useState<'save' | 'confirm' | null>(null);
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
    const [paymentModes, setPaymentModes] = useState<PaymentMode[]>([]); // New State
    const [branches, setBranches] = useState<any[]>([]);
    const [clientAddresses, setClientAddresses] = useState<any[]>([]);

    // Track if user manually changed the payment mode to prevent auto-fill override
    const manualPaymentModeOverride = useRef(false);

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
        payment_mode_id: '', // Ensure field exists
        ...initialData
    });

    // Customer Extra Info State (for display summary)
    const [customerInfo, setCustomerInfo] = useState<{
        tradeName?: string;
        address?: string;
        priceTableName?: string;
        paymentTermsName?: string;
        paymentModeName?: string; // Added field
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

    // Expanded fiscal details state (track which items show fiscal info)
    const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

    // Fiscal calculation state for automatic recalculation
    const [fiscalStatus, setFiscalStatus] = useState<'idle' | 'pending' | 'calculating' | 'calculated' | 'error'>('idle');
    const [fiscalError, setFiscalError] = useState<string | null>(null);
    const [fiscalDeps, setFiscalDeps] = useState<string>('');

    // Refs for debouncing and abort control
    const fiscalAbortController = useRef<AbortController | null>(null);
    const itemUpdateTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());

    // ============================================
    // DIRTY TRACKING STATE (FASE 1 - No Autosave Removal)
    // ============================================
    const [originalSnapshot, setOriginalSnapshot] = useState<{
        formData: Partial<SalesOrder>;
    } | null>(null);

    const [isDirty, setIsDirty] = useState(false);


    // --- EFFECT: Handle Tab Query Param ---
    useEffect(() => {
        const tab = searchParams.get('tab');
        if (tab === 'separation' || tab === 'separacao') {
            setActiveTab('separation');
        }
    }, [searchParams]);

    // --- EFFECT: Auto-Calculate Fiscal (with debounce) ---
    useEffect(() => {
        // Build dependency hash from fiscal-relevant data
        const newDeps = JSON.stringify({
            client_id: formData.client_id,
            company_id: selectedCompany?.id,
            delivery_uf: formData.delivery_address_json?.state,
            items: formData.items?.map(i => ({
                id: i.id,
                product_id: i.product?.id,
                quantity: i.quantity,
                unit_price: i.unit_price,
                discount_amount: i.discount_amount
            })),
            discount_total: formData.discount_amount,
            freight_total: formData.freight_amount
        });

        // Only trigger if dependencies actually changed
        if (newDeps === fiscalDeps) return;

        setFiscalDeps(newDeps);
        setFiscalStatus('pending');

        // Debounce: wait 600ms before actually calculating
        const timer = setTimeout(() => {
            // Check for temp items or dirty state (Phase 2: Autosave removed, so we can't calc fiscal on unsaved items)
            const hasTempItems = formData.items?.some(i => i.id?.startsWith('temp-') || !i.id);
            // We can also rely on isDirty, but checking items specifically is safer for this context

            if (formData.id && formData.client_id && selectedCompany && formData.items && formData.items.length > 0 && !hasTempItems) {
                triggerFiscalCalculation();
            } else {
                setFiscalStatus('idle'); // Or 'paused' if we had that state
            }
        }, 600);

        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [formData.client_id, formData.delivery_address_json?.state, formData.items, formData.discount_amount, formData.freight_amount, selectedCompany?.id, formData.id]);

    // --- EFFECT: Detect Dirty State (FASE 1) ---
    useEffect(() => {
        if (!originalSnapshot || mode === 'create') {
            setIsDirty(false);
            return;
        }

        // Compare formData (simple JSON comparison)
        const currentDataStr = JSON.stringify(formData);
        const originalDataStr = JSON.stringify(originalSnapshot.formData);

        setIsDirty(currentDataStr !== originalDataStr);
    }, [formData, originalSnapshot, mode]);

    // --- EFFECT: Warn on Unsaved Changes (FASE 1) ---
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (isDirty) {
                e.preventDefault();
                e.returnValue = 'Você tem alterações não salvas. Deseja sair mesmo assim?';
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, [isDirty]);

    // --- EFFECT: Create Initial Snapshot (FASE 1) ---
    useEffect(() => {
        if (mode === 'edit' && initialData && !originalSnapshot) {
            setOriginalSnapshot({
                formData: { ...initialData }
            });
        }
    }, [mode, initialData, originalSnapshot]);

    // --- EFFECT: Calculate Weights Locally (Real-time) ---
    useEffect(() => {
        if (!formData.items) return;

        let totalNet = 0;
        let totalGross = 0;

        formData.items.forEach(item => {
            const qty = item.quantity || 0;

            // Priority:
            // 1. unit_weight_kg directly on item (if populated from DB or quickAdd)
            // 2. product.base_weight_kg (legacy/safe fallback)
            // 3. Fallback logic from product data if available
            // Note: We access properties that might not be in the strict TS type but are in the object at runtime
            const prod = item.product as any;

            const unitNet = item.unit_weight_kg
                ?? (prod?.net_weight_g_base ? prod.net_weight_g_base / 1000.0 : 0)
                ?? (prod?.base_weight_kg || 0);

            const unitGross = item.gross_weight_kg_snapshot
                ?? (prod?.gross_weight_g_base ? prod.gross_weight_g_base / 1000.0 : 0)
                ?? (unitNet * 1.1); // Fallback estimate

            totalNet += (unitNet * qty);
            totalGross += (unitGross * qty);
        });

        // Only update if changed (epsilon check for float)
        const currentNet = formData.total_weight_kg || 0;
        const currentGross = formData.total_gross_weight_kg || 0;

        if (Math.abs(currentNet - totalNet) > 0.001 || Math.abs(currentGross - totalGross) > 0.001) {
            setFormData(prev => ({
                ...prev,
                total_weight_kg: Number(totalNet.toFixed(3)),
                total_gross_weight_kg: Number(totalGross.toFixed(3))
            }));
        }

    }, [formData.items]);

    // --- Helper: Refresh Totals from Server (for Weight/Freight sync) ---
    const refreshTotals = async () => {
        if (!formData.id) return;
        try {
            const totals = await getSalesOrderTotals(supabase, formData.id);
            if (totals) {
                setFormData(prev => ({
                    ...prev,
                    total_amount: totals.total_amount,
                    subtotal_amount: totals.subtotal_amount,
                    freight_amount: totals.freight_amount,
                    discount_amount: totals.discount_amount,
                    total_weight_kg: totals.total_weight_kg
                }));
            }
        } catch (error) {
            console.error('Failed to refresh totals:', error);
        }
    };

    // --- 0. Initial Data Population (Edit Mode) ---
    useEffect(() => {
        if (initialData && initialData.client_id && priceTables.length > 0 && paymentTerms.length > 0) {
            const ptName = priceTables.find(p => p.id === initialData.price_table_id)?.name || 'Padrão';
            const payName = paymentTerms.find(p => p.id === initialData.payment_terms_id)?.name || 'Padrão';

            // Payment Mode Name Resolution
            let payModeName = 'Não definido';
            if (paymentModes.length > 0 && initialData.payment_mode_id) {
                payModeName = paymentModes.find(p => p.id === initialData.payment_mode_id)?.name || 'Não definido';
            }

            // Address Handling
            let addressStr = "Endereço não cadastrado";
            let cityState = "";
            if (initialData.delivery_address_json) {
                const addr = initialData.delivery_address_json;
                addressStr = `${addr.street}, ${addr.number} - ${addr.neighborhood}`;
                cityState = `${addr.city}/${addr.state}`;
                setClientAddresses([addr]); // Ensure it's in the list
            }

            setCustomerInfo({
                tradeName: initialData.client?.trade_name,
                doc: initialData.client?.document,
                address: addressStr,
                cityState: cityState,
                priceTableName: ptName,
                paymentTermsName: payName,
                paymentModeName: payModeName
            });

            // Update formData to ensure all fields are set
            setFormData(prev => ({
                ...prev,
                payment_mode_id: initialData.payment_mode_id || ''
            }));
        }
    }, [initialData, priceTables, paymentTerms, paymentModes]);

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

            // Fetch Payment Modes
            getPaymentModes(supabase, selectedCompany.id).then(modes => {
                setPaymentModes(modes);
            }).catch(console.error);

            // Fetch Branches
            /*
            const { data: settings } = await supabase
                .from('company_settings')
                .select('branches')
                .eq('company_id', selectedCompany.id)
                .single();
            if (settings?.branches && Array.isArray(settings.branches)) {
                setBranches(settings.branches);
            }
            */
        };
        fetchData();
    }, [selectedCompany, supabase]);

    // --- 2. Auto-fill Customer Data ---
    const handleCustomerSelect = async (org: any) => {
        if (!org) {
            setFormData(prev => ({ ...prev, client_id: undefined }));
            setCustomerInfo({});
            setClientAddresses([]);
            manualPaymentModeOverride.current = false; // Reset override
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

            // Payment Mode Logic
            let paymentModeId = formData.payment_mode_id;
            if (!manualPaymentModeOverride.current || !paymentModeId) {
                paymentModeId = fullOrg.payment_mode_id || '';
            }

            // Address logic: Pick 'billing' or first available
            const addresses = fullOrg.addresses || [];
            setClientAddresses(addresses);

            setClientAddresses(addresses);

            const address = addresses.find((a: any) => a.type === 'billing') || addresses[0];
            const addressStr = address ? `${address.street}, ${address.number} - ${address.neighborhood}` : "Endereço não cadastrado";
            const cityState = address ? `${address.city}/${address.state}` : "";

            // Freight Logic
            const mapFreightMode = (term: string | null) => {
                if (!term) return null;
                if (term === 'retira') return 'exw';
                if (term === 'sem_frete') return 'none';
                if (term === 'combinar') return 'none';
                return term; // cif, fob
            };

            const newFreightMode = mapFreightMode(fullOrg.freight_terms);
            // @ts-ignore
            const newCarrierId = fullOrg.preferred_carrier_id || null;
            // @ts-ignore
            const newRouteTag = fullOrg.region_route || null;

            const hasExistingFreight = !!formData.freight_mode;
            const hasNewFreight = !!newFreightMode || !!newCarrierId || !!newRouteTag;

            if (formData.client_id && formData.client_id !== fullOrg.id && hasExistingFreight && hasNewFreight) {
                // Creating Pending Data for Dialog
                setPendingFreightData({
                    freight_mode: newFreightMode,
                    carrier_id: newCarrierId,
                    route_tag: newRouteTag
                });
                setFreightConfirmOpen(true);
            } else if (hasNewFreight) {
                // Apply immediately if first time or no existing freight
                setFormData(prev => ({
                    ...prev,
                    freight_mode: newFreightMode as any,
                    carrier_id: newCarrierId,
                    route_tag: newRouteTag
                }));
            }

            setFormData(prev => ({
                ...prev,
                client_id: fullOrg.id,
                price_table_id: priceTableId,
                payment_terms_id: paymentTermsId,
                payment_mode_id: paymentModeId, // Auto-fill
                delivery_address_json: address, // Snapshot
            }));

            const ptName = priceTables.find(p => p.id === priceTableId)?.name || 'Padrão';
            const payName = paymentTerms.find(p => p.id === paymentTermsId)?.name || 'Padrão';
            const payModeName = paymentModes.find(p => p.id === paymentModeId)?.name || 'Não definido';

            setCustomerInfo({
                tradeName: fullOrg.trade_name,
                doc: fullOrg.document,
                address: addressStr,
                cityState: cityState,
                priceTableName: ptName,
                paymentTermsName: payName,
                paymentModeName: payModeName
            });

            // Auto-create draft if not exists (NEW)
            if (!formData.id) {
                try {
                    await ensureDraftOrder(fullOrg.id); // Pass client ID directly
                } catch (error) {
                    console.error('Failed to auto-create draft:', error);
                    // Non-blocking - user can still continue
                }
            }
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
                .maybeSingle();

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

    const addQuickItem = async () => {
        if (!quickItem.product) return;
        if (quickItem.quantity <= 0) {
            toast({ title: "Quantidade inválida", variant: "destructive" });
            return;
        }

        try {
            // PHASE 2: Autosave removed
            const total = quickItem.quantity * quickItem.price;

            // Generate Temporary Item (Local Only)
            const unitNetWeight = quickItem.product.net_weight_g_base ? quickItem.product.net_weight_g_base / 1000 : 0;
            const unitGrossWeight = quickItem.product.gross_weight_g_base ? quickItem.product.gross_weight_g_base / 1000 : (unitNetWeight * 1.1);

            const newItemObj: SalesOrderItem = {
                id: `temp-${Date.now()}`, // Temporary ID
                item_id: quickItem.product.id,
                quantity: quickItem.quantity,
                unit_price: quickItem.price,
                discount_amount: 0,
                total_amount: total,
                document_id: formData.id || '', // Might be empty if new order

                // Pre-populate weights for local calculation
                unit_weight_kg: unitNetWeight,
                gross_weight_kg_snapshot: unitGrossWeight,

                product: {
                    id: quickItem.product.id,
                    name: quickItem.product.name,
                    un: quickItem.product.un || 'UN',
                    sku: quickItem.product.sku,
                    net_weight_g_base: quickItem.product.net_weight_g_base,
                    gross_weight_g_base: quickItem.product.gross_weight_g_base
                }
            };

            setFormData(prev => ({
                ...prev,
                items: [...(prev.items || []), newItemObj]
            }));

            // Reset
            setQuickItem({ product: null, quantity: 1, price: 0 });

            // Auto-calculate fiscal (removed in Phase 2 for adding, wait for save)
            // But we might want to refresh UI totals if calculated locally
            // We already calculate total_amount above, so UI updates instantly

        } catch (error: any) {
            console.error('Error adding item:', error);
            toast({
                title: "Erro ao adicionar item",
                description: error.message,
                variant: "destructive"
            });
        }
    };

    const handleRemoveItem = async (index: number) => {
        const item = formData.items?.[index];
        if (!item) return;

        try {
            // PHASE 2: Autosave removed
            /*
            // Delete from database if it's a saved item
            if (item.id && !item.id.startsWith('temp-')) {
                await deleteSalesItem(supabase, item.id);
            }
            */

            // Update local state
            const newItems = [...(formData.items || [])];
            newItems.splice(index, 1);
            setFormData(prev => ({ ...prev, items: newItems }));

            // Recalculate fiscal if order exists
            /*
            if (formData.id) {
                setTimeout(() => {
                    triggerFiscalCalculation();
                    refreshTotals();
                }, 100);
            }
            */
        } catch (error: any) {
            console.error('Error removing item:', error);
            toast({
                title: "Erro ao remover item",
                description: error.message,
                variant: "destructive"
            });
        }
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

        // PHASE 2 (Autosave Removed): We only update local state.
        // The save will happen manually when user clicks "Save"

        /* 
        // Debounced save to database (600ms)
        if (item.id && !item.id.startsWith('temp-') && formData.id) {
            // ... original autosave logic removed ...
        }
        */
    };

    const toggleFiscalDetails = (itemId: string) => {
        const newExpanded = new Set(expandedItems);
        if (newExpanded.has(itemId)) {
            newExpanded.delete(itemId);
        } else {
            newExpanded.add(itemId);
        }
        setExpandedItems(newExpanded);
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
        console.log('--- executeSave START ---', status);
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

        const payload = {
            ...formData,
            company_id: selectedCompany.id,
            status_commercial: status
        };
        console.log('Saving Payload:', payload);

        let savedOrder;
        try {
            savedOrder = await upsertSalesDocument(supabase, payload);
            console.log('Saved Order Result:', savedOrder);
        } catch (err: any) {
            console.error('upsertSalesDocument Failed:', err);
            // Try to log detailed error if available
            if (err?.message) console.error('Error Message:', err.message);
            if (err?.details) console.error('Error Details:', err.details);
            if (err?.hint) console.error('Error Hint:', err.hint);
            throw err;
        }

        // PHASE 2: Full Item Synchronization
        const currentItems = formData.items || [];
        // Extract original items from snapshot if available (for detecting deletes)
        // If no snapshot (e.g. create mode), assumes no items to delete from DB
        const originalItems = originalSnapshot?.formData.items || [];

        // 1. Handle Deletions
        // Identify items that were in original snapshot but represent persistent IDs 
        // and are missing from current items list.
        const itemsToDelete = originalItems.filter(orgItem => {
            const isPersistent = orgItem.id && !orgItem.id.startsWith('temp-');
            const isStillPresent = currentItems.some(curr => curr.id === orgItem.id);
            return isPersistent && !isStillPresent;
        });

        if (itemsToDelete.length > 0) {
            console.log('🗑️ Deleting removed items:', itemsToDelete.map(i => i.id));
            await Promise.all(itemsToDelete.map(item =>
                deleteSalesItem(supabase, item.id!)
            ));
        }

        // 2. Handle Upserts (Inserts + Updates)
        if (currentItems.length > 0) {
            for (const item of currentItems) {
                const isTemp = item.id && item.id.startsWith('temp-');

                const itemToSave = {
                    ...item,
                    document_id: savedOrder.id,
                    company_id: savedOrder.company_id,
                    // IMPORTANT: If temp ID, undefined it so DB generates new UUID
                    id: isTemp ? undefined : item.id
                };

                await upsertSalesItem(supabase, itemToSave);
            }
        }
        return savedOrder;
    };

    const handleQuickSave = async () => {
        setIsSaving(true);
        try {
            // Keep current status or default to draft
            // Keep current status or default to draft
            const statusToSave = (formData.status_commercial || 'draft') as any;
            const savedOrder = await executeSave(statusToSave);

            // Update snapshot to clear dirty state (FASE 1)
            // Note: We create a deep copy to ensure reference inequality with previous snapshot if needed,
            // but here we just want to match current formData
            setOriginalSnapshot({
                formData: { ...formData, id: savedOrder.id }
            });

            // Effect will eventually run, but we can optimistically clear it or rely on snapshot update
            toast({ title: "Sucesso", description: "Alterações salvas." });
        } catch (e: any) {
            toast({ title: "Erro ao salvar", description: e.message || "Erro desconhecido", variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveDraft = async () => {
        setIsSaving(true);
        try {
            await executeSave('draft');
            toast({ title: "Orçamento Salvo", description: "Pedido salvo na lista de orçamentos." });
            router.push('/app/vendas/pedidos');
        } catch (e: any) {
            console.error('handleSaveDraft Error Caught:', e);
            console.error('Error details (JSON):', JSON.stringify(e, Object.getOwnPropertyNames(e)));

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

    // --- FISCAL CALCULATION (automatic & manual) ---
    const triggerFiscalCalculation = async () => {
        if (!formData.id || !selectedCompany || !formData.client_id) {
            setFiscalStatus('idle');
            return;
        }

        try {
            setFiscalStatus('calculating');
            setFiscalError(null);

            const supabase = createClient();

            // Get company settings
            const { data: companyData, error: companyError } = await supabase
                .from('company_settings')
                .select('address_state, tax_regime')
                .eq('company_id', selectedCompany.id)
                .single();

            if (companyError || !companyData) {
                throw new Error(`Configurações da empresa não encontradas: ${companyError?.message || ''}`);
            }

            // Get customer data
            const { data: customerData, error: customerError } = await supabase
                .from('organizations')
                .select(`addresses!inner(state), icms_contributor, is_final_consumer`)
                .eq('id', formData.client_id)
                .single();

            if (customerError || !customerData) {
                throw new Error(`Dados do cliente não encontrados: ${customerError?.message || ''}`);
            }

            const customerUF = (customerData.addresses as any)?.[0]?.state || 'SP';
            const customerType = customerData.icms_contributor ? 'contribuinte' : 'nao_contribuinte';
            const isFinalConsumer = customerData.is_final_consumer || false;

            await recalculateFiscalForOrder(
                supabase,
                formData.id,
                selectedCompany.id,
                companyData.address_state || 'SP',
                companyData.tax_regime || 'simples',
                customerUF,
                customerType,
                isFinalConsumer
            );

            // Reload items from database to get updated fiscal data
            const { data: updatedItems, error: itemsError } = await supabase
                .from('sales_document_items')
                .select(`
                    *,
                    product:items!item_id(id, name, sku)
                `)
                .eq('document_id', formData.id)
                .order('created_at');

            if (!itemsError && updatedItems) {
                console.log('🔄 Reloaded Items from DB:', updatedItems);
                // Update formData with fresh items from DB, but preserve dirty items (being edited)
                setFormData(prev => {
                    const currentItems = prev.items || [];
                    const mergedItems = updatedItems.map((dbItem: any) => {
                        // Check if this item has a pending save (dirty)
                        if (itemUpdateTimers.current.has(dbItem.id)) {
                            // Keep local version for this item to avoid overwriting user input
                            const localItem = currentItems.find(i => i.id === dbItem.id);
                            return localItem || dbItem;
                        }
                        return dbItem;
                    });

                    return {
                        ...prev,
                        items: mergedItems
                    };
                });
            }

            setFiscalStatus('calculated');
            toast({
                title: "Fiscal calculado",
                description: "Dados fiscais atualizados",
                duration: 2000
            });
        } catch (error: any) {
            console.error('Fiscal calculation error:', error);
            setFiscalError(error.message || 'Erro ao calcular fiscal');
            setFiscalStatus('error');
        }
    };

    // --- ENSURE DRAFT ORDER (auto-save) ---
    const ensureDraftOrder = async (clientId?: string): Promise<string> => {
        // If already has order ID, return it
        if (formData.id) return formData.id;

        // Use provided clientId or fallback to formData
        const effectiveClientId = clientId || formData.client_id;

        // Validate required data
        if (!effectiveClientId || !selectedCompany) {
            throw new Error('Cliente e empresa são obrigatórios para criar rascunho');
        }

        try {
            // 1. Cleanup old drafts (Singleton Rule) & Validate User
            const { data: { user } } = await supabase.auth.getUser();
            let validRepId = null;

            if (user) {
                // Verify if auth user exists in public.users to satisfying FK
                const { data: rep } = await supabase.from('users').select('id').eq('id', user.id).maybeSingle();
                if (rep) {
                    validRepId = user.id;
                    await cleanupUserDrafts(supabase, selectedCompany.id, user.id);
                }
            }

            // 2. Create new draft
            const draftData = {
                company_id: selectedCompany.id,
                client_id: effectiveClientId,
                status_commercial: 'draft' as const,
                status_logistic: 'pending' as const,
                status_fiscal: 'none' as const,
                date_issued: new Date().toISOString().split('T')[0],
                price_table_id: formData.price_table_id,
                payment_terms_id: formData.payment_terms_id,
                delivery_address_json: formData.delivery_address_json,
                doc_type: 'order' as const,
                subtotal_amount: 0,
                discount_amount: 0,
                freight_amount: 0,
                total_amount: 0,
                // Ensure sales rep is set only if valid relation exists
                sales_rep_id: validRepId
            };

            const savedOrder = await upsertSalesDocument(supabase, draftData);

            // Update local state with order ID
            setFormData(prev => ({ ...prev, id: savedOrder.id }));

            toast({
                title: "Rascunho criado",
                description: "Pedido salvo automaticamente",
                duration: 2000
            });

            return savedOrder.id;
        } catch (error: any) {
            console.error('Failed to create draft:', error);
            toast({
                title: "Erro ao criar rascunho",
                description: error.message,
                variant: "destructive"
            });
            throw error;
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

                        {/* --- NOVO BOTÃO SALVAR (FASE 1) --- */}
                        {mode === 'edit' && isDirty && (
                            <Button
                                onClick={handleQuickSave}
                                disabled={isSaving}
                                className="bg-amber-500 hover:bg-amber-600 text-white font-medium animate-in fade-in zoom-in duration-300"
                            >
                                {isSaving ? (
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                    <Save className="w-4 h-4 mr-2" />
                                )}
                                Salvar Alterações
                            </Button>
                        )}

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
            >

            </PageHeader>

            <div className="w-full mt-6">
                <Tabs defaultValue="order" className="w-full">
                    <div className="px-6 mb-2">
                        <FormTabsList>
                            <FormTabsTrigger value="order">Detalhes do Pedido</FormTabsTrigger>
                            <FormTabsTrigger value="delivery">Entrega & Frete</FormTabsTrigger>
                        </FormTabsList>
                    </div>

                    <TabsContent value="order" className="mt-0">
                        <div className="space-y-6 px-6 py-6">
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
                                            <div className="flex-[2] bg-gray-50/80 rounded-2xl border border-gray-100 p-4 grid grid-cols-1 md:grid-cols-[auto_1fr] gap-10">
                                                <div className="min-w-[60px]">
                                                    <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Número</span>
                                                    <span className="font-medium text-gray-700 text-sm truncate block">
                                                        {mode === 'create' ? '-' : initialData?.document_number?.toString().padStart(4, '0')}
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Localização / Tabela / Prazo / Forma</span>
                                                    <div className="flex items-center gap-2 text-sm">
                                                        <span className="font-medium text-gray-900 truncate">{customerInfo.cityState || '-'}</span>
                                                        <span className="text-gray-300">•</span>
                                                        <span className="font-medium text-brand-600 truncate">{customerInfo.priceTableName || 'Padrão'}</span>
                                                        <span className="text-gray-300">•</span>
                                                        <span className="font-medium text-brand-600 truncate">{customerInfo.paymentTermsName || 'Padrão'}</span>
                                                        <span className="text-gray-300">•</span>
                                                        <span className="font-medium text-brand-600 truncate">{customerInfo.paymentModeName || 'Padrão'}</span>
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
                                                <div className="mt-4 pt-4 border-t border-dashed border-gray-200 grid grid-cols-1 md:grid-cols-4 gap-6 animate-in slide-in-from-top-2">
                                                    <div>
                                                        <Label className="text-xs text-gray-500 mb-1.5 block">Tabela de Preço</Label>
                                                        <Select
                                                            value={formData.price_table_id || ''}
                                                            onValueChange={(val) => {
                                                                const name = priceTables.find(p => p.id === val)?.name;
                                                                setFormData({ ...formData, price_table_id: val });
                                                                setCustomerInfo(prev => ({ ...prev, priceTableName: name }));
                                                            }}
                                                        >
                                                            <SelectTrigger>
                                                                <SelectValue placeholder="Selecione..." />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {priceTables.map(pt => (
                                                                    <SelectItem key={pt.id} value={pt.id}>{pt.name}</SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div>
                                                        <Label className="text-xs text-gray-500 mb-1.5 block">Condição de Pagamento</Label>
                                                        <Select
                                                            value={formData.payment_terms_id || ''}
                                                            onValueChange={(val) => {
                                                                const name = paymentTerms.find(p => p.id === val)?.name;
                                                                setFormData({ ...formData, payment_terms_id: val });
                                                                setCustomerInfo(prev => ({ ...prev, paymentTermsName: name }));
                                                            }}
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
                                                        <Label className="text-xs text-gray-500 mb-1.5 block">Forma de Pagamento</Label>
                                                        <Select
                                                            value={formData.payment_mode_id || ''}
                                                            onValueChange={(val) => {
                                                                manualPaymentModeOverride.current = true;
                                                                const name = paymentModes.find(p => p.id === val)?.name;
                                                                setFormData({ ...formData, payment_mode_id: val });
                                                                setCustomerInfo(prev => ({ ...prev, paymentModeName: name }));
                                                            }}
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
                                                        <Label className="text-xs text-gray-500 mb-1.5 block">Filial Emitente</Label>
                                                        <Select disabled value={branches[0]?.id || ''}>
                                                            <SelectTrigger>
                                                                <SelectValue placeholder="Selecione..." />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value={branches[0]?.id || 'matriz'}>
                                                                    {branches.length ? branches[0].name : "Matriz"}
                                                                </SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div className="md:col-span-4">
                                                        <Label className="text-xs text-gray-500 mb-1.5 block">Endereço de Entrega</Label>
                                                        <Select
                                                            value={formData.delivery_address_json?.id || ''}
                                                            onValueChange={(val) => handleAddressChange(val)}
                                                            disabled={clientAddresses.length === 0}
                                                        >
                                                            <SelectTrigger>
                                                                <SelectValue placeholder={clientAddresses.length === 0 ? "Nenhum endereço cadastrado" : "Selecione o endereço"} />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {clientAddresses.map(addr => (
                                                                    <SelectItem key={addr.id} value={addr.id}>
                                                                        {addr.street}, {addr.number} - {addr.city}/{addr.state} ({addr.type})
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
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

                                        {/* Fiscal Status Indicators */}
                                        <div className="flex items-center gap-2">
                                            {fiscalStatus === 'calculating' && (
                                                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg border border-blue-200/50">
                                                    <Loader2 className="w-3 h-3 animate-spin" />
                                                    <span className="text-[10px] font-medium">Calculando...</span>
                                                </div>
                                            )}

                                            {fiscalStatus === 'calculated' && (
                                                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-200/50">
                                                    <CheckCircle2 className="w-3 h-3" />
                                                    <span className="text-[10px] font-medium">Fiscal OK</span>
                                                </div>
                                            )}

                                            {fiscalStatus === 'pending' && (
                                                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 text-slate-500 rounded-lg border border-slate-200/50">
                                                    <Clock className="w-3 h-3" />
                                                    <span className="text-[10px] font-medium">Pendente...</span>
                                                </div>
                                            )}

                                            {fiscalStatus === 'error' && (
                                                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-red-50 text-red-700 rounded-lg border border-red-200/50">
                                                    <AlertCircle className="w-3 h-3" />
                                                    <span className="text-[10px] font-medium">Erro</span>
                                                </div>
                                            )}
                                        </div>
                                        {/* Manual fiscal button removed - now automatic */}
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
                                                {formData.items?.map((item, idx) => {
                                                    const isExpanded = expandedItems.has(item.id || `temp-${idx}`);
                                                    return (
                                                        <Fragment key={item.id || `temp-${idx}`}>
                                                            <tr key={item.id || idx} className="hover:bg-gray-50/80 group transition-colors">
                                                                <td className="py-3 px-6 text-center">
                                                                    <div className="flex items-center justify-center gap-2">
                                                                        <button
                                                                            onClick={() => toggleFiscalDetails(item.id || `temp-${idx}`)}
                                                                            className="p-0.5 rounded hover:bg-gray-200 transition-colors text-gray-400 hover:text-gray-600"
                                                                            title="Ver detalhes fiscais"
                                                                        >
                                                                            {isExpanded ? (
                                                                                <ChevronDown className="w-3.5 h-3.5" />
                                                                            ) : (
                                                                                <ChevronRight className="w-3.5 h-3.5" />
                                                                            )}
                                                                        </button>
                                                                        <span className="text-gray-300 text-xs">{idx + 1}</span>
                                                                    </div>
                                                                </td>
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

                                                            {/* Fiscal Details Expandable Row */}
                                                            {isExpanded && (
                                                                <tr className="bg-slate-50/40">
                                                                    <td></td>
                                                                    <td colSpan={7} className="py-3 px-6">
                                                                        <div className="space-y-2.5">

                                                                            {/* Product Classification (independent of operation) */}
                                                                            <div className="bg-white rounded-xl border border-slate-200/60 p-3">
                                                                                <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-2">
                                                                                    Classificação Fiscal do Produto
                                                                                </div>
                                                                                <div className="grid grid-cols-3 gap-x-4 gap-y-1 text-xs">
                                                                                    <div className="flex items-baseline gap-1.5">
                                                                                        <span className="text-slate-400 text-[10px]">NCM:</span>
                                                                                        <span className="font-mono text-slate-700">{item.ncm_snapshot || '-'}</span>
                                                                                    </div>
                                                                                    <div className="flex items-baseline gap-1.5">
                                                                                        <span className="text-slate-400 text-[10px]">CEST:</span>
                                                                                        <span className="font-mono text-slate-700">{item.cest_snapshot || '-'}</span>
                                                                                    </div>
                                                                                    <div className="flex items-baseline gap-1.5">
                                                                                        <span className="text-slate-400 text-[10px]">Origem:</span>
                                                                                        <span className="font-mono text-slate-700">
                                                                                            {item.origin_snapshot !== null && item.origin_snapshot !== undefined ? item.origin_snapshot : '-'}
                                                                                        </span>
                                                                                    </div>
                                                                                </div>
                                                                            </div>

                                                                            {/* DEBUG: Show Fiscal Notes/Errors */}
                                                                            {item.fiscal_notes && (
                                                                                <div className="bg-amber-50 rounded-xl border border-amber-200/60 p-3 text-xs text-amber-800">
                                                                                    <div className="font-semibold mb-1 flex items-center gap-1.5">
                                                                                        <AlertCircle className="w-3 h-3" />
                                                                                        Atenção Fiscal:
                                                                                    </div>
                                                                                    {item.fiscal_notes}
                                                                                </div>
                                                                            )}

                                                                            <div className="bg-white rounded-xl border border-slate-200/60 p-3">
                                                                                <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-3 border-b border-slate-100 pb-2">
                                                                                    Operação Fiscal & Impostos
                                                                                </div>

                                                                                <div className="grid grid-cols-1 md:grid-cols-5 gap-y-4 gap-x-4 text-xs">

                                                                                    {/* 1. CFOP */}
                                                                                    <div className="space-y-2">
                                                                                        <div className="font-semibold text-slate-900 text-[11px] border-b border-slate-100 pb-1 mb-2">CFOP</div>
                                                                                        <div className="space-y-1">
                                                                                            <div className="text-[10px] text-slate-400 uppercase tracking-wide">Código</div>
                                                                                            <div className="font-mono text-slate-700 font-medium bg-slate-50 px-2 py-1 rounded border border-slate-100">{item.cfop_code || '-'}</div>
                                                                                        </div>
                                                                                    </div>

                                                                                    {/* 2. ICMS */}
                                                                                    <div className="space-y-2 border-l border-slate-100 pl-4">
                                                                                        <div className="font-semibold text-slate-900 text-[11px] border-b border-slate-100 pb-1 mb-2">ICMS</div>

                                                                                        <div className="grid grid-cols-1 gap-2">
                                                                                            <div>
                                                                                                <div className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">CST</div>
                                                                                                <div className="font-mono text-slate-700">{item.cst_icms || item.csosn || '-'}</div>
                                                                                            </div>
                                                                                            <div>
                                                                                                <div className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">Alíquota (%)</div>
                                                                                                <div className="font-mono text-slate-700">-</div>
                                                                                            </div>
                                                                                        </div>
                                                                                    </div>

                                                                                    {/* 3. ICMS ST */}
                                                                                    <div className="space-y-2 border-l border-slate-100 pl-4">
                                                                                        <div className="flex items-center justify-between border-b border-slate-100 pb-1 mb-2">
                                                                                            <div className="font-semibold text-slate-900 text-[11px]">ICMS ST</div>
                                                                                            {item.st_applies && <div className="text-[9px] bg-blue-100 text-blue-700 px-1.5 rounded-full font-medium">Aplicar</div>}
                                                                                        </div>

                                                                                        <div className="grid grid-cols-1 gap-2">
                                                                                            <div>
                                                                                                <div className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">MVA (%) / Alíq ST</div>
                                                                                                <div className="font-mono text-slate-700">
                                                                                                    {item.st_aliquot ? formatCurrency(item.st_aliquot).replace('R$', '') + '%' : '-'}
                                                                                                </div>
                                                                                            </div>
                                                                                            <div>
                                                                                                <div className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">Redução Base ST (%)</div>
                                                                                                <div className="font-mono text-slate-700">-</div>
                                                                                            </div>
                                                                                        </div>
                                                                                    </div>

                                                                                    {/* 4. PIS / COFINS */}
                                                                                    <div className="space-y-2 border-l border-slate-100 pl-4">
                                                                                        <div className="font-semibold text-slate-900 text-[11px] border-b border-slate-100 pb-1 mb-2">PIS / COFINS</div>

                                                                                        <div className="grid grid-cols-2 gap-2">
                                                                                            <div className="col-span-2">
                                                                                                <div className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5 font-semibold text-blue-600/80">PIS</div>
                                                                                            </div>
                                                                                            <div>
                                                                                                <div className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">CST</div>
                                                                                                <div className="font-mono text-slate-700">{item.pis_cst || '-'}</div>
                                                                                            </div>
                                                                                            <div>
                                                                                                <div className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">Alíq (%)</div>
                                                                                                <div className="font-mono text-slate-700">{item.pis_aliquot ? item.pis_aliquot + '%' : '-'}</div>
                                                                                            </div>

                                                                                            <div className="col-span-2 mt-1">
                                                                                                <div className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5 font-semibold text-blue-600/80">COFINS</div>
                                                                                            </div>
                                                                                            <div>
                                                                                                <div className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">CST</div>
                                                                                                <div className="font-mono text-slate-700">{item.cofins_cst || '-'}</div>
                                                                                            </div>
                                                                                            <div>
                                                                                                <div className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">Alíq (%)</div>
                                                                                                <div className="font-mono text-slate-700">{item.cofins_aliquot ? item.cofins_aliquot + '%' : '-'}</div>
                                                                                            </div>
                                                                                        </div>
                                                                                    </div>

                                                                                    {/* 5. IPI */}
                                                                                    <div className="space-y-2 border-l border-slate-100 pl-4">
                                                                                        <div className="flex items-center justify-between border-b border-slate-100 pb-1 mb-2">
                                                                                            <div className="font-semibold text-slate-900 text-[11px]">IPI</div>
                                                                                            {item.ipi_applies && <div className="text-[9px] bg-purple-100 text-purple-700 px-1.5 rounded-full font-medium">Aplicar</div>}
                                                                                        </div>

                                                                                        <div className="grid grid-cols-1 gap-2">
                                                                                            {!item.ipi_applies ? (
                                                                                                <div className="text-slate-400 italic text-[10px]">Não aplicável</div>
                                                                                            ) : (
                                                                                                <>
                                                                                                    <div>
                                                                                                        <div className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">CST</div>
                                                                                                        <div className="font-mono text-slate-700">{item.ipi_cst || '-'}</div>
                                                                                                    </div>
                                                                                                    <div>
                                                                                                        <div className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">Alíq (%)</div>
                                                                                                        <div className="font-mono text-slate-700">{item.ipi_aliquot ? item.ipi_aliquot + '%' : '-'}</div>
                                                                                                    </div>
                                                                                                </>
                                                                                            )}
                                                                                        </div>
                                                                                    </div>

                                                                                </div>
                                                                            </div>

                                                                            {/* Status + Audit Footer */}
                                                                            <div className="flex items-center justify-between pt-1">
                                                                                {/* Status Badge */}
                                                                                <div className="flex items-center gap-2">
                                                                                    {item.fiscal_status === 'calculated' && (
                                                                                        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200/50">
                                                                                            <CheckCircle2 className="w-3 h-3" />
                                                                                            <span className="text-[10px] font-medium">Calculado</span>
                                                                                        </div>
                                                                                    )}
                                                                                    {item.fiscal_status === 'no_rule_found' && (
                                                                                        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full border border-amber-200/50">
                                                                                            <AlertCircle className="w-3 h-3" />
                                                                                            <span className="text-[10px] font-medium">Regra não encontrada</span>
                                                                                        </div>
                                                                                    )}
                                                                                    {item.fiscal_status === 'pending' && (
                                                                                        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-50 text-slate-500 rounded-full border border-slate-200/50">
                                                                                            <AlertCircle className="w-3 h-3" />
                                                                                            <span className="text-[10px] font-medium">Pendente</span>
                                                                                        </div>
                                                                                    )}
                                                                                </div>

                                                                                {/* Audit Trail Footer */}
                                                                                {item.fiscal_status === 'calculated' && formData.client_id && selectedCompany && (
                                                                                    <div className="text-[9px] text-slate-400 font-mono">
                                                                                        Regra: {selectedCompany.tax_regime === 'simples' ? 'SN' : 'RN'} |
                                                                                        {' '}Origem: {selectedCompany.address_state || 'SP'} →
                                                                                        Dest: {formData.delivery_address_json?.state || formData.client?.addresses?.[0]?.state || '?'} |
                                                                                        {' '}{formData.client?.icms_contributor ? 'Contrib.' : 'Não Contrib.'} |
                                                                                        {' '}{formData.client?.is_final_consumer ? 'Cons.Final' : 'Revenda'}
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            )}
                                                        </Fragment>
                                                    );
                                                })}
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
                        </div>
                    </TabsContent>

                    <TabsContent value="delivery" className="mt-0 px-6 py-6">
                        <TabDelivery data={formData} onChange={handleFieldChange} />
                    </TabsContent>
                </Tabs>
            </div>
            {/* CONFIRMATION DIALOG */}
            < Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen} >
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
            </Dialog >

            {/* MODAL 1: DELETE DRAFT */}
            < AlertDialog open={deleteDraftOpen} onOpenChange={setDeleteDraftOpen} >
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
            </AlertDialog >

            {/* MODAL 2: ARCHIVE ORDER */}
            < Dialog open={archiveOpen} onOpenChange={setArchiveOpen} >
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
            </Dialog >

            {/* DISPATCH MODAL */}
            < Dialog open={dispatchModalOpen} onOpenChange={setDispatchModalOpen} >
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
                                    onValueChange={setSelectedRouteId}
                                >
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Selecione..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {availableRoutes.map(route => (
                                            <SelectItem key={route.id} value={route.id}>
                                                {route.name} ({route.orders?.length || 0} pedidos)
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
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
            </Dialog >

        </div >
    );
}
