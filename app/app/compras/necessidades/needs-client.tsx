'use client';

import React, { useState } from 'react';
import { addDays, format } from 'date-fns';
import { DateRange } from 'react-day-picker';
import { Search, Loader2, Plus, Filter, AlertCircle, ShoppingBag, Factory } from 'lucide-react';

import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { DateRangeFilter } from '@/components/ui/date-range-filter';
import { Checkbox } from '@/components/ui/Checkbox';
import { Badge } from '@/components/ui/Badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Label } from '@/components/ui/Label';
import { Separator } from '@/components/ui/Separator';

import { PurchaseNeedItem } from '@/lib/purchases/needs-service';
import { fetchPurchaseNeedsAction } from './actions';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/utils';

import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/use-toast';
import { createPurchaseOrderAction } from '@/app/actions/purchases';

export default function PurchaseNeedsClient({ companyId }: { companyId: string }) {
    const router = useRouter();
    const { toast } = useToast();

    // Filters
    const [dateRange, setDateRange] = useState<DateRange | undefined>({
        from: new Date(),
        to: addDays(new Date(), 7),
    });
    const [includeRaw, setIncludeRaw] = useState(true);
    const [includePackaging, setIncludePackaging] = useState(true);
    const [hideFulfilled, setHideFulfilled] = useState(true);

    // Data State
    const [data, setData] = useState<PurchaseNeedItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);

    // Selection State
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [isCreatingPO, setIsCreatingPO] = useState(false);

    const handleCalculate = async () => {
        if (!dateRange?.from || !dateRange?.to) {
            toast({ title: "Selecione um período", variant: "destructive" });
            return;
        }

        setLoading(true);
        setHasSearched(true);
        setSelectedIds([]); // Reset selection on new search
        try {
            const result = await fetchPurchaseNeedsAction({
                companyId,
                startDate: dateRange.from,
                endDate: dateRange.to,
                includeRaw,
                includePackaging,
            });

            if (result.error) {
                console.error(result.error);
                toast({ title: "Erro ao calcular", description: result.error, variant: "destructive" });
            } else {
                setData(result.data);
            }
        } catch (error) {
            console.error(error);
            toast({ title: "Erro de conexão", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    // Derived State
    const filteredData = data.filter(item => {
        if (hideFulfilled) {
            return item.purchase_suggestion > 0;
        }
        return true;
    });

    // Selection Handlers
    const toggleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedIds(filteredData.map(i => i.item_id));
        } else {
            setSelectedIds([]);
        }
    };

    const toggleSelect = (id: string, checked: boolean) => {
        if (checked) {
            setSelectedIds(prev => [...prev, id]);
        } else {
            setSelectedIds(prev => prev.filter(x => x !== id));
        }
    };

    const handleCreatePO = async () => {
        if (selectedIds.length === 0) return;

        setIsCreatingPO(true);
        try {
            const itemsToAdd = filteredData.filter(i => selectedIds.includes(i.item_id));

            // Map to PO Item structure
            const poItems = itemsToAdd.map(item => ({
                item_id: item.item_id,
                qty_display: item.purchase_suggestion || 0,
                uom_label: item.uom,
                conversion_factor: 1, // Default, will refine in PO if needed
                unit_cost: 0, // Unknown at this stage
                notes: `Origem: PCP (Projeção)`
            }));

            const { data: newPO } = await createPurchaseOrderAction({
                items: poItems,
                notes: `Gerado automaticamente via Necessidades PCP em ${format(new Date(), 'dd/MM/yyyy HH:mm')}`
            });

            // @ts-ignore
            if (newPO?.id) {
                toast({ title: "Pedido criado!", description: "Redirecionando para edição..." });
                // @ts-ignore
                router.push(`/app/compras/pedidos/${newPO.id}`);
            }
        } catch (err: any) {
            console.error(err);
            toast({ title: "Erro ao criar pedido", description: err.message, variant: "destructive" });
            setIsCreatingPO(false);
        }
    };

    return (
        <div className="space-y-6">
            <PageHeader
                title="Necessidades de Compra"
                subtitle="Cálculo automático baseado no plano de produção e estoque disponível."
                actions={
                    <div className="flex items-center gap-2">
                        {selectedIds.length > 0 && (
                            <Button
                                onClick={handleCreatePO}
                                disabled={isCreatingPO}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm animate-in fade-in zoom-in-95 duration-200"
                            >
                                {isCreatingPO ? (
                                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                ) : (
                                    <ShoppingBag className="w-4 h-4 mr-2" />
                                )}
                                Gerar Pedido ({selectedIds.length})
                            </Button>
                        )}
                    </div>
                }
            />

            <div className="px-6 space-y-6">
                {/* FILTERS CARD */}
                <Card className="rounded-2xl border-0 shadow-card ring-1 ring-gray-100/70 overflow-hidden bg-white">
                    <div className="px-6 py-4 bg-gray-50/50 border-b border-gray-100 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                            <Filter className="w-4 h-4 text-brand-600" />
                            Parâmetros de Cálculo
                        </div>
                    </div>
                    <CardContent className="p-6">
                        <div className="flex flex-wrap items-end gap-6">
                            <div className="space-y-2 min-w-[280px]">
                                <Label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5 mb-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-brand-500"></span>
                                    Período de Análise
                                </Label>
                                <DateRangeFilter
                                    date={dateRange}
                                    onDateChange={setDateRange}
                                    placeholder="Selecione o período"
                                    className="w-full h-11 border-gray-200 focus:ring-brand-500 focus:border-brand-500 rounded-lg shadow-sm"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5 mb-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-brand-500"></span>
                                    Tipos de Item
                                </Label>
                                <div className="flex items-center gap-2 h-11 px-4 rounded-lg border border-gray-200 bg-gray-50/30 hover:bg-gray-50/80 transition-colors shadow-sm">
                                    <div className="flex items-center gap-2">
                                        <Checkbox
                                            id="chk-raw"
                                            checked={includeRaw}
                                            onCheckedChange={setIncludeRaw}
                                            className="border-gray-300 data-[state=checked]:bg-brand-600 data-[state=checked]:border-brand-600 w-4 h-4"
                                        />
                                        <Label htmlFor="chk-raw" className="text-sm font-medium text-gray-700 cursor-pointer">Matéria-prima</Label>
                                    </div>
                                    <div className="w-px h-5 bg-gray-300 mx-3" />
                                    <div className="flex items-center gap-2">
                                        <Checkbox
                                            id="chk-pack"
                                            checked={includePackaging}
                                            onCheckedChange={setIncludePackaging}
                                            className="border-gray-300 data-[state=checked]:bg-brand-600 data-[state=checked]:border-brand-600 w-4 h-4"
                                        />
                                        <Label htmlFor="chk-pack" className="text-sm font-medium text-gray-700 cursor-pointer">Embalagens</Label>
                                    </div>
                                </div>
                            </div>

                            <div className="flex-1" />

                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 border border-transparent hover:border-gray-200 transition-all">
                                    <Checkbox
                                        id="chk-hide"
                                        checked={hideFulfilled}
                                        onCheckedChange={setHideFulfilled}
                                        className="border-gray-300 data-[state=checked]:bg-brand-600 data-[state=checked]:border-brand-600"
                                    />
                                    <Label htmlFor="chk-hide" className="text-sm font-medium text-gray-600 cursor-pointer">
                                        Ocultar sem falta
                                    </Label>
                                </div>

                                <Button
                                    onClick={handleCalculate}
                                    disabled={loading}
                                    className="h-11 px-8 font-bold shadow-sm"
                                >
                                    {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Factory className="w-4 h-4 mr-2" />}
                                    CALCULAR
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* RESULTS AREA */}
                {!hasSearched ? (
                    <div className="flex flex-col items-center justify-center py-24 bg-white rounded-2xl border border-dashed border-gray-300 shadow-sm animate-in fade-in zoom-in-95 duration-500">
                        <div className="bg-brand-50 p-4 rounded-full shadow-inner mb-4">
                            <Search className="w-8 h-8 text-brand-400" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900">Aguardando Cálculo</h3>
                        <p className="text-gray-500 max-w-sm text-center mt-2 leading-relaxed">
                            Defina os parâmetros acima e clique em <strong>Calcular</strong> para visualizar as sugestões de compra baseadas na demanda.
                        </p>
                    </div>
                ) : (
                    <Card className="rounded-2xl border-0 shadow-card ring-1 ring-gray-100/70 overflow-hidden bg-white animate-in slide-in-from-bottom-4 duration-500">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs font-semibold text-gray-500 uppercase bg-gray-50/80 border-b border-gray-100">
                                    <tr>
                                        <th className="px-4 py-4 w-12 text-center">
                                            <Checkbox
                                                checked={filteredData.length > 0 && selectedIds.length === filteredData.length}
                                                onCheckedChange={(c) => toggleSelectAll(!!c)}
                                                className="border-gray-300 data-[state=checked]:bg-brand-600"
                                            />
                                        </th>
                                        <th className="px-6 py-4">Item / SKU</th>
                                        <th className="px-6 py-4 text-center">Tipo</th>
                                        <th className="px-6 py-4 text-right group cursor-help relative">
                                            Estoque
                                        </th>
                                        <th className="px-6 py-4 text-right text-brand-600">
                                            Consumo (Prev)
                                        </th>
                                        <th className="px-6 py-4 text-right">
                                            Saldo Final
                                        </th>
                                        <th className="px-6 py-4 text-right text-gray-400">
                                            Ponto Pedido
                                        </th>
                                        <th className="px-6 py-4 text-right bg-brand-50/50 text-brand-800 border-l border-brand-100">
                                            Sugestão
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {filteredData.length === 0 ? (
                                        <tr>
                                            <td colSpan={8} className="px-6 py-16 text-center">
                                                <div className="flex flex-col items-center justify-center text-gray-400">
                                                    <AlertCircle className="w-10 h-10 mb-2 opacity-20" />
                                                    <p className="font-medium">Nenhum item com necessidade de compra encontrado.</p>
                                                    <p className="text-xs mt-1 opacity-70">Tente ajustar os filtros ou verificar se há OPs no período.</p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredData.map((item) => {
                                            const isStockNegative = item.stock_projected < 0;
                                            const hasSuggestion = item.purchase_suggestion > 0;
                                            const isSelected = selectedIds.includes(item.item_id);

                                            return (
                                                <tr
                                                    key={item.item_id}
                                                    className={cn(
                                                        "group transition-all duration-200 hover:bg-gray-50/80",
                                                        isSelected && "bg-blue-50/40 hover:bg-blue-50/60"
                                                    )}
                                                >
                                                    <td className="px-4 py-3 text-center">
                                                        <Checkbox
                                                            checked={isSelected}
                                                            onCheckedChange={(c) => toggleSelect(item.item_id, !!c)}
                                                            className="border-gray-300 data-[state=checked]:bg-brand-600"
                                                        />
                                                    </td>
                                                    <td className="px-6 py-3 max-w-[320px]">
                                                        <div className="font-semibold text-gray-800 truncate" title={item.item_name}>
                                                            {item.item_name}
                                                        </div>
                                                        <div className="text-[11px] text-gray-400 flex items-center gap-2 mt-0.5 font-medium tracking-wide">
                                                            <span>{item.item_sku}</span>
                                                            <span className="w-1 h-1 rounded-full bg-gray-300" />
                                                            <span className='text-gray-500 uppercase'>
                                                                {item.uom}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-3 text-center">
                                                        {item.item_type === 'raw_material' ? (
                                                            <Badge variant="secondary" className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100 font-semibold shadow-sm">Matéria-prima</Badge>
                                                        ) : item.item_type === 'packaging' ? (
                                                            <Badge variant="secondary" className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-100 font-semibold shadow-sm">Embalagem</Badge>
                                                        ) : (
                                                            <Badge variant="outline" className="px-2 py-0.5 font-medium">{item.item_type}</Badge>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-3 text-right">
                                                        <span className="font-semibold text-gray-700">{item.stock_current.toLocaleString('pt-BR', { maximumFractionDigits: 3 })}</span>
                                                    </td>
                                                    <td className="px-6 py-3 text-right">
                                                        <span className="font-medium text-brand-600">
                                                            {item.consumption_forecast > 0 ? '-' : ''}{item.consumption_forecast.toLocaleString('pt-BR', { maximumFractionDigits: 3 })}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-3 text-right">
                                                        <div className={cn(
                                                            "font-bold inline-flex items-center justify-end px-2 py-0.5 rounded-md min-w-[60px]",
                                                            isStockNegative ? "bg-red-50 text-red-700" : "text-gray-700"
                                                        )}>
                                                            {item.stock_projected.toLocaleString('pt-BR', { maximumFractionDigits: 3 })}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-3 text-right">
                                                        <div className="flex flex-col items-end text-xs text-gray-400 font-medium">
                                                            <span title="Estoque Mínimo">Min: {item.stock_min}</span>
                                                            {item.reorder_point !== null && (
                                                                <span title="Ponto de Reposição">PR: {item.reorder_point}</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className={cn(
                                                        "px-6 py-3 text-right border-l border-brand-50",
                                                        hasSuggestion ? "bg-brand-50/30" : ""
                                                    )}>
                                                        {item.purchase_suggestion > 0 ? (
                                                            <span className="inline-block font-extrabold text-brand-700 text-lg tracking-tight">
                                                                {item.purchase_suggestion.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} <span className="text-xs font-normal text-brand-500 ml-0.5">{item.uom}</span>
                                                            </span>
                                                        ) : (
                                                            <span className="text-gray-300 text-sm">-</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                )}
            </div>
        </div>
    );
}

