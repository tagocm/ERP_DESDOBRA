"use client";

import { useEffect, useState } from "react";
import { useCompany } from "@/contexts/CompanyContext";
import { createClient } from "@/lib/supabaseBrowser";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { Plus, Loader2, X } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";

interface StockItem {
    item_id: string;
    item_name: string;
    item_sku: string | null;
    item_type: string;
    uom: string;
    current_stock: number;
    avg_cost: number;
}

const ITEM_TYPES = [
    { value: 'raw_material', label: 'Matéria-Prima' },
    { value: 'packaging', label: 'Embalagem' },
    { value: 'wip', label: 'Semi-Acabado' },
    { value: 'finished_good', label: 'Produto Acabado' },
    { value: 'service', label: 'Serviço' }
];

export default function StockPage() {
    const { selectedCompany } = useCompany();
    const supabase = createClient();

    const [stock, setStock] = useState<StockItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [typeFilter, setTypeFilter] = useState<string>("all");
    const [showPurchaseModal, setShowPurchaseModal] = useState(false);
    const [selectedItem, setSelectedItem] = useState<StockItem | null>(null);

    // Purchase modal state
    const [purchaseForm, setPurchaseForm] = useState({
        qty: "",
        unit_cost: "",
        notes: ""
    });
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (selectedCompany) {
            fetchStock();
        }
    }, [selectedCompany, typeFilter]);

    const fetchStock = async () => {
        if (!selectedCompany) return;

        setIsLoading(true);
        try {
            // Get all items
            let itemsQuery = supabase
                .from('items')
                .select('*')
                .eq('company_id', selectedCompany.id)
                .eq('is_active', true)
                .is('deleted_at', null)
                .order('name', { ascending: true });

            if (typeFilter !== 'all') {
                itemsQuery = itemsQuery.eq('type', typeFilter);
            }

            const { data: items, error: itemsError } = await itemsQuery;
            if (itemsError) throw itemsError;

            // Get stock for each item
            const stockData = await Promise.all(
                (items || []).map(async (item) => {
                    const { data: movements } = await supabase
                        .from('inventory_movements')
                        .select('qty_in, qty_out')
                        .eq('company_id', selectedCompany.id)
                        .eq('item_id', item.id);

                    const currentStock = movements?.reduce((acc, mov) => acc + mov.qty_in - mov.qty_out, 0) || 0;

                    return {
                        item_id: item.id,
                        item_name: item.name,
                        item_sku: item.sku,
                        item_type: item.type,
                        uom: item.uom,
                        current_stock: currentStock,
                        avg_cost: item.avg_cost
                    };
                })
            );

            setStock(stockData);
        } catch (error) {
            console.error('Error fetching stock:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handlePurchaseIn = (item: StockItem) => {
        setSelectedItem(item);
        setPurchaseForm({ qty: "", unit_cost: "", notes: "" });
        setShowPurchaseModal(true);
    };

    const handleSubmitPurchase = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedCompany || !selectedItem) return;

        setIsSaving(true);
        try {
            const response = await fetch('/api/inventory/purchase-in', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    companyId: selectedCompany.id,
                    item_id: selectedItem.item_id,
                    qty: parseFloat(purchaseForm.qty),
                    unit_cost: parseFloat(purchaseForm.unit_cost),
                    notes: purchaseForm.notes || undefined
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Erro ao registrar entrada');
            }

            setShowPurchaseModal(false);
            fetchStock();
        } catch (error: any) {
            console.error('Error creating purchase:', error);
            alert(`Erro: ${error.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    const getTypeLabel = (type: string) => {
        return ITEM_TYPES.find(t => t.value === type)?.label || type;
    };

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <PageHeader
                title="Estoque"
                subtitle="Controle de estoque e movimentações"
            />

            <div className="mb-6 flex gap-4">
                <div className="w-64">
                    <Select
                        value={typeFilter}
                        onValueChange={(val: string) => setTypeFilter(val)}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Todos os tipos" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todos os tipos</SelectItem>
                            {ITEM_TYPES.map(type => (
                                <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SKU</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Estoque Atual</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Custo Médio</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Valor Total</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {isLoading ? (
                            <tr>
                                <td colSpan={7} className="px-6 py-12 text-center">
                                    <Loader2 className="w-8 h-8 animate-spin text-brand-600 mx-auto" />
                                </td>
                            </tr>
                        ) : stock.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="px-6 py-12 text-center text-gray-500">Nenhum item encontrado</td>
                            </tr>
                        ) : (
                            stock.map((item) => (
                                <tr key={item.item_id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-600">{item.item_sku || '-'}</td>
                                    <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm font-medium text-gray-900">{item.item_name}</div></td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{getTypeLabel(item.item_type)}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                                        <span className="font-medium text-gray-900">{item.current_stock.toFixed(2)}</span>
                                        <span className="text-gray-500 ml-1">{item.uom}</span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">R$ {item.avg_cost.toFixed(2)}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900">R$ {(item.current_stock * item.avg_cost).toFixed(2)}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                                        <Button size="sm" variant="secondary" onClick={() => handlePurchaseIn(item)}>
                                            <Plus className="w-4 h-4 mr-1" /> Entrada
                                        </Button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {showPurchaseModal && selectedItem && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold">Entrada de Compra</h2>
                            <button onClick={() => setShowPurchaseModal(false)} className="text-gray-400 hover:text-gray-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="mb-4 p-3 bg-gray-50 rounded">
                            <p className="text-sm text-gray-600">Item</p>
                            <p className="font-medium">{selectedItem.item_name}</p>
                            <p className="text-xs text-gray-500 mt-1">Estoque atual: {selectedItem.current_stock.toFixed(2)} {selectedItem.uom}</p>
                        </div>

                        <form onSubmit={handleSubmitPurchase} className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Quantidade *</label>
                                <Input type="number" step="0.01" value={purchaseForm.qty} onChange={(e) => setPurchaseForm(prev => ({ ...prev, qty: e.target.value }))} required placeholder="0.00" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Custo Unitário (R$) *</label>
                                <Input type="number" step="0.01" value={purchaseForm.unit_cost} onChange={(e) => setPurchaseForm(prev => ({ ...prev, unit_cost: e.target.value }))} required placeholder="0.00" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Observações</label>
                                <Input value={purchaseForm.notes} onChange={(e) => setPurchaseForm(prev => ({ ...prev, notes: e.target.value }))} placeholder="Ex: Compra fornecedor X" />
                            </div>
                            {purchaseForm.qty && purchaseForm.unit_cost && (
                                <div className="p-3 bg-blue-50 rounded">
                                    <p className="text-sm text-blue-900"><strong>Custo Total:</strong> R$ {(parseFloat(purchaseForm.qty) * parseFloat(purchaseForm.unit_cost)).toFixed(2)}</p>
                                </div>
                            )}
                            <div className="flex gap-3 justify-end pt-4">
                                <Button type="button" variant="ghost" onClick={() => setShowPurchaseModal(false)}>Cancelar</Button>
                                <Button type="submit" disabled={isSaving}>
                                    {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Registrar Entrada
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
