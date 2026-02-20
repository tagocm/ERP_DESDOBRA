"use client";

import { useEffect, useState, useRef, Fragment, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabaseBrowser";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { ConfirmDialogDesdobra } from "@/components/ui/ConfirmDialogDesdobra";
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
import { SalesOrderDTO, SalesOrderItemDTO, SalesOrderAdjustmentDTO, DeliveryRouteDTO, ItemPackagingDTO } from "@/lib/types/sales-dto";
import {
    upsertSalesItemAction,
    confirmOrderAction,
    deleteSalesItemAction,
    cancelOrderAction,
    dispatchOrderAction,
    deleteOrderAction,
    cleanupDraftsAction,
    recalculateFiscalAction,
    getSalesOrderTotalsAction,
    getLastOrderForClientAction,
    upsertSalesOrderAction,
    getSalesFormMetadataAction,
    getQuickItemMetaAction,
    getClientDetailsAction,
    // getSalesOrderDTODetailsAction removed (redundant)
    getCompanySettingsAction,
    getOrganizationDetailsAction
} from "@/app/actions/sales/sales-actions";
import {
    getTodayRoutesAction,
    addOrderToRouteAction,
    getOrCreateDailyRouteAction,
    getOrCreateDispatcherRouteAction
} from "@/app/actions/sales/expedition-actions";
import { resendSalesForApproval } from "@/app/actions/financial/resend-sales-for-approval";
import { PaymentMode } from "@/lib/clients-db"; // PaymentMode type is still needed
import { normalizeFinancialStatus, normalizeLogisticsStatus, translateLogisticsStatusPt } from "@/lib/constants/status";
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
    RefreshCw,
    AlertTriangle,
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
import { getFinancialBadgeStyle, LOGISTICS_STATUS_COLORS } from "@/lib/constants/statusColors";

import { RouteSelectionModal } from "@/components/sales/order/modals/RouteSelectionModal";
import { FinancialBlockBanner } from "@/components/sales/order/FinancialBlockBanner";
import { DeliveriesList } from "@/components/sales/order/DeliveriesList";
import { useDeliveriesModel } from "@/lib/hooks/useDeliveriesModel";

// Minimal local types to replace 'any'
interface QuickItemProduct {
    id: string;
    name: string;
    sku?: string | null;
    un?: string;
    price?: number;
    sale_price?: number;
    net_weight_kg_base?: number;
    gross_weight_kg_base?: number;
    fiscal?: {
        tax_group_id?: string | null;
        ncm?: string | null;
        cest?: string | null;
        origin?: number | null;
        cfop_code?: string | null;
    } | null;
    packagings?: ItemPackagingDTO[];
}

interface PendingFreightData {
    freight_mode: string | null;
    carrier_id: string | null;
    route_tag: string | null;
}

interface SalesOrderDTOFormProps {
    initialData?: SalesOrderDTO;
    mode: 'create' | 'edit';
}

type SalesOrderClientShape = {
    id?: string | null;
    trade_name?: string | null;
    document_number?: string | null;
    document?: string | null;
} | null;

function normalizeSalesOrderClient(rawClient: unknown): SalesOrderClientShape {
    if (!rawClient) return null;
    if (Array.isArray(rawClient)) {
        const first = rawClient[0];
        if (!first || typeof first !== "object") return null;
        return first as SalesOrderClientShape;
    }
    if (typeof rawClient !== "object") return null;
    return rawClient as SalesOrderClientShape;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isPersistedUuid(id?: string | null): id is string {
    return typeof id === 'string' && UUID_REGEX.test(id);
}

export function SalesOrderDTOForm({ initialData, mode }: SalesOrderDTOFormProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const supabase = useMemo(() => createClient(), []); // Stable instance to avoid recreation on each render
    const { toast } = useToast();
    const { selectedCompany } = useCompany();
    const deliveriesModelCompanyId = (mode === 'edit' || !!initialData?.id) ? selectedCompany?.id : undefined;
    const { enabled: deliveriesEnabled } = useDeliveriesModel(deliveriesModelCompanyId);
    const normalizedInitialClient = normalizeSalesOrderClient(initialData?.client);

    // Initialize form data
    const [formData, setFormData] = useState<Partial<SalesOrderDTO>>({
        id: initialData?.id,
        company_id: initialData?.company_id || '',
        client_id: initialData?.client_id || normalizedInitialClient?.id || '',
        // Use 'pendente' as default if undefined, or map from legacy 'pending'
        status_logistic: normalizeLogisticsStatus(initialData?.status_logistic) || "pending",
        status_commercial: initialData?.status_commercial || 'draft',
        status_fiscal: initialData?.status_fiscal || 'none',
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
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isResending, setIsResending] = useState(false);
    const [routeModalOpen, setRouteModalOpen] = useState(false);
    const [pendingRouteOrderId, setPendingRouteOrderId] = useState<string | null>(null);
    const [showMoreOptions, setShowMoreOptions] = useState(false);
    const [confirmLegacyModalOpen, setConfirmLegacyModalOpen] = useState(false);
    const [startNewAfterConfirm, setStartNewAfterConfirm] = useState(false);
    const [redirectToSeparation, setRedirectToSeparation] = useState(false);
    const [activeTab, setActiveTab] = useState("details");

    // Modals state
    const [deleteDraftOpen, setDeleteDraftOpen] = useState(false);

    // ACTION STATES
    const [cancelDialogOpen, setCancelDialogOpen] = useState(false);


    // Handler for generic field updates (passed to Tabs)
    const handleFieldChange = (field: keyof SalesOrderDTO, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };



    // Dispatch Modal States
    const [confirmModalOpen, setConfirmModalOpen] = useState(false); // Legacy? keeping for now just in case
    const [confirmDialogOpen, setConfirmDialogOpen] = useState(false); // Standard Confirm Dialog
    const [freightConfirmOpen, setFreightConfirmOpen] = useState(false);
    const [pendingFreightData, setPendingFreightData] = useState<PendingFreightData | null>(null);
    const [modalAction, setModalAction] = useState<'save' | 'confirm' | null>(null);
    const [dispatchModalOpen, setDispatchModalOpen] = useState(false);
    const [dispatchMode, setDispatchMode] = useState<'avulsa' | 'existing'>('avulsa');
    const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
    const [availableRoutes, setAvailableRoutes] = useState<DeliveryRouteDTO[]>([]);
    const [dispatchConfirmOpen, setDispatchConfirmOpen] = useState(false);

    // Adjustments
    const [adjustments, setAdjustments] = useState<SalesOrderAdjustmentDTO[]>(initialData?.adjustments || []);
    const [showAdjustmentDialog, setShowAdjustmentDialog] = useState(false); // We'll just use a simple prompt or inline row for MVP

    // Metadata State (for dropdowns)
    const [priceTables, setPriceTables] = useState<any[]>([]);
    const [paymentTerms, setPaymentTerms] = useState<any[]>([]);
    const [paymentModes, setPaymentModes] = useState<PaymentMode[]>([]); // New State
    const [branches, setBranches] = useState<any[]>([]);
    const [clientAddresses, setClientAddresses] = useState<any[]>([]);

    // Track if user manually changed the payment mode to prevent auto-fill override
    const manualPaymentModeOverride = useRef(false);



    // FASE 1 - Locked logic for Sales Order
    const isLocked = mode === 'edit' && (
        ['in_route', 'delivered', 'not_delivered'].includes(normalizeLogisticsStatus(formData.status_logistic) || (formData.status_logistic as string)) ||
        formData.status_fiscal === 'authorized'
    );

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
        tradeName: normalizedInitialClient?.trade_name || undefined,
        doc: normalizedInitialClient?.document_number || normalizedInitialClient?.document || undefined
    });

    // Quick Add Item State
    const [quickItem, setQuickItem] = useState<{
        product: QuickItemProduct | null;
        quantity: number;
        price: number;
        packagings?: ItemPackagingDTO[];
        packaging?: ItemPackagingDTO;
    }>({ product: null, quantity: 1, price: 0 });

    // Refs for focus management
    const quickAddProductRef = useRef<HTMLInputElement>(null);
    const quickAddQtyRef = useRef<HTMLInputElement>(null);
    const quickItemMetaCacheRef = useRef<Map<string, { price?: number; packagings: ItemPackagingDTO[] }>>(new Map());
    const quickItemRequestRef = useRef(0);
    const didInitialRehydrateRef = useRef(false);

    // Expanded fiscal details state (track which items show fiscal info)
    const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

    // Fiscal calculation state for automatic recalculation
    const [fiscalStatus, setFiscalStatus] = useState<'idle' | 'pending' | 'calculating' | 'calculated' | 'error'>('idle');
    const [fiscalError, setFiscalError] = useState<string | null>(null);

    // Refs for debouncing and abort control
    const fiscalAbortController = useRef<AbortController | null>(null);
    const itemUpdateTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());

    // ============================================
    // DIRTY TRACKING STATE (FASE 1 - No Autosave Removal)
    // ============================================
    const [originalSnapshot, setOriginalSnapshot] = useState<{
        formData: Partial<SalesOrderDTO>;
    } | null>(null);

    const [isDirty, setIsDirty] = useState(false);


    // --- EFFECT: Handle Tab Query Param ---
    useEffect(() => {
        const tab = searchParams?.get('tab');
        if (tab === 'separation' || tab === 'separacao') {
            setActiveTab('separation');
        }
    }, [searchParams]);

    // --- EFFECT: Detect Dirty State (FASE 1) ---
    useEffect(() => {
        if (!originalSnapshot || mode === 'create') {
            if (isDirty) setIsDirty(false);
            return;
        }

        // Compare formData (simple JSON comparison)
        const currentDataStr = JSON.stringify(formData);
        const originalDataStr = JSON.stringify(originalSnapshot.formData);

        setIsDirty(currentDataStr !== originalDataStr);
    }, [formData, originalSnapshot, mode, isDirty]);

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
            const prod = item.product as any;

            // Resolve packaging
            const pkg = (item as any).packaging || (prod?.packagings?.find((p: any) => p.id === item.packaging_id));
            const factor = pkg ? Number(pkg.qty_in_base) || 1 : 1;

            // 1. Calculate Unit Net
            // Logic: Net Weight = Base Net Weight * Factor
            let unitNet = (Number(prod?.net_weight_kg_base) || 0) * factor;

            // Fallback if base not set
            if (unitNet === 0) {
                unitNet = (Number(prod?.base_weight_kg) || 0) * factor;
            }

            // 2. Calculate Unit Gross
            let unitGross = 0;
            if (pkg && Number(pkg.gross_weight_kg) > 0) {
                // If packaging has a specific Gross Weight defined, use it.
                unitGross = Number(pkg.gross_weight_kg);
            } else {
                // Fallback: Product Base Gross * Factor
                unitGross = (Number(prod?.gross_weight_kg_base) || 0) * factor;
            }

            // Consistency check: Gross should never be less than Net
            if (unitGross < unitNet && unitNet > 0) {
                unitGross = unitNet;
            }

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
            const result = await getSalesOrderTotalsAction(formData.id);
            if (result.success && result.data) {
                const totals = result.data;
                setFormData(prev => ({
                    ...prev,
                    total_amount: totals.total_amount,
                    subtotal_amount: totals.subtotal_amount, // Map correctly if needed
                    freight_amount: totals.freight_amount,
                    discount_amount: totals.discount_amount,
                    total_weight_kg: totals.total_weight_kg
                }));
            }
        } catch (error) {
            console.error("Error refreshing totals:", error);
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
                tradeName: normalizeSalesOrderClient(initialData.client)?.trade_name || undefined,
                doc: normalizeSalesOrderClient(initialData.client)?.document_number || undefined,
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
        let cancelled = false;
        const fetchData = async () => {
            const metadata = await getSalesFormMetadataAction(selectedCompany.id);
            if (cancelled) return;
            setPriceTables(metadata.priceTables);
            setPaymentTerms(metadata.paymentTerms);
            setPaymentModes(metadata.paymentModes);
        };
        fetchData();
        return () => {
            cancelled = true;
        };
    }, [selectedCompany]);

    // Ensure company_id is set on creation
    useEffect(() => {
        if (mode === 'create' && selectedCompany?.id && !formData.company_id) {
            setFormData(prev => ({ ...prev, company_id: selectedCompany.id }));
        }
    }, [selectedCompany, mode, formData.company_id]);

    // Keep customer labels synchronized with selected IDs and loaded metadata
    useEffect(() => {
        if (!formData.client_id) return;
        const priceTableName = priceTables.find(p => p.id === formData.price_table_id)?.name || 'Não definido';
        const paymentTermsName = paymentTerms.find(p => p.id === formData.payment_terms_id)?.name || 'Não definido';
        const paymentModeName = paymentModes.find(p => p.id === formData.payment_mode_id)?.name || 'Não definido';

        setCustomerInfo(prev => ({
            ...prev,
            priceTableName,
            paymentTermsName,
            paymentModeName
        }));
    }, [
        formData.client_id,
        formData.price_table_id,
        formData.payment_terms_id,
        formData.payment_mode_id,
        priceTables,
        paymentTerms,
        paymentModes
    ]);

    // --- 2. Auto-fill Customer Data ---
    const handleCustomerSelect = async (org: any) => {
        if (!org) {
            setFormData(prev => ({ ...prev, client_id: undefined }));
            setCustomerInfo({});
            setClientAddresses([]);
            manualPaymentModeOverride.current = false; // Reset override
            return;
        }

        try {
            const fullOrg = await getClientDetailsAction(org.id, selectedCompany?.id);

            if (fullOrg && !fullOrg.error) {
                const resolveId = (
                    preferredId: string | null | undefined,
                    currentId: string | null | undefined,
                    options: Array<{ id: string }>
                ) => {
                    if (preferredId && options.some(option => option.id === preferredId)) return preferredId;
                    if (currentId && options.some(option => option.id === currentId)) return currentId;
                    return options[0]?.id || '';
                };

                // Defaults
                const priceTableId = resolveId(fullOrg.price_table_id, formData.price_table_id, priceTables);
                const paymentTermsId = resolveId(fullOrg.payment_terms_id, formData.payment_terms_id, paymentTerms);

                // Payment Mode Logic
                let paymentModeId = formData.payment_mode_id;
                if (!manualPaymentModeOverride.current || !paymentModeId) {
                    paymentModeId = resolveId(fullOrg.payment_mode_id, formData.payment_mode_id, paymentModes);
                }

                // Address logic: Pick 'billing' or first available
                const addresses = fullOrg.addresses || [];
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

                const ptName = priceTables.find(p => p.id === priceTableId)?.name || 'Não definido';
                const payName = paymentTerms.find(p => p.id === paymentTermsId)?.name || 'Não definido';
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

            }

        } catch (error) {
            console.error("Error fetching client details:", error);
            toast({
                title: "Erro ao carregar dados do cliente",
                description: "Verifique conexão ou contate suporte.",
                variant: "destructive"
            });
        }
    };

    // Hydrate customer info when editing/reloading an existing draft that already has client_id
    useEffect(() => {
        if (!formData.client_id) return;
        if (customerInfo.tradeName && customerInfo.cityState) return;

        let cancelled = false;
        const loadCustomerInfo = async () => {
            try {
                const fullOrg = await getClientDetailsAction(formData.client_id!, selectedCompany?.id);
                if (cancelled || !fullOrg || fullOrg.error) return;

                const addresses = fullOrg.addresses || [];
                const address = addresses.find((a: any) => a.type === 'billing') || addresses[0];
                const addressStr = address ? `${address.street}, ${address.number} - ${address.neighborhood}` : "Endereço não cadastrado";
                const cityState = address ? `${address.city}/${address.state}` : "";

                setClientAddresses(addresses);
                setCustomerInfo(prev => ({
                    ...prev,
                    tradeName: fullOrg.trade_name || prev.tradeName,
                    doc: fullOrg.document || prev.doc,
                    address: addressStr,
                    cityState
                }));
            } catch (error) {
                console.error("Error hydrating customer info:", error);
            }
        };

        loadCustomerInfo();
        return () => {
            cancelled = true;
        };
    }, [formData.client_id, customerInfo.tradeName, customerInfo.cityState]);

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

    const handleQuickUnitChange = (newPackagingId: string) => {
        if (!quickItem.product) return;

        // 1. Determine Old Factor
        const oldFactor = quickItem.packaging ? Number(quickItem.packaging.qty_in_base) : 1;

        // 2. Determine New Factor and Packaging
        let newFactor = 1;
        let newPkg: ItemPackagingDTO | undefined = undefined;

        if (newPackagingId !== 'base') {
            newPkg = quickItem.packagings?.find(p => p.id === newPackagingId);
            if (newPkg) newFactor = Number(newPkg.qty_in_base);
        }

        // 3. Calc New Price
        // Infer base price from current price / old factor
        const currentPrice = Number(quickItem.price) || 0;
        const basePrice = oldFactor > 0 ? (currentPrice / oldFactor) : 0;
        const newPrice = basePrice * newFactor;

        setQuickItem(prev => ({
            ...prev,
            price: newPrice,
            packaging: newPkg
        }));
    };

    // Resume handleQuickItemSelect...
    const handleQuickItemSelect = async (product: QuickItemProduct | null) => {
        if (!product) {
            setQuickItem(prev => ({ ...prev, product: null, price: 0, packagings: [], packaging: undefined }));
            return;
        }

        const requestId = ++quickItemRequestRef.current;
        const cacheKey = `${formData.price_table_id || 'none'}:${product.id}`;
        const cachedMeta = quickItemMetaCacheRef.current.get(cacheKey);

        // Optimistic update to prevent Selector flicker/clear
        setQuickItem(prev => ({
            ...prev,
            product,
            price: Number(cachedMeta?.price ?? product.sale_price ?? product.price ?? 0),
            quantity: 1,
            packagings: cachedMeta?.packagings || [],
            packaging: cachedMeta?.packagings?.find(p => p.is_default_sales_unit)
                || cachedMeta?.packagings?.find(p => Number(p.qty_in_base) === 1)
                || cachedMeta?.packagings?.[0]
        }));

        if (cachedMeta) {
            setTimeout(() => quickAddQtyRef.current?.focus(), 30);
            return;
        }

        const meta = await getQuickItemMetaAction({
            itemId: product.id,
            priceTableId: formData.price_table_id || null
        });

        if (requestId !== quickItemRequestRef.current) return;

        const packagings = Array.isArray(meta.packagings) ? meta.packagings : [];
        quickItemMetaCacheRef.current.set(cacheKey, { price: meta.price, packagings });

        let defaultPkg = packagings.find(p => p.is_default_sales_unit);
        if (!defaultPkg) defaultPkg = packagings.find(p => Number(p.qty_in_base) === 1);
        if (!defaultPkg) defaultPkg = packagings[0];

        const basePrice = Number(meta.price ?? product.sale_price ?? product.price ?? 0);

        const factor = defaultPkg ? Number(defaultPkg.qty_in_base) : 1;
        const finalPrice = basePrice * factor;

        setQuickItem({
            product: product,
            quantity: 1,
            price: finalPrice,
            packagings: packagings || [],
            packaging: defaultPkg
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
            const unitNetWeightBase = Number(quickItem.product.net_weight_kg_base) || 0;

            // Factor from selected packaging
            const factor = quickItem.packaging ? Number(quickItem.packaging.qty_in_base) : 1;

            const itemNetWeight = unitNetWeightBase * factor;
            // Gross weight estimation
            const itemGrossWeight = (Number(quickItem.product.gross_weight_kg_base) || (unitNetWeightBase * 1.05)) * factor;

            const newItemObj: SalesOrderItemDTO = {
                id: `temp-${Date.now()}`, // Temporary ID
                item_id: quickItem.product.id,
                quantity: quickItem.quantity,
                unit_price: quickItem.price,
                discount_amount: 0,
                total_amount: total,
                document_id: formData.id || '',
                packaging_id: quickItem.packaging?.id || null, // Resolving default here
                qty_base: quickItem.quantity * factor,

                // Pre-populate weights for local calculation
                unit_weight_kg: itemNetWeight,
                gross_weight_kg_snapshot: itemGrossWeight,
                ncm_snapshot: quickItem.product.fiscal?.ncm || null,
                cest_snapshot: quickItem.product.fiscal?.cest || null,
                origin_snapshot: quickItem.product.fiscal?.origin ?? null,
                cfop_code: quickItem.product.fiscal?.cfop_code || null,
                fiscal_status: quickItem.product.fiscal?.tax_group_id ? 'pending' : 'no_rule_found',

                product: {
                    id: quickItem.product.id,
                    name: quickItem.product.name,
                    un: quickItem.product.un || 'UN',
                    sku: quickItem.product.sku || '',
                    net_weight_kg_base: quickItem.product.net_weight_kg_base,
                    gross_weight_kg_base: quickItem.product.gross_weight_kg_base,
                    packagings: quickItem.packagings // Carry over packagings to item state for dropdown
                }
            };

            setFormData(prev => ({
                ...prev,
                items: [...(prev.items || []), newItemObj]
            }));

            // Reset
            setQuickItem({ product: null, quantity: 1, price: 0, packagings: [], packaging: undefined });
            setTimeout(() => quickAddProductRef.current?.focus(), 50);

        } catch (error: unknown) {
            console.error('Error adding item:', error);
            const message = error instanceof Error ? error.message : String(error);
            toast({
                title: "Erro ao adicionar item",
                description: message,
                variant: "destructive"
            });
        }
    };

    const handleRemoveItem = async (index: number) => {
        const item = formData.items?.[index];
        if (!item) return;

        try {
            // PHASE 2: Autosave removed
            // Delete from database if it's a saved item
            if (isPersistedUuid(item.id)) {
                const res = await deleteSalesItemAction(item.id, formData.id!);
                if (!res.success) throw new Error(res.error);
            }

            // Update local state
            const newItems = [...(formData.items || [])];
            newItems.splice(index, 1);
            setFormData(prev => ({ ...prev, items: newItems }));

            // Recalculate fiscal if order exists
            if (formData.id) {
                setTimeout(() => {
                    refreshTotals();
                }, 100);
            }
        } catch (error: unknown) {
            console.error('Error removing item:', error);
            const message = error instanceof Error ? error.message : String(error);
            toast({
                title: "Erro ao remover item",
                description: message,
                variant: "destructive"
            });
        }
    };

    const handleUpdateItem = async (index: number, field: keyof SalesOrderItemDTO, value: any) => {
        const newItems = [...(formData.items || [])];
        const item = { ...newItems[index] }; // Copy

        if (field === 'packaging_id') {
            const newVal = value as string;
            // 1. Old Factor
            let oldFactor = 1;
            const prodPackagings = item.product?.packagings || [];
            if (item.packaging_id) {
                const oldPkg = prodPackagings.find(p => p.id === item.packaging_id);
                if (oldPkg) oldFactor = Number(oldPkg.qty_in_base);
            }

            // 2. New Factor
            let newFactor = 1;
            if (newVal && newVal !== 'base') {
                const newPkg = prodPackagings.find(p => p.id === newVal);
                if (newPkg) newFactor = Number(newPkg.qty_in_base);
            }

            // 3. Calc Price
            const currentPrice = Number(item.unit_price) || 0;
            const basePrice = oldFactor > 0 ? (currentPrice / oldFactor) : 0;
            const newPrice = basePrice * newFactor;

            item.packaging_id = newVal === 'base' ? null : newVal;
            item.unit_price = newPrice;
            item.qty_base = (Number(item.quantity) || 0) * newFactor;
            item.total_amount = (Number(item.quantity) * newPrice) - (Number(item.discount_amount) || 0);

        } else {
            // Standard update
            // @ts-ignore
            item[field] = value;

            // Recalculate Line Total & Qty Base
            if (field === 'quantity' || field === 'unit_price' || field === 'discount_amount') {
                const qty = Number(field === 'quantity' ? value : item.quantity) || 0;
                const price = Number(field === 'unit_price' ? value : item.unit_price) || 0;
                const discount = Number(field === 'discount_amount' ? value : item.discount_amount) || 0;
                item.total_amount = (qty * price) - discount;

                // Also update qty_base if qty changed
                if (field === 'quantity') {
                    let factor = 1;
                    const prodPackagings = item.product?.packagings || [];
                    if (item.packaging_id) {
                        const pkg = prodPackagings.find(p => p.id === item.packaging_id);
                        if (pkg) factor = Number(pkg.qty_in_base);
                    }
                    item.qty_base = qty * factor;
                }
            }
        }

        newItems[index] = item;
        setFormData(prev => ({ ...prev, items: newItems }));

        // PHASE 2 (Autosave Removed): We only update local state.
        /*
        if (item.id && !item.id.startsWith('temp-') && formData.id) {
             // ... logic removed ...
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
            const res = await getLastOrderForClientAction(formData.client_id);
            const lastOrder = res.success ? res.data : null;

            if (!lastOrder || !lastOrder.items || lastOrder.items.length === 0) {
                setRepeatOrderError(true);
                // Auto hide after 5 seconds
                setTimeout(() => setRepeatOrderError(false), 5000);
                setIsLoading(false);
                return;
            }

            // Clone Items
            const newItems = lastOrder.items.map((item: SalesOrderItemDTO) => ({
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
        } catch (e: unknown) {
            console.error('Erro ao repetir pedido:', e);
            const message = e instanceof Error ? e.message : String(e);
            // Handling e?.error_description involves casting or checking
            // However, sticking to the requested normalization rule:
            const errorMsg = message || 'Falha ao buscar último pedido.';
            // If we really need error_description from Supabase, we should cast safely.
            // But per rule "Normalize message", I will stick to standard.
            // Actually, if it's a supabase error it might have error_description.
            // I'll add a safe check.
            let detail = '';
            if (typeof e === 'object' && e !== null && 'error_description' in e) {
                detail = (e as { error_description: string }).error_description;
            }
            toast({ title: "Erro", description: detail || message || 'Falha ao buscar último pedido.', variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };


    const executeSave = async (status: 'draft' | 'confirmed', docTypeOverride?: 'order' | 'proposal') => {
        // CRITICAL: Prevent confirming blocked orders
        if (status === 'confirmed' && formData.dispatch_blocked) {
            const reason = formData.dispatch_blocked_reason || 'Motivo não especificado';
            throw new Error(
                `Pedido bloqueado pelo financeiro.\n\nMotivo: ${reason}\n\nUse "Reenviar para Aprovação" após corrigir as pendências.`
            );
        }

        if (!formData.client_id) {
            throw new Error("Selecione o Cliente.");
        }
        if ((!formData.items || formData.items.length === 0) && status === 'confirmed') {
            throw new Error("Adicione pelo menos um item.");
        }

        if (!selectedCompany?.id) {
            throw new Error("Erro Crítico: Empresa não identificada. Recarregue a página.");
        }

        const isConfirmingNow =
            status === 'confirmed' &&
            (formData.status_commercial || 'draft') !== 'confirmed';

        const payload = {
            ...formData,
            company_id: selectedCompany.id,
            // Two-phase confirm: keep as draft until all items persist successfully.
            status_commercial: isConfirmingNow ? 'draft' : status,
            doc_type: docTypeOverride || formData.doc_type || 'order'
        };
        let savedOrder;
        try {
            const res = await upsertSalesOrderAction(payload);
            if (!res.success) throw new Error(res.error);
            savedOrder = res.data;
        } catch (err: unknown) {
            console.error('upsertSalesDocument Failed:', err);
            // Safe logging
            if (err instanceof Error) {
                console.error('Error Message:', err.message);
                // details/hint are not standard Error props. Cast safely if needed for logging?
                // Or just JSON stringify
            }
            if (typeof err === 'object' && err !== null) {
                if ('details' in err) console.error('Error Details:', (err as any).details);
                if ('hint' in err) console.error('Error Hint:', (err as any).hint);
            }
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
            const isPersistent = isPersistedUuid(orgItem.id);
            const isStillPresent = currentItems.some(curr => curr.id === orgItem.id);
            return isPersistent && !isStillPresent;
        });

        if (itemsToDelete.length > 0) {
            await Promise.all(itemsToDelete.map(item =>
                deleteSalesItemAction(item.id!, savedOrder.id)
            ));
        }

        // 2. Handle Upserts (Inserts + Updates)
        if (currentItems.length > 0) {
            for (const item of currentItems) {
                const isTemp = !isPersistedUuid(item.id);

                const itemToSave = {
                    ...item,
                    document_id: savedOrder.id,
                    company_id: savedOrder.company_id,
                    // IMPORTANT: If temp ID, undefined it so DB generates new UUID
                    id: isTemp ? undefined : item.id
                };

                const res = await upsertSalesItemAction(itemToSave);
                if (!res.success) {
                    const itemLabel = item.product?.name || item.item_id || 'item';
                    throw new Error(`Falha ao salvar ${itemLabel}: ${res.error || 'erro desconhecido'}`);
                }
            }
        }

        if (currentItems.length > 0) {
            await triggerFiscalCalculation(savedOrder.id);
        }

        // Confirm only after item sync succeeds to avoid partial "confirmed" state.
        if (isConfirmingNow) {
            const confirmRes = await confirmOrderAction(savedOrder.id);
            if (!confirmRes.success) {
                throw new Error(confirmRes.error || 'Falha ao confirmar pedido após salvar os itens.');
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
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : String(e);
            toast({ title: "Erro ao salvar", description: message || "Erro desconhecido", variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveDraft = async () => {
        setIsSaving(true);
        try {
            // User "Save as Budget" -> effectively a Proposal
            setFormData(prev => ({ ...prev, doc_type: 'proposal' }));
            await executeSave('draft', 'proposal');
            toast({ title: "Orçamento Salvo", description: "Pedido salvo na lista de orçamentos." });
            router.push('/app/vendas/pedidos');
        } catch (e: unknown) {
            console.error('handleSaveDraft Error Caught:', e);
            if (typeof e === 'object' && e !== null) {
                console.error('Error details (JSON):', JSON.stringify(e, Object.getOwnPropertyNames(e)));
            }

            const message = e instanceof Error ? e.message : String(e);
            const msg = message.includes('permis')
                ? "Falha de permissão ao salvar."
                : (message || "Falha ao salvar. Tente novamente.");

            toast({ title: "Erro ao salvar", description: msg, variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };
    const handleSaveDraftAndNew = async () => {
        setIsSaving(true);
        try {
            await executeSave('draft', 'proposal');
            toast({ title: "Orçamento Salvo", description: "Iniciando novo pedido..." });

            if (mode === 'create') {
                window.location.reload();
            } else {
                router.push('/app/vendas/pedidos/novo');
            }
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : String(e);
            toast({ title: "Erro", description: message, variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };

    const handleConfirmAndNew = async () => {
        handleConfirmTrigger({ isNew: true });
    };

    const handleConfirmAndDispatch = async () => {
        if (!selectedCompany) return;
        setIsSaving(true);
        try {
            // 1. Confirm Commercial (Save/Create first)
            const savedOrder = await executeSave('confirmed', 'order');
            const orderId = savedOrder.id;

            // 2. Get/Create Automatic Route (In Transit)
            const routeRes = await getOrCreateDispatcherRouteAction();
            if (!routeRes.success || !routeRes.data) throw new Error("Falha ao obter rota automática");
            const route = routeRes.data;

            // 3. Add Order to Route
            const addRes = await addOrderToRouteAction(orderId, route.id);
            if (!addRes.success) throw new Error("Falha ao adicionar pedido na rota: " + addRes.error);

            // Force status update to EM_ROTA because addOrderToRoute sets it to 'roteirizado'
            // This should ideally be handled by the server action itself or a dedicated action
            // For now, keeping client-side update for immediate feedback
            setFormData(prev => ({ ...prev, status_logistic: 'in_route' }));

            // Removed dummy adjustment creation (caused 403 and unnecessary)

            // 4. Force Start Route Logic (Create Deliveries + Deduct Stock)
            try {
                const startRes = await fetch('/api/expedition/start-route', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ routeId: route.id })
                });

                if (!startRes.ok) {
                    const err = await startRes.json();
                    console.error("Start Route Error (Background):", err);
                    // We don't block the UI flow, but we log it.
                    // Stock will be fixed when route is processed again if needed.
                }
            } catch (err) {
                console.error("Start Route Fetch Error:", err);
            }

            toast({
                title: "Pedido em Rota!",
                description: `Confirmado e adicionado à ${route.name}`,
                variant: 'default'
            });

            router.push('/app/vendas/pedidos');
        } catch (e: unknown) {
            console.error(e);
            const message = e instanceof Error ? e.message : String(e);
            toast({ title: "Erro ao despachar", description: message, variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };

    const handleConfirmAndNavigateToSeparation = async () => {
        if (!selectedCompany) return;
        setIsSaving(true);
        try {
            // 1. Confirm Commercial (Save/Create first)
            const savedOrder = await executeSave('confirmed', 'order');

            // 2. Open Route Selection Modal
            setPendingRouteOrderId(savedOrder.id);
            setRouteModalOpen(true);

            // Note: We don't redirect yet; modal will handle the route selection and final redirect.
        } catch (e: unknown) {
            console.error(e);
            const message = e instanceof Error ? e.message : String(e);
            toast({ title: "Erro ao iniciar separação", description: message, variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };

    const handleRouteSelected = async (routeId: string) => {
        if (!selectedCompany || !pendingRouteOrderId) return;

        try {
            // Add to the selected route
            const res = await addOrderToRouteAction(pendingRouteOrderId, routeId);
            if (!res.success) throw new Error(res.error);

            // Force status to 'em_rota' (In Route/Separation) if needed, or stick with 'roteirizado'.
            // "Confirmar e ir para Separação" usually implies start of separation.
            // But let's stick to 'roteirizado' which addOrderToRoute sets, or 'em_rota' if that's the "Separation" logic.
            // The prompt says "ir para a separação", so we assume just adding to route is enough for it to appear in Expedition.

            toast({
                title: "Enviado para Separação!",
                description: "Pedido adicionado à rota com sucesso.",
                variant: 'default'
            });

            // Redirect to Expedition (Separation) functionalities
            router.push('/app/expedicao');
        } catch (e: unknown) {
            console.error(e);
            const message = e instanceof Error ? e.message : String(e);
            toast({ title: "Erro ao adicionar à rota", description: message, variant: "destructive" });
        } finally {
            setRouteModalOpen(false);
            setPendingRouteOrderId(null);
        }
    };


    // --- Handler para Reenviar para Aprovação ---
    const handleResendForApproval = async () => {
        if (!formData.id) {
            toast({
                title: "Erro",
                description: "ID do pedido não encontrado",
                variant: "destructive"
            });
            return;
        }

        setIsResending(true);
        try {
            const result = await resendSalesForApproval({ salesDocumentId: formData.id });

            if (result.success) {
                toast({
                    title: "✅ Reenviado para aprovação",
                    description: "Pedido retornou para fila de pré-aprovação financeira.",
                    variant: "default"
                });

                // Refetch do pedido para atualizar o estado
                if (formData.id) {
                    await loadOrder(formData.id);
                }
            } else {
                throw new Error(result.error || 'Falha ao reenviar');
            }
        } catch (e: unknown) {
            console.error('handleResendForApproval error:', e);
            const message = e instanceof Error ? e.message : String(e);
            toast({
                title: "Erro ao reenviar",
                description: message || 'Erro desconhecido',
                variant: "destructive"
            });
        } finally {
            setIsResending(false);
        }
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
            // Confirming -> Must be an Order
            const saved = await executeSave('confirmed', 'order');

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
                    setFormData(prev => ({ ...prev, status_commercial: 'confirmed', status_logistic: 'pending' }));
                    router.replace(`/app/vendas/pedidos/${saved.id}?tab=separation`);
                } else {
                    router.push(`/app/vendas/pedidos/${saved.id}?tab=separation`);
                }
            } else {
                toast({ title: "Pedido Confirmado", description: "O pedido entrou em separação." });
                router.push("/app/vendas/pedidos");
            }
        } catch (e: unknown) {
            console.error(e);
            const message = e instanceof Error ? e.message : String(e);
            toast({ title: "Erro na Confirmação", description: message, variant: "destructive" });
        } finally {
            setIsLoading(false);
            setConfirmDialogOpen(false);
            setStartNewAfterConfirm(false);
        }
    };


    const handleDispatch = () => {
        setDispatchConfirmOpen(true);
    };

    const onConfirmDispatch = async () => {
        setIsLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user || !selectedCompany) throw new Error("Usuário ou empresa não identificados");

            const res = await dispatchOrderAction(formData.id!);
            if (!res.success) throw new Error(res.error);

            toast({ title: "Pedido Despachado", description: "Status atualizado para Expedição." });
            setFormData(prev => ({ ...prev, status_logistic: 'in_route' }));
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : String(e);
            toast({ title: "Erro", description: message, variant: "destructive" });
        } finally {
            setIsLoading(false);
            setDispatchConfirmOpen(false);
        }
    };



    const handleExecuteDeleteDraft = async () => {
        if (!formData.id) return;
        setIsLoading(true);
        try {
            const res = await deleteOrderAction(formData.id);
            if (!res.success) throw new Error(res.error);

            toast({ title: "Rascunho excluído permanentemente", variant: 'default' });
            router.push('/app/vendas/pedidos');
            router.refresh();
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            toast({
                title: "Erro ao excluir",
                description: message,
                variant: 'destructive'
            });
        } finally {
            setIsLoading(false);
            setDeleteDraftOpen(false);
        }
    };

    const handleDeleteDraftClick = () => {
        setDeleteDraftOpen(true);
    };



    const executeDispatch = async () => {
        setIsLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user || !selectedCompany) throw new Error("Usuário ou empresa não identificados");

            // First, save/confirm the order
            const savedOrder = await executeSave('confirmed', 'order');

            let targetRouteId: string;

            if (dispatchMode === 'avulsa') {
                // 1. Get/Create Daily Route
                const routeRes = await getOrCreateDailyRouteAction(new Date().toISOString());
                if (!routeRes.success || !routeRes.data) throw new Error("Falha ao obter rota diária");
                const dailyRoute = routeRes.data;

                targetRouteId = selectedRouteId === 'new' ? dailyRoute.id : (selectedRouteId || '');
                if (!targetRouteId) throw new Error("Rota inválida selecionada");
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
            // 3. Add to Route
            const addRes = await addOrderToRouteAction(targetRouteId, savedOrder.id);
            if (!addRes.success) throw new Error(addRes.error);

            toast({
                title: "Pedido confirmado e despachado",
                description: dispatchMode === 'avulsa'
                    ? "Pedido saiu para entrega imediata."
                    : "Pedido vinculado à rota selecionada."
            });

            setDispatchModalOpen(false);
            router.push("/app/vendas/pedidos");
        } catch (e: unknown) {
            console.error(e);
            const message = e instanceof Error ? e.message : String(e);
            toast({ title: "Erro no despacho", description: message, variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    // --- FISCAL CALCULATION (automatic & manual) ---
    const triggerFiscalCalculation = async (orderIdOverride?: string) => {
        if (!selectedCompany || !formData.client_id) {
            setFiscalStatus('idle');
            return;
        }
        const targetOrderId = orderIdOverride || formData.id;
        if (!targetOrderId) {
            setFiscalStatus('idle');
            return;
        }

        try {
            setFiscalStatus('calculating');
            setFiscalError(null);

            const supabase = createClient();

            // Get company settings
            const { data: companyDataRaw, error: companyError } = await supabase
                .from('company_settings')
                .select('address_state, tax_regime')
                .eq('company_id', selectedCompany.id)
                .single();

            interface CompanySettingsResult {
                address_state: string;
                tax_regime: string;
            }
            const companyData = companyDataRaw as unknown as CompanySettingsResult;

            if (companyError || !companyData) {
                throw new Error(`Configurações da empresa não encontradas: ${companyError?.message || ''}`);
            }
            const normalizedTaxRegime: 'simples' | 'normal' = String(companyData.tax_regime || '')
                .toLowerCase()
                .includes('simples')
                ? 'simples'
                : 'normal';

            // Get full organization data (without inner join on addresses) for robust fiscal context
            const fullOrg = await getClientDetailsAction(formData.client_id);
            if (!fullOrg || fullOrg.error) {
                throw new Error(`Dados do cliente não encontrados: ${fullOrg?.error || ''}`);
            }

            const fallbackCustomerType = fullOrg?.icms_contributor ? 'contribuinte' : 'nao_contribuinte';
            const fallbackCustomerIsFinalConsumer = Boolean(fullOrg?.is_final_consumer);
            const resolvedCustomerUF = fullOrg?.addresses?.[0]?.state || 'SP';
            const resolvedCustomerType = fullOrg?.ie_indicator === 'contributor'
                ? 'contribuinte'
                : fullOrg?.ie_indicator === 'exempt'
                    ? 'isento'
                    : fallbackCustomerType;
            const resolvedCustomerIsFinalConsumer = fullOrg?.is_final_consumer ?? fallbackCustomerIsFinalConsumer;

            const fiscalResult = await recalculateFiscalAction({
                orderId: targetOrderId,
                companyUF: companyData.address_state || 'SP',
                companyTaxRegime: normalizedTaxRegime,
                customerUF: resolvedCustomerUF,
                customerType: resolvedCustomerType,
                customerIsFinalConsumer: resolvedCustomerIsFinalConsumer
            });
            if (!fiscalResult.success) {
                throw new Error(fiscalResult.error || 'Falha ao recalcular dados fiscais');
            }
            await refreshTotals();
            // Reload items from database to get updated fiscal data
            const { data: updatedItems, error: itemsError } = await supabase
                .from('sales_document_items')
                .select(`
                    *,
                    fiscal_operation:fiscal_operations!sales_document_items_fiscal_operation_id_fkey(
                        id, icms_rate_percent, icms_reduction_bc_percent, st_rate_percent, st_mva_percent, st_reduction_bc_percent
                    ),
                    packaging:item_packaging(id, label, gross_weight_kg, net_weight_kg),
                    product:items!fk_sales_item_product(
                        id, name, sku, un:uom,
                        net_weight_kg_base, gross_weight_kg_base,
                        net_weight_g_base, gross_weight_g_base,
                        base_weight_kg,
                        packagings:item_packaging!item_packaging_item_id_fkey(*)
                    )
                `)
                .eq('document_id', targetOrderId)
                .order('created_at');

            if (!itemsError && updatedItems) {
                // Update formData with fresh items from DB, but preserve dirty items (being edited)
                setFormData(prev => {
                    const currentItems = prev.items || [];
                    const mergedItems = updatedItems.map((dbItem: SalesOrderItemDTO) => {
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
        } catch (error: unknown) {
            console.error('Fiscal calculation error:', error);
            const message = error instanceof Error ? error.message : String(error);
            setFiscalError(message || 'Erro ao calcular fiscal');
            setFiscalStatus('error');
        }
    };

    // --- HELPERS ---
    const formatStatus = (status: string | undefined | null) => {
        if (!status) return 'N/A';
        if (status === 'draft' && formData.doc_type === 'proposal') return 'Orçamento';
        const map: Record<string, string> = {
            draft: 'Rascunho',
            confirmed: 'Confirmado',
            sent: 'Enviado',
            approved: 'Aprovado',
            cancelled: 'Cancelado',
            lost: 'Perdido'
        };
        if (map[status]) return map[status];
        return translateLogisticsStatusPt(status);
    };

    const loadOrder = async (id: string) => {
        const { data, error } = await supabase
            .from('sales_documents')
            .select(`
                *,
                client:organizations!client_id(id, trade_name, document_number),
                items:sales_document_items(
                    *,
                    fiscal_operation:fiscal_operations!sales_document_items_fiscal_operation_id_fkey(
                        id, icms_rate_percent, icms_reduction_bc_percent, st_rate_percent, st_mva_percent, st_reduction_bc_percent
                    ),
                    product:items!fk_sales_item_product(*, packagings:item_packaging!item_packaging_item_id_fkey(*))
                ),
                adjustments:sales_document_adjustments(*)
            `)
            .eq('id', id)
            .single();

        if (!error && data) {
            setFormData(data as SalesOrderDTO);
            setCustomerInfo(prev => ({
                ...prev,
                tradeName: normalizeSalesOrderClient((data as any).client)?.trade_name || prev.tradeName,
                doc: normalizeSalesOrderClient((data as any).client)?.document_number || prev.doc
            }));
            return;
        }

        console.error('[loadOrder] primary query failed, trying fallback:', error?.message);

        // Fallback path: split queries to avoid breaking on nested relationship issues.
        const { data: doc, error: docError } = await supabase
            .from('sales_documents')
            .select('*')
            .eq('id', id)
            .single();

        if (docError || !doc) {
            console.error('[loadOrder] fallback document query failed:', docError?.message);
            return;
        }

        const [clientRes, itemsRes, adjustmentsRes] = await Promise.all([
            doc.client_id
                ? supabase
                    .from('organizations')
                    .select('id, trade_name, document_number')
                    .eq('id', doc.client_id)
                    .maybeSingle()
                : Promise.resolve({ data: null, error: null } as any),
            supabase
                .from('sales_document_items')
                .select('*')
                .eq('document_id', id),
            supabase
                .from('sales_document_adjustments')
                .select('*')
                .eq('sales_document_id', id)
        ]);

        if (itemsRes.error) {
            console.error('[loadOrder] fallback items query failed:', itemsRes.error.message);
        }

        const rawItems = itemsRes.data || [];
        const productIds = Array.from(new Set(rawItems.map((item: any) => item.item_id).filter(Boolean)));
        const fiscalOperationIds = Array.from(new Set(rawItems.map((item: any) => item.fiscal_operation_id).filter(Boolean)));
        const { data: products } = productIds.length > 0
            ? await supabase
                .from('items')
                .select('*')
                .in('id', productIds)
            : { data: [] as any[] };
        const { data: fiscalOperations } = fiscalOperationIds.length > 0
            ? await supabase
                .from('fiscal_operations')
                .select('id, icms_rate_percent, icms_reduction_bc_percent, st_rate_percent, st_mva_percent, st_reduction_bc_percent')
                .in('id', fiscalOperationIds)
            : { data: [] as any[] };

        const productsById = new Map((products || []).map((p: any) => [p.id, p]));
        const fiscalOperationsById = new Map((fiscalOperations || []).map((fo: any) => [fo.id, fo]));
        const hydratedItems = rawItems.map((item: any) => ({
            ...item,
            product: productsById.get(item.item_id) || null,
            fiscal_operation: fiscalOperationsById.get(item.fiscal_operation_id) || null
        }));

        const hydrated = {
            ...doc,
            client: clientRes.data || null,
            items: hydratedItems,
            adjustments: adjustmentsRes.data || []
        };

        setFormData(hydrated as SalesOrderDTO);
        setCustomerInfo(prev => ({
            ...prev,
            tradeName: normalizeSalesOrderClient((hydrated as any).client)?.trade_name || prev.tradeName,
            doc: normalizeSalesOrderClient((hydrated as any).client)?.document_number || prev.doc
        }));
    };

    // Rehydrate once on edit to avoid opening partially loaded orders.
    useEffect(() => {
        if (mode !== 'edit') return;
        if (!formData.id) return;
        if (didInitialRehydrateRef.current) return;

        didInitialRehydrateRef.current = true;
        loadOrder(formData.id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mode, formData.id]);

    const executeCancel = async () => {
        if (!formData.id || !selectedCompany) return;
        setIsLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Unauthorized");

            // Cancel Order
            const res = await cancelOrderAction(formData.id!, "Cancelado via interface web");
            if (!res.success) throw new Error(res.error);

            toast({ title: "Pedido cancelado com sucesso." });
            setFormData(prev => ({ ...prev, status_commercial: 'cancelled' }));

            toast({
                title: "Pedido cancelado",
                description: "O pedido foi cancelado com sucesso. Redirecionando...",
            });

            // Redirect to list
            router.push('/app/vendas/pedidos');
            router.refresh();
        } catch (error: unknown) {
            console.error(error);
            const message = error instanceof Error ? error.message : String(error);
            toast({
                title: "Erro ao cancelar",
                description: message,
                variant: "destructive"
            });
        } finally {
            setIsLoading(false);
            setCancelDialogOpen(false);
        }
    };




    /*
    const executeDelete = async (reason: string) => {
        // ... replaced by executeArchive
    };
    */

    const handleDeleteClick = () => {
        // This is now purely for drafts or archives?
        // If mode is create, just cancel...
        if (mode === 'create') {
            router.back();
            return;
        }

        // If draft, use "Delete Draft" dialog behavior
        if (formData.status_commercial === 'draft' || (formData.status_commercial as string) === 'budget') {
            setDeleteDraftOpen(true);
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
                        <Button variant="ghost" onClick={() => router.back()} disabled={isSaving} className="text-gray-500">
                            Voltar
                        </Button>

                        {mode === 'edit' && formData.id && formData.status_commercial !== 'cancelled' && (
                            <>
                                <Button
                                    variant="outline"
                                    onClick={() => setCancelDialogOpen(true)}
                                    disabled={isLoading || isLocked}
                                    className="text-gray-600"
                                >
                                    Cancelar Pedido
                                </Button>

                            </>
                        )}

                        {/* --- NOVO BOTÃO SALVAR (FASE 1) --- */}
                        {mode === 'edit' && isDirty && (
                            <Button
                                onClick={handleQuickSave}
                                disabled={isSaving || isLocked}
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
                            <div className="flex items-center -space-x-px overflow-hidden rounded-2xl focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background">
                                <Button
                                    onClick={handleSaveDraft}
                                    disabled={isSaving || !formData.client_id || isLocked}
                                    className="rounded-none z-10 focus:z-20 font-medium pr-2"
                                    data-testid="order-save-button"
                                >
                                    <Save className="w-4 h-4 mr-2" /> Salvar Orçamento
                                </Button>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            className="rounded-none px-2 z-10 focus:z-20 pl-1"
                                            disabled={isSaving || !formData.client_id || isLocked}
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
                                                {!isLocked && (
                                                    <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={handleDeleteDraftClick}>
                                                        <Trash2 className="w-4 h-4 mr-2" /> Excluir Orçamento
                                                    </DropdownMenuItem>
                                                )}
                                            </>
                                        )}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        )}

                        {/* --- SPLIT BUTTON: CONFIRM --- */}
                        {formData.status_commercial === 'draft' && (
                            <div className="flex items-center -space-x-px overflow-hidden rounded-2xl focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background">
                                <Button
                                    onClick={() => handleConfirmTrigger()}
                                    disabled={isSaving || isLoading || !formData.client_id || !formData.items?.length}
                                    className="bg-green-600 hover:bg-green-700 text-white rounded-none z-10 focus:z-20 font-medium pr-2"
                                    data-testid="order-confirm-button"
                                >
                                    <CheckCircle className="w-4 h-4 mr-2" /> Confirmar Pedido
                                </Button>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            className="bg-green-600 hover:bg-green-700 text-white rounded-none px-2 z-10 focus:z-20 pl-1"
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
                                        <DropdownMenuItem onClick={handleConfirmAndNavigateToSeparation}>
                                            <Package className="w-4 h-4 mr-2" /> Confirmar e ir para Separação
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        )}

                        {/* --- DISPATCH ACTION (Existing) --- */}
                        {formData.status_commercial === 'confirmed' && ['pending'].includes(normalizeLogisticsStatus(formData.status_logistic) || (formData.status_logistic as string)) && (
                            <div className="flex items-center -space-x-px overflow-hidden rounded-2xl focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background">
                                <Button onClick={handleDispatch} disabled={isSaving || isLoading} className="bg-blue-600 hover:bg-blue-700 text-white rounded-none z-10 focus:z-20 pr-2">
                                    <Truck className="w-4 h-4 mr-2" /> Despachar / Enviar
                                </Button>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button className="bg-blue-600 hover:bg-blue-700 text-white rounded-none px-2 z-10 focus:z-20 pl-1" disabled={isSaving || isLoading}>
                                            <ChevronDown className="w-4 h-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">

                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        )}

                        {/* FALLBACK ARCHIVE FOR OTHER STATES */}

                    </div>
                }
            >

            </PageHeader>

            {isLocked && (
                <div className="px-6 mt-6">
                    <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-center gap-3 text-amber-800 animate-in fade-in slide-in-from-top-2 duration-500">
                        <AlertCircle className="w-5 h-5 text-amber-600" />
                        <div className="text-sm font-medium leading-relaxed">
                            Este pedido está em status logístico <strong className="uppercase">{formData.status_logistic?.replace('_', ' ')}</strong> ou já foi faturado, e não pode mais ser alterado.
                        </div>
                    </div>
                </div>
            )}

            <div className="w-full mt-6">
                {/* Financial Block Warning Banner */}
                {mode === 'edit' && formData.dispatch_blocked && (
                    <div className="px-6 mb-6">
                        <FinancialBlockBanner
                            reason={formData.dispatch_blocked_reason}
                            onResend={handleResendForApproval}
                            isResending={isResending}
                        />
                    </div>
                )}

                <Tabs defaultValue="order" className="w-full">
                    <div className="px-6 mb-2 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <FormTabsList className="w-auto shrink-0">
                            <FormTabsTrigger value="order">Detalhes do Pedido</FormTabsTrigger>
                            <FormTabsTrigger value="delivery">Entrega & Frete</FormTabsTrigger>
                        </FormTabsList>

                        <div className="flex items-center gap-2 flex-nowrap overflow-x-auto justify-end pb-2 md:pb-0 scrollbar-none min-w-0">
                            {/* Commercial Status */}
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-100 whitespace-nowrap">
                                <span className="text-xs font-semibold text-blue-700 uppercase tracking-tight">Comercial</span>
                                <span className="text-sm font-bold text-blue-900">{formatStatus(formData.status_commercial)}</span>
                            </div>

                            {/* Logistic Status */}
                            {(() => {
                                const style = LOGISTICS_STATUS_COLORS[normalizeLogisticsStatus(formData.status_logistic) || formData.status_logistic || 'pending'] || LOGISTICS_STATUS_COLORS['pending'];
                                return (
                                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${style.bg.replace('bg-', 'border-').replace('100', '200')} ${style.bg} whitespace-nowrap`}>
                                        <span className={`text-xs font-semibold uppercase tracking-tight ${style.text}`}>Logístico</span>
                                        <span className={`text-sm font-bold ${style.text}`}>{style.label}</span>
                                    </div>
                                );
                            })()}

                            {/* Financial Status */}
                            {(() => {
                                const style = getFinancialBadgeStyle(normalizeFinancialStatus(formData.financial_status) || formData.financial_status || 'pending');
                                return (
                                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${style.bg.replace('bg-', 'border-').replace('100', '200')} ${style.bg} whitespace-nowrap`}>
                                        <span className={`text-xs font-semibold uppercase tracking-tight ${style.text}`}>Financeiro</span>
                                        <span className={`text-sm font-bold ${style.text}`}>{style.label}</span>
                                    </div>
                                );
                            })()}

                            {/* Fiscal Status */}
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-50 border border-gray-100 whitespace-nowrap">
                                <span className="text-xs font-semibold text-gray-600 uppercase tracking-tight">Fiscal</span>
                                <span className="text-sm font-bold text-gray-800">{formData.status_fiscal === 'none' ? 'N/A' : (formData.status_fiscal === 'authorized' ? 'Autorizada' : 'Pendente')}</span>
                            </div>
                        </div>
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
                                <Card className="border-gray-100/70">
                                    <div className="p-6 space-y-5">
                                        {/* Selector Row */}
                                        <div className="flex flex-col md:flex-row gap-6">
                                            <div className="flex-1 space-y-2">
                                                <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Cliente / Destinatário</Label>
                                                <div className="flex items-center gap-2">
                                                    <div className="flex-1">
                                                        <OrganizationSelector
                                                            value={formData.client_id || ''}
                                                            companyId={selectedCompany?.id}
                                                            currentOrganization={formData.client_id ? {
                                                                id: formData.client_id,
                                                                trade_name: customerInfo.tradeName || initialData?.client?.trade_name || ''
                                                            } : undefined}
                                                            onChange={(_, org) => handleCustomerSelect(org)}
                                                            type="customer"
                                                            disabled={isLocked}
                                                            data-testid="order-client-input"
                                                        />
                                                    </div>
                                                    <Button
                                                        variant="outline"
                                                        size="icon"
                                                        title="Repetir itens do último pedido"
                                                        disabled={!formData.client_id || isLoading || isLocked}
                                                        onClick={handleRepeatLastOrder}
                                                        className="shrink-0 text-brand-600 border-brand-200 hover:bg-brand-50 h-10 w-10"
                                                    >
                                                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                                                    </Button>
                                                </div>
                                            </div>
                                            {/* Read-only Summary - Always visible */}
                                            <div className="flex-[2] bg-gray-50/80 rounded-2xl border border-gray-100 p-4 grid grid-cols-1 md:grid-cols-[auto_1fr] gap-10">
                                                <Card className="p-3 text-center border-gray-100 shadow-none min-w-24">
                                                    <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Número</span>
                                                    <span className="block text-xl font-bold text-gray-800 font-mono" data-testid="order-number">
                                                        {formData.document_number
                                                            ? String(formData.document_number).padStart(4, '0')
                                                            : '-'}
                                                    </span>
                                                </Card>
                                                <div>
                                                    <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Localização / Tabela / Prazo / Forma</span>
                                                    <div className="flex items-center gap-2 text-sm">
                                                        <span className="font-medium text-gray-900 truncate">{customerInfo.cityState || '-'}</span>
                                                        <span className="text-gray-300">•</span>
                                                        <span className="font-medium text-brand-600 truncate">{customerInfo.priceTableName || 'Não definido'}</span>
                                                        <span className="text-gray-300">•</span>
                                                        <span className="font-medium text-brand-600 truncate">{customerInfo.paymentTermsName || 'Não definido'}</span>
                                                        <span className="text-gray-300">•</span>
                                                        <span className="font-medium text-brand-600 truncate">{customerInfo.paymentModeName || 'Não definido'}</span>
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
                                                            disabled={isLocked}
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
                                                        <Label className="text-xs text-gray-500 mb-1.5 block">Prazo de Pagamento</Label>
                                                        <Select
                                                            value={formData.payment_terms_id || ''}
                                                            onValueChange={(val) => handleFieldChange('payment_terms_id', val)}
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
                                                            onValueChange={(val) => {
                                                                manualPaymentModeOverride.current = true;
                                                                const selectedMode = paymentModes.find(pm => pm.id === val);
                                                                setFormData({ ...formData, payment_mode_id: val });
                                                                setCustomerInfo(prev => ({ ...prev, paymentModeName: selectedMode?.name }));
                                                            }}
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
                                </Card>


                                {/* --- DELIVERIES SECTION --- */}
                                <DeliveriesList
                                    salesDocumentId={formData.id}
                                    useDeliveriesModel={deliveriesEnabled}
                                />

                                {/* --- BLOCK B: ITENS --- */}
                                <Card className="border-gray-100/70 overflow-hidden">
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
                                                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full border border-blue-200/50">
                                                    <Loader2 className="w-3 h-3 animate-spin" />
                                                    <span className="text-[10px] font-medium">Calculando...</span>
                                                </div>
                                            )}

                                            {fiscalStatus === 'calculated' && (
                                                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200/50">
                                                    <CheckCircle2 className="w-3 h-3" />
                                                    <span className="text-[10px] font-medium">Fiscal OK</span>
                                                </div>
                                            )}

                                            {fiscalStatus === 'pending' && (
                                                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 text-slate-500 rounded-full border border-slate-200/50">
                                                    <Clock className="w-3 h-3" />
                                                    <span className="text-[10px] font-medium">Pendente...</span>
                                                </div>
                                            )}

                                            {fiscalStatus === 'error' && (
                                                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-red-50 text-red-700 rounded-full border border-red-200/50">
                                                    <AlertCircle className="w-3 h-3" />
                                                    <span className="text-[10px] font-medium">Erro</span>
                                                </div>
                                            )}
                                        </div>
                                        {/* Manual fiscal button removed - now automatic */}
                                    </div>

                                    {/* Quick Add Row - Proportional Layout */}
                                    {/* Quick Add Row - Proportional Layout */}
                                    <div className="bg-brand-50/30 border-b border-brand-100/50 flex items-end w-full py-3 px-6 gap-4">
                                        <div className="flex-1 space-y-1.5">
                                            <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Adicionar Produto</Label>
                                            <ProductSelector
                                                ref={quickAddProductRef}
                                                value={quickItem.product?.id}
                                                onChange={handleQuickItemSelect}
                                                companyId={selectedCompany?.id}
                                                disabled={isLocked}
                                                data-testid="order-product-search"
                                            />
                                        </div>

                                        <div className="w-60 space-y-1.5 flex-shrink-0">
                                            <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block text-center">UN</Label>
                                            <Select
                                                // @ts-ignore
                                                value={quickItem.packaging?.id || 'base'}
                                                onValueChange={handleQuickUnitChange}
                                                // @ts-ignore
                                                disabled={isLocked || !quickItem.product}
                                            >
                                                <SelectTrigger className="h-9 w-full bg-white border-brand-200 focus:border-brand-500 text-xs">
                                                    <SelectValue placeholder="UN" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="base">
                                                        UNIDADE (1 {quickItem.product?.un || 'UN'})
                                                    </SelectItem>
                                                    {quickItem.packagings?.map((p) => (
                                                        <SelectItem key={p.id} value={p.id}>
                                                            {p.label} (x{p.qty_in_base})
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="w-24 space-y-1.5 flex-shrink-0">
                                            <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block text-center">QTDE</Label>
                                            <DecimalInput
                                                ref={quickAddQtyRef}
                                                data-testid="order-item-qty"
                                                className="h-9 w-full text-center border-brand-200 focus:border-brand-500 bg-white"
                                                value={quickItem.quantity}
                                                onChange={(val) => setQuickItem({ ...quickItem, quantity: val || 0 })}
                                                precision={0}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') addQuickItem();
                                                }}
                                                disabled={isLocked}
                                            />
                                        </div>
                                        <div className="w-32 space-y-1.5 flex-shrink-0">
                                            <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block text-center">PREÇO</Label>
                                            <DecimalInput
                                                data-testid="order-item-price"
                                                className="h-9 w-full text-right border-brand-200 focus:border-brand-500 bg-white"
                                                value={quickItem.price}
                                                onChange={(val) => setQuickItem({ ...quickItem, price: val || 0 })}
                                                precision={2}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') addQuickItem();
                                                }}
                                                disabled={isLocked}
                                            />
                                        </div>
                                        <div className="w-32 flex-shrink-0">
                                            <Button className="w-full h-9 bg-brand-600 hover:bg-brand-700 text-white" onClick={addQuickItem} disabled={!quickItem.product || isLocked}>
                                                <Plus className="w-4 h-4 md:mr-2" /> <span className="hidden md:inline">Adicionar</span>
                                            </Button>
                                        </div>
                                    </div>

                                    <div className="mt-2" />
                                    {/* Items Table */}
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm text-left table-fixed">
                                            <thead className="bg-gray-50/50 text-gray-500 font-medium border-b border-gray-100">
                                                <tr>
                                                    <th className="py-3 px-6 w-16 text-center text-xs uppercase tracking-wider">#</th>
                                                    <th className="py-3 px-6 text-xs uppercase tracking-wider">PRODUTO</th>
                                                    <th className="py-3 px-6 w-28 text-center text-xs uppercase tracking-wider">UN</th>
                                                    <th className="py-3 px-6 w-32 text-center text-xs uppercase tracking-wider">QTDE</th>
                                                    <th className="py-3 px-6 w-40 text-center text-xs uppercase tracking-wider">PREÇO</th>
                                                    <th className="py-3 px-6 w-40 text-center text-xs uppercase tracking-wider">DESC.</th>
                                                    <th className="py-3 px-6 w-48 text-right text-xs uppercase tracking-wider">TOTAL</th>
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
                                                                        <span className="text-[10px] text-gray-400 font-mono">SKU: {item.product?.sku}</span>
                                                                    </div>
                                                                </td>
                                                                <td className="py-3 px-6 text-center">
                                                                    <div className="flex justify-center">
                                                                        {/* @ts-ignore */}
                                                                        {(item.product?.packagings && item.product.packagings.length > 0) ? (
                                                                            <Select
                                                                                value={item.packaging_id || 'base'}
                                                                                onValueChange={(val) => handleUpdateItem(idx, 'packaging_id', val)}
                                                                                disabled={isLocked}
                                                                            >
                                                                                <SelectTrigger className="h-8 text-xs border-0 bg-transparent hover:bg-gray-100 w-auto min-w-20">
                                                                                    {/* Show current label */}
                                                                                    <SelectValue placeholder={item.product?.un || 'UN'} />
                                                                                </SelectTrigger>
                                                                                <SelectContent>
                                                                                    <SelectItem value="base">
                                                                                        UNIDADE (1 {item.product?.un || 'UN'})
                                                                                    </SelectItem>
                                                                                    {/* @ts-ignore */}
                                                                                    {item.product.packagings.map(p => (
                                                                                        <SelectItem key={p.id} value={p.id}>
                                                                                            {p.label} ({Number(p.qty_in_base)} {item.product?.un || 'UN'})
                                                                                        </SelectItem>
                                                                                    ))}
                                                                                </SelectContent>
                                                                            </Select>
                                                                        ) : (
                                                                            <span className="text-gray-500 text-xs">{item.product?.un || 'UN'}</span>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                                <td className="py-3 px-6 text-right">
                                                                    <DecimalInput
                                                                        className="w-full text-center bg-white border border-gray-200 focus:border-brand-500 focus:ring-1 focus:ring-brand-500/20 rounded-2xl h-9 text-sm font-medium text-gray-700 transition-all"
                                                                        value={item.quantity}
                                                                        onChange={(val) => handleUpdateItem(idx, 'quantity', val || 0)}
                                                                        precision={0}
                                                                        disabled={isLocked}
                                                                    />
                                                                </td>
                                                                <td className="py-3 px-6 text-right">
                                                                    <DecimalInput
                                                                        className="w-full text-right bg-white border border-gray-200 focus:border-brand-500 focus:ring-1 focus:ring-brand-500/20 rounded-2xl h-9 text-sm font-medium text-gray-700 transition-all"
                                                                        value={item.unit_price}
                                                                        onChange={(val) => handleUpdateItem(idx, 'unit_price', val || 0)}
                                                                        precision={2}
                                                                        disabled={isLocked}
                                                                    />
                                                                </td>
                                                                <td className="py-3 px-6 text-right">
                                                                    <DecimalInput
                                                                        className="w-full text-right text-red-600 bg-white border border-gray-200 focus:border-red-500 focus:ring-1 focus:ring-red-500/20 rounded-2xl h-9 text-sm transition-all placeholder:text-gray-200"
                                                                        value={item.discount_amount}
                                                                        onChange={(val) => handleUpdateItem(idx, 'discount_amount', val || 0)}
                                                                        precision={2}
                                                                        disabled={isLocked}
                                                                    />
                                                                </td>
                                                                <td className="py-3 px-6 text-right font-semibold text-gray-900 bg-gray-50/30">
                                                                    {formatCurrency(item.total_amount)}
                                                                </td>
                                                                <td className="py-3 px-6 text-center">
                                                                    {!isLocked && (
                                                                        <button
                                                                            onClick={() => handleRemoveItem(idx)}
                                                                            className="p-1.5 rounded-2xl text-gray-400 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                                                                        >
                                                                            <Trash2 className="w-4 h-4" />
                                                                        </button>
                                                                    )}
                                                                </td>
                                                            </tr>

                                                            {/* Fiscal Details Expandable Row */}
                                                            {isExpanded && (
                                                                <tr className="bg-slate-50/40">
                                                                    <td></td>
                                                                    <td colSpan={7} className="py-3 px-6">
                                                                        <div className="space-y-2.5">

                                                                            {/* Product Classification (independent of operation) */}
                                                                            <Card className="border-slate-200/60 p-3 shadow-none">
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
                                                                            </Card>

                                                                            {/* DEBUG: Show Fiscal Notes/Errors */}
                                                                            {item.fiscal_notes && (
                                                                                <div className="bg-amber-50 rounded-2xl border border-amber-200/60 p-3 text-xs text-amber-800">
                                                                                    <div className="font-semibold mb-1 flex items-center gap-1.5">
                                                                                        <AlertCircle className="w-3 h-3" />
                                                                                        Atenção Fiscal:
                                                                                    </div>
                                                                                    {item.fiscal_notes}
                                                                                </div>
                                                                            )}

                                                                            <Card className="border-slate-200/60 p-3 shadow-none">
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
                                                                                                <div className="font-mono text-slate-700">
                                                                                                    {item.fiscal_operation?.icms_rate_percent !== null && item.fiscal_operation?.icms_rate_percent !== undefined
                                                                                                        ? `${item.fiscal_operation.icms_rate_percent}%`
                                                                                                        : '-'}
                                                                                                </div>
                                                                                            </div>
                                                                                            <div>
                                                                                                <div className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">Redução BC (%)</div>
                                                                                                <div className="font-mono text-slate-700">
                                                                                                    {item.fiscal_operation?.icms_reduction_bc_percent !== null && item.fiscal_operation?.icms_reduction_bc_percent !== undefined
                                                                                                        ? `${item.fiscal_operation.icms_reduction_bc_percent}%`
                                                                                                        : '-'}
                                                                                                </div>
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
                                                                                                    {item.fiscal_operation?.st_mva_percent !== null && item.fiscal_operation?.st_mva_percent !== undefined
                                                                                                        ? `${item.fiscal_operation.st_mva_percent}%`
                                                                                                        : (item.fiscal_operation?.st_rate_percent !== null && item.fiscal_operation?.st_rate_percent !== undefined
                                                                                                            ? `${item.fiscal_operation.st_rate_percent}%`
                                                                                                            : (item.st_aliquot ? `${item.st_aliquot}%` : '-'))}
                                                                                                </div>
                                                                                            </div>
                                                                                            <div>
                                                                                                <div className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">Redução Base ST (%)</div>
                                                                                                <div className="font-mono text-slate-700">
                                                                                                    {item.fiscal_operation?.st_reduction_bc_percent !== null && item.fiscal_operation?.st_reduction_bc_percent !== undefined
                                                                                                        ? `${item.fiscal_operation.st_reduction_bc_percent}%`
                                                                                                        : '-'}
                                                                                                </div>
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
                                                                            </Card>

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

                                                                                <div className="text-xs text-muted-foreground mt-2 border-t pt-2">
                                                                                    <p className="font-medium text-[10px] uppercase tracking-wider mb-1">Dados Fiscais (Simulação)</p>
                                                                                    {(() => {
                                                                                        interface FiscalCompany { tax_regime?: string; address_state?: string; addresses?: { state: string }[] }
                                                                                        interface FiscalClient { addresses?: { state: string }[]; icms_contributor?: boolean; is_final_consumer?: boolean }

                                                                                        const company = selectedCompany as unknown as FiscalCompany;
                                                                                        const client = formData.client as unknown as FiscalClient;
                                                                                        const companyState = company.address_state || company.addresses?.[0]?.state || 'SP';

                                                                                        return (
                                                                                            <>
                                                                                                Regra: {company.tax_regime === 'simples' ? 'SN' : 'RN'} |
                                                                                                {' '}Origem: {companyState} →
                                                                                                Dest: {formData.delivery_address_json?.state || client?.addresses?.[0]?.state || '?'} |
                                                                                                {' '}{client?.icms_contributor ? 'Contrib.' : 'Não Contrib.'} |
                                                                                                {' '}{client?.is_final_consumer ? 'Cons.Final' : 'Revenda'}
                                                                                            </>
                                                                                        );
                                                                                    })()}
                                                                                </div>
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
                                </Card>

                                {/* --- BLOCK C: FINALIZAÇÃO --- */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <Card className="border-gray-100/70 p-6 space-y-3">
                                        <Label className="text-gray-900 font-medium flex items-center gap-2">
                                            <Edit2 className="w-3 h-3 text-gray-400" /> Observações Internas
                                        </Label>
                                        <Textarea
                                            placeholder="Anote detalhes importantes para a equipe..."
                                            className="bg-gray-50 border-gray-200 h-24 resize-none focus:bg-white transition-colors"
                                            value={formData.internal_notes || ''}
                                            onChange={(e) => setFormData({ ...formData, internal_notes: e.target.value })}
                                        />
                                    </Card>
                                    <Card className="border-gray-100/70 p-6 space-y-3">
                                        <Label className="text-gray-900 font-medium flex items-center gap-2">
                                            <Printer className="w-3 h-3 text-gray-400" /> Observações para o Cliente
                                        </Label>
                                        <Textarea
                                            placeholder="Estas informações sairão na impressão do pedido..."
                                            className="bg-gray-50 border-gray-200 h-24 resize-none focus:bg-white transition-colors"
                                            value={formData.client_notes || ''}
                                            onChange={(e) => setFormData({ ...formData, client_notes: e.target.value })}
                                        />
                                    </Card>
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
                        <TabDelivery data={formData} onChange={handleFieldChange} disabled={isLocked} useDeliveriesModel={deliveriesEnabled} />
                    </TabsContent>
                </Tabs>
            </div>

            {/* Standard Confirm Dialogs */}
            <ConfirmDialogDesdobra
                open={confirmDialogOpen}
                onOpenChange={setConfirmDialogOpen}
                title="Confirmar Pedido"
                description={
                    <div className="space-y-2">
                        <p>O pedido será enviado para a logística.</p>
                        <ul className="list-disc list-inside text-sm text-gray-600">
                            <li>Financeiro será notificado (se houver pendências)</li>
                            <li>Estoque será reservado automaticamente</li>
                            <li>O pedido poderá ser roteirizado</li>
                        </ul>
                    </div>
                }
                confirmText="Confirmar Pedido"
                variant="success"
                onConfirm={executeConfirm}
                isLoading={isLoading}
            />

            <ConfirmDialogDesdobra
                open={cancelDialogOpen}
                onOpenChange={setCancelDialogOpen}
                title="Cancelar Pedido"
                description="O pedido será marcado como cancelado, mas permanecerá no histórico. O estoque reservado será liberado."
                confirmText="Sim, Cancelar"
                variant="danger"
                onConfirm={executeCancel}
                isLoading={isLoading}
            />



            <ConfirmDialogDesdobra
                open={deleteDraftOpen}
                onOpenChange={setDeleteDraftOpen}
                title="Excluir Rascunho"
                description="Tem certeza? O rascunho será excluído permanentemente."
                confirmText="Excluir"
                variant="danger"
                onConfirm={handleExecuteDeleteDraft}
                isLoading={isLoading}
            />


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

            <ConfirmDialogDesdobra
                open={dispatchConfirmOpen}
                onOpenChange={setDispatchConfirmOpen}
                title="Confirmação de Despacho"
                description="Confirma o despacho deste pedido?"
                onConfirm={onConfirmDispatch}
                isLoading={isLoading}
            />

            {/* Route Selection Modal */}
            {selectedCompany && (
                <RouteSelectionModal
                    open={routeModalOpen}
                    onOpenChange={setRouteModalOpen}
                    companyId={selectedCompany.id}
                    onConfirm={handleRouteSelected}
                />
            )}
        </div>
    );
}
