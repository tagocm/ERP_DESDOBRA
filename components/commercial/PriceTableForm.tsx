"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/use-toast";
import { useCompany } from "@/contexts/CompanyContext";
import { createClient } from "@/lib/supabaseBrowser";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardContent } from "@/components/ui/Card";
import { CardHeaderStandard } from "@/components/ui/CardHeaderStandard";
import { PageHeader } from "@/components/ui/PageHeader";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/Dialog";
import { Loader2, ChevronDown, ChevronRight, Save, Copy, Search, X, Tag, DollarSign, AlertTriangle } from "lucide-react";
import { PriceTable, PriceTableItem, getSellableItems, upsertPriceTable, upsertPriceTableItems, getPriceTableItems, duplicatePriceTable } from "@/lib/price-tables";
import { format } from "date-fns";
import { DecimalInput } from "@/components/ui/DecimalInput";

interface Product {
    id: string;
    name: string;
    sku: string | null;
    uom: string;
    line: string | null;
    brand: string | null;
    type: string;
    avg_cost: number | null; // Added for reference
    category?: { name: string };
}

interface PriceTableFormProps {
    initialData?: PriceTable;
    isEdit?: boolean;
}

export function PriceTableForm({ initialData, isEdit }: PriceTableFormProps) {
    const router = useRouter();
    const { selectedCompany } = useCompany();
    const supabase = createClient();
    const { toast } = useToast();

    // -- State --
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // Form Data
    const [formData, setFormData] = useState<Partial<PriceTable>>({
        name: '',
        effective_date: format(new Date(), 'yyyy-MM-dd'),
        commission_pct: null,
        freight_included: false,
        min_order_value: null,
        is_active: true,
        internal_notes: '',
        // Cleaned up removed fields from UI state
    });

    // Items & Prices
    const [products, setProducts] = useState<Product[]>([]);
    const [prices, setPrices] = useState<Record<string, number | null>>({}); // itemId -> price

    // UI Logic
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState<'all' | 'with_price' | 'missing_price'>('all');

    // Validation / Modal
    const [missingPriceModalOpen, setMissingPriceModalOpen] = useState(false);
    const [pendingSaveAction, setPendingSaveAction] = useState<(() => void) | null>(null);

    // -- Derived State --
    const groupedProducts = useMemo(() => {
        const groups: Record<string, Product[]> = {};

        let filtered = products;

        // 1. Filter by Search
        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            filtered = filtered.filter(p =>
                p.name.toLowerCase().includes(lower) ||
                (p.sku && p.sku.toLowerCase().includes(lower))
            );
        }

        // 2. Filter by Price Status
        if (filterType === 'with_price') {
            filtered = filtered.filter(p => prices[p.id] !== null && prices[p.id] !== undefined && prices[p.id] !== 0);
        } else if (filterType === 'missing_price') {
            filtered = filtered.filter(p => prices[p.id] === null || prices[p.id] === undefined || String(prices[p.id]) === '');
        }

        // 3. Group
        filtered.forEach(p => {
            // Prioritize Category Name, then Line, then fallback.
            const groupName = p.category?.name || p.line || "Outros";
            if (!groups[groupName]) groups[groupName] = [];
            groups[groupName].push(p);
        });

        // Sort keys
        return Object.keys(groups).sort().reduce((acc, key) => {
            acc[key] = groups[key];
            return acc;
        }, {} as Record<string, Product[]>);
    }, [products, prices, searchTerm, filterType]);

    // -- Effects --

    useEffect(() => {
        if (!selectedCompany) return;

        const load = async () => {
            setIsLoading(true);
            try {
                // 1. Load Products (Sellable Items)
                const itemsData = await getSellableItems(supabase, selectedCompany.id);
                setProducts(itemsData as any[]);

                // 2. Load Existing Data (if Edit)
                if (initialData) {
                    setFormData({
                        ...initialData,
                        // Ensure defaults for optional fields if null in DB
                        commission_pct: initialData.commission_pct,
                        min_order_value: initialData.min_order_value,
                        internal_notes: initialData.internal_notes
                    });

                    // Load Prices
                    const existingItems = await getPriceTableItems(supabase, initialData.id);
                    const priceMap: Record<string, number | null> = {};
                    existingItems.forEach(item => {
                        priceMap[item.item_id] = item.price;
                    });
                    setPrices(priceMap);
                } else {
                    // Initialize empty
                    setFormData(prev => ({ ...prev, company_id: selectedCompany.id }));
                }

            } catch (err: any) {
                console.error(err);
                toast({ title: "Erro ao carregar dados", description: err.message, variant: "destructive" });
            } finally {
                setIsLoading(false);
            }
        };

        load();
    }, [selectedCompany, initialData, isEdit]);

    // -- Handlers --

    const handlePriceChange = (itemId: string, value: number | null) => {
        setPrices(prev => ({
            ...prev,
            [itemId]: value
        }));
    };

    const toggleGroup = (group: string) => {
        setExpandedGroups(prev => ({
            ...prev,
            [group]: !prev[group]
        }));
    };

    const handleSaveRequest = (saveAndNew = false) => {
        // Validation
        if (!formData.name || formData.name.trim().length < 3) {
            toast({ title: "Validação falhou", description: "Nome da tabela é obrigatório e deve ter 3+ caracteres.", variant: "destructive" });
            return;
        }

        // Check missing prices for SELLABLE items (all keys in products list)
        const missingCount = products.reduce((count, p) => {
            const price = prices[p.id];
            const isMissing = price === null || price === undefined || String(price) === '';
            return isMissing ? count + 1 : count;
        }, 0);

        const doSave = () => executeSave(saveAndNew);

        if (missingCount > 0) {
            setPendingSaveAction(() => doSave);
            setMissingPriceModalOpen(true);
        } else {
            doSave();
        }
    };

    const executeSave = async (saveAndNew: boolean) => {
        setIsSaving(true);
        try {
            // Validate company selection (CRITICAL FOR RLS)
            if (!selectedCompany) {
                throw new Error("Nenhuma empresa selecionada. Selecione uma empresa no menu superior.");
            }

            // 1. Upsert Table - Build payload explicitly (no spread to avoid company_id bug)
            const tablePayload: Partial<PriceTable> = {
                company_id: selectedCompany.id,
                name: formData.name!,
                effective_date: formData.effective_date!,
                commission_pct: formData.commission_pct,
                freight_included: formData.freight_included!,
                min_order_value: formData.min_order_value,
                is_active: formData.is_active!,
                internal_notes: formData.internal_notes,
                valid_from: null,
                valid_to: null,
                states: [],
                customer_profiles: [],
            };

            // Include ID only if editing
            if (isEdit && initialData?.id) {
                tablePayload.id = initialData.id;
            }

            console.log('[PriceTableForm] Payload BEFORE upsert:', {
                payload: tablePayload,
                hasCompanyId: !!tablePayload.company_id,
                companyIdValue: tablePayload.company_id,
                payloadKeys: Object.keys(tablePayload)
            });

            const savedTable = await upsertPriceTable(supabase, tablePayload);

            // 2. Upsert Items
            const itemsPayload = products.map(p => ({
                price_table_id: savedTable.id,
                item_id: p.id,
                price: prices[p.id] === undefined ? null : prices[p.id]
            }));

            await upsertPriceTableItems(supabase, itemsPayload);

            if (saveAndNew) {
                window.location.href = '/app/cadastros/tabelas-de-preco/nova';
            } else {
                router.push('/app/cadastros/tabelas-de-preco');
            }

        } catch (err: any) {
            console.error(err);
            toast({ title: "Erro ao salvar tabela de preços", description: err.message, variant: "destructive" });
            setIsSaving(false);
        }
    };

    const handleDuplicate = async () => {
        if (!isEdit || !initialData) return;
        if (!confirm("Duplicar esta tabela?")) return;
        try {
            setIsLoading(true);
            const newTable = await duplicatePriceTable(supabase, initialData.id);
            router.push(`/app/cadastros/tabelas-de-preco/${newTable.id}`);
        } catch (err: any) {
            console.error(err);
            toast({ title: "Erro ao duplicar tabela", description: err.message, variant: "destructive" });
            setIsLoading(false);
        }
    };

    if (isLoading) {
        return <div className="flex h-96 items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>;
    }

    return (
        <div>
            <PageHeader
                title={isEdit ? (initialData?.name || "Editar Tabela") : "Nova Tabela de Preços"}
                subtitle="Defina tabelas de preços para seus produtos."
                actions={
                    <div className="flex gap-2">
                        <Button variant="secondary" onClick={() => router.back()}>Cancelar</Button>
                        {!isEdit && (
                            <Button variant="secondary" onClick={() => handleSaveRequest(true)} disabled={isSaving}>
                                Salvar e Novo
                            </Button>
                        )}
                        <Button onClick={() => handleSaveRequest(false)} disabled={isSaving}>
                            {isSaving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                            Salvar
                        </Button>
                        {isEdit && (
                            <Button variant="secondary" onClick={handleDuplicate} disabled={isSaving}>
                                <Copy className="w-4 h-4 mr-2" />
                                Duplicar
                            </Button>
                        )}
                    </div>
                }
            />

            <div className="container mx-auto max-w-[1600px] px-6 pb-8 space-y-6">

                {/* CARD A: GERAL */}
                <Card>
                    <CardHeaderStandard
                        icon={<Tag className="w-5 h-5" />}
                        title="Informações Gerais"
                    />
                    <CardContent className="space-y-6">
                        <div className="grid grid-cols-12 gap-6">
                            <div className="col-span-12 md:col-span-8">
                                <label className="text-sm font-medium text-gray-700">Nome da Tabela <span className="text-red-500">*</span></label>
                                <Input
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="Ex: Tabela Varejo 2025"
                                    className="mt-1"
                                />
                            </div>
                            <div className="col-span-12 md:col-span-4">
                                <label className="text-sm font-medium text-gray-700">Data Efetiva</label>
                                <Input
                                    type="date"
                                    value={formData.effective_date}
                                    onChange={e => setFormData({ ...formData, effective_date: e.target.value })}
                                    className="mt-1"
                                />
                            </div>

                            <div className="col-span-6 md:col-span-3">
                                <label className="text-sm font-medium text-gray-700">Comissão (%)</label>
                                <DecimalInput
                                    placeholder="0,00"
                                    value={formData.commission_pct}
                                    onChange={val => setFormData({ ...formData, commission_pct: val })}
                                    className="mt-1"
                                    precision={2}
                                />
                            </div>
                            <div className="col-span-6 md:col-span-3">
                                <label className="text-sm font-medium text-gray-700">Mínimo por pedido (R$)</label>
                                <DecimalInput
                                    placeholder="0,00"
                                    value={formData.min_order_value}
                                    onChange={val => setFormData({ ...formData, min_order_value: val })}
                                    className="mt-1"
                                    precision={2}
                                />
                            </div>
                            <div className="col-span-6 md:col-span-3 flex items-center pt-6">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={formData.is_active}
                                        onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                                        className="w-4 h-4 text-brand-600 rounded border-gray-300 focus:ring-brand-500"
                                    />
                                    <span className="text-sm font-medium text-gray-900">Tabela Ativa</span>
                                </label>
                            </div>
                            <div className="col-span-6 md:col-span-3 flex items-center pt-6">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={formData.freight_included}
                                        onChange={e => setFormData({ ...formData, freight_included: e.target.checked })}
                                        className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 border-gray-300"
                                    />
                                    <span className="text-sm font-medium text-gray-900">Frete incluso (CIF)</span>
                                </label>
                            </div>

                            <div className="col-span-12">
                                <label className="text-sm font-medium text-gray-700">Observações Internas</label>
                                <Input
                                    value={formData.internal_notes || ''}
                                    onChange={e => setFormData({ ...formData, internal_notes: e.target.value })}
                                    placeholder="Opcional"
                                    className="mt-1"
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* CARD B: ITEMS & PRICES */}
                <Card className="flex flex-col">
                    <CardHeaderStandard
                        icon={<DollarSign className="w-5 h-5" />}
                        title="Itens e Preços"
                        actions={
                            <div className="flex flex-wrap items-center gap-3">
                                <div className="relative">
                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                                    <Input
                                        placeholder="Filtrar itens..."
                                        className="h-9 pl-8 w-[200px]"
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                    />
                                </div>
                                <select
                                    className="h-9 rounded-md border border-gray-300 bg-white px-3 py-1 text-sm focus-visible:outline-none"
                                    value={filterType}
                                    onChange={(e) => setFilterType(e.target.value as any)}
                                >
                                    <option value="all">Todos os itens</option>
                                    <option value="missing_price">Sem preço definido</option>
                                    <option value="with_price">Com preço definido</option>
                                </select>
                            </div>
                        }
                    />

                    {/* Content List */}
                    <div className="p-0">
                        {Object.keys(groupedProducts).length === 0 ? (
                            <div className="p-12 text-center text-gray-500">
                                Nenhum item encontrado para os filtros.
                            </div>
                        ) : (
                            Object.entries(groupedProducts).map(([groupName, items]) => {
                                const isExpanded = expandedGroups[groupName];
                                const pricesCount = items.filter(i => prices[i.id] !== null && prices[i.id] !== undefined && String(prices[i.id]) !== '').length;
                                const totalCount = items.length;

                                return (
                                    <div key={groupName} className="border-b border-gray-100 last:border-0">
                                        {/* Group Header */}
                                        <div
                                            className="flex items-center justify-between px-6 py-3 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                                            onClick={() => toggleGroup(groupName)}
                                        >
                                            <div className="flex items-center gap-2 font-medium text-sm text-gray-800">
                                                {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
                                                {groupName}
                                            </div>
                                            <div className="text-xs text-gray-500">
                                                {pricesCount} de {totalCount} com preço
                                            </div>
                                        </div>

                                        {/* Group Items (Collapsible) */}
                                        {isExpanded && (
                                            <div className="px-6 py-2 bg-white">
                                                <div className="grid grid-cols-12 gap-y-2 gap-x-4 mb-2 text-xs font-medium text-gray-500 uppercase border-b border-gray-100 pb-2">
                                                    <div className="col-span-6 md:col-span-7">Item / SKU</div>
                                                    <div className="col-span-2 md:col-span-1 text-center">Unid</div>
                                                    <div className="col-span-2 md:col-span-2 text-right">Custo (ref.)</div>
                                                    <div className="col-span-2 md:col-span-2 text-right">Preço (R$)</div>
                                                </div>

                                                <div className="space-y-1">
                                                    {items.map(product => (
                                                        <div key={product.id} className="grid grid-cols-12 gap-x-4 items-center py-1.5 hover:bg-gray-50 rounded px-2 -mx-2 transition-colors group">
                                                            <div className="col-span-6 md:col-span-7 break-words pr-2">
                                                                <div className="text-sm font-medium text-gray-900 leading-tight">{product.name}</div>
                                                                {product.sku && <div className="text-xs text-gray-500 font-mono mt-0.5">{product.sku}</div>}
                                                            </div>
                                                            <div className="col-span-2 md:col-span-1 text-center text-xs text-gray-500 bg-gray-50 rounded py-1 border border-gray-100">
                                                                {product.uom}
                                                            </div>
                                                            <div className="col-span-2 md:col-span-2 text-right text-xs text-gray-500">
                                                                {product.avg_cost
                                                                    ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(product.avg_cost)
                                                                    : <span className="opacity-50">—</span>
                                                                }
                                                            </div>
                                                            <div className="col-span-2 md:col-span-2 flex justify-end">
                                                                <DecimalInput
                                                                    placeholder="0,00"
                                                                    className="w-full text-right h-9 rounded-md border border-gray-200 bg-white px-3 py-1 text-sm shadow-sm transition-colors focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 group-hover:border-gray-300"
                                                                    value={prices[product.id]}
                                                                    onChange={(val) => handlePriceChange(product.id, val)}
                                                                />
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </Card>
            </div>

            {/* CONFIRMATION / MISSING PRICES MODAL */}
            <Dialog open={missingPriceModalOpen} onOpenChange={setMissingPriceModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-amber-600">
                            <AlertTriangle className="w-5 h-5" />
                            Atenção: Itens sem preço
                        </DialogTitle>
                        <DialogDescription className="pt-2">
                            Existem itens vendáveis nesta tabela que ainda não possuem preço definido (valor vazio).
                            <br /><br />
                            Isso fará com que esses itens fiquem sem preço nesta tabela.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="outline" onClick={() => setMissingPriceModalOpen(false)}>
                            Voltar e preencher
                        </Button>
                        <Button onClick={() => {
                            setMissingPriceModalOpen(false);
                            if (pendingSaveAction) pendingSaveAction();
                        }}>
                            Salvar mesmo assim
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
