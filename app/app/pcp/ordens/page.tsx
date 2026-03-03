"use client";

import { useEffect, useState } from "react";
import { useCompany } from "@/contexts/CompanyContext";
import { createClient } from "@/lib/supabaseBrowser";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardContent } from "@/components/ui/Card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { Plus, Loader2, CheckCircle, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { calculateRecipeCount, formatRecipeCountLabel } from "@/lib/pcp/work-order-metrics";

interface WorkOrder {
    id: string;
    document_number: number;
    item_id: string;
    planned_qty: number;
    produced_qty: number;
    status: string;
    created_at: string;
    parent_work_order_id: string | null;
    sector: {
        id: string;
        code: string;
        name: string;
    } | null;
    bom: {
        yield_qty: number;
        yield_uom: string;
    } | null;
    item?: {
        name: string;
        sku: string | null;
        uom: string;
    };
}

interface SectorOption {
    id: string;
    code: string;
    name: string;
}

interface WorkOrderQueryRow extends Omit<WorkOrder, "item" | "sector" | "bom"> {
    item?: WorkOrder["item"] | WorkOrder["item"][];
    sector: WorkOrder["sector"] | WorkOrder["sector"][];
    bom: WorkOrder["bom"] | WorkOrder["bom"][];
}

const STATUS_OPTIONS = [
    { value: 'all', label: 'Todos' },
    { value: 'planned', label: 'Planejada' },
    { value: 'in_progress', label: 'Em Andamento' },
    { value: 'done', label: 'Concluída' },
    { value: 'cancelled', label: 'Cancelada' }
];

export default function OrdensPage() {
    const { selectedCompany } = useCompany();
    const supabase = createClient();
    const router = useRouter();

    const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('all');
    const [sectorFilter, setSectorFilter] = useState('all');
    const [sectors, setSectors] = useState<SectorOption[]>([]);
    const [showFinishModal, setShowFinishModal] = useState(false);
    const [selectedWO, setSelectedWO] = useState<WorkOrder | null>(null);
    const [producedQty, setProducedQty] = useState("");
    const [isFinishing, setIsFinishing] = useState(false);

    useEffect(() => {
        if (selectedCompany) {
            fetchWorkOrders();
        }
    }, [selectedCompany, statusFilter, sectorFilter]);

    const fetchWorkOrders = async () => {
        if (!selectedCompany) return;

        setIsLoading(true);
        try {
            let query = supabase
                .from('work_orders')
                .select(`
                    *,
                    parent_work_order_id,
                    sector:production_sectors(id, code, name),
                    item:items!work_orders_item_id_fkey(name, sku, uom),
                    bom:bom_headers(yield_qty, yield_uom)
                `)
                .eq('company_id', selectedCompany.id)
                .is('deleted_at', null)
                .order('created_at', { ascending: false });

            if (statusFilter !== 'all') {
                query = query.eq('status', statusFilter);
            }

            if (sectorFilter !== 'all') {
                query = query.eq('sector_id', sectorFilter);
            }

            const [{ data, error }, { data: sectorsData, error: sectorsError }] = await Promise.all([
                query,
                supabase
                    .from('production_sectors')
                    .select('id, code, name')
                    .eq('company_id', selectedCompany.id)
                    .is('deleted_at', null)
                    .eq('is_active', true)
                    .order('name')
            ]);
            if (error) throw error;
            if (sectorsError) throw sectorsError;

            const mappedOrders = ((data || []) as WorkOrderQueryRow[]).map((row) => ({
                ...row,
                item: Array.isArray(row.item) ? row.item[0] : row.item,
                sector: Array.isArray(row.sector) ? row.sector[0] : row.sector,
                bom: Array.isArray(row.bom) ? row.bom[0] : row.bom,
            }));

            setWorkOrders(mappedOrders);
            setSectors((sectorsData || []) as SectorOption[]);
        } catch (error) {
            console.error('Error fetching work orders:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleFinish = (wo: WorkOrder) => {
        setSelectedWO(wo);
        setProducedQty(wo.planned_qty.toString());
        setShowFinishModal(true);
    };

    const handleSubmitFinish = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedCompany || !selectedWO) return;

        setIsFinishing(true);
        try {
            const response = await fetch(`/api/work-orders/${selectedWO.id}/finish`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    companyId: selectedCompany.id,
                    produced_qty: parseFloat(producedQty)
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Erro ao finalizar OP');
            }

            const result = await response.json();
            alert(`OP finalizada com sucesso!\nCusto total: R$ ${result.production_cost.total.toFixed(2)}\nCusto unitário: R$ ${result.production_cost.unit.toFixed(2)}`);

            setShowFinishModal(false);
            fetchWorkOrders();
        } catch (error: any) {
            console.error('Error finishing work order:', error);
            alert(`Erro: ${error.message}`);
        } finally {
            setIsFinishing(false);
        }
    };

    const getStatusBadge = (status: string) => {
        const colors = {
            planned: 'bg-blue-100 text-blue-800',
            in_progress: 'bg-yellow-100 text-yellow-800',
            done: 'bg-green-100 text-green-800',
            cancelled: 'bg-red-100 text-red-800'
        };
        const labels = {
            planned: 'Planejada',
            in_progress: 'Em Andamento',
            done: 'Concluída',
            cancelled: 'Cancelada'
        };
        return (
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800'}`}>
                {labels[status as keyof typeof labels] || status}
            </span>
        );
    };

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <PageHeader
                title="Ordens de Produção"
                subtitle="PCP > Ordens de Produção"
                actions={
                    <Button onClick={() => router.push("/app/pcp/ordens/novo")}>
                        <Plus className="w-4 h-4 mr-2" />
                        Nova OP
                    </Button>
                }
            />

            <div className="mb-6 flex gap-3">
                <Select
                    value={statusFilter}
                    onValueChange={setStatusFilter}
                >
                    <SelectTrigger className="w-64">
                        <SelectValue placeholder="Filtrar por status" />
                    </SelectTrigger>
                    <SelectContent>
                        {STATUS_OPTIONS.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Select value={sectorFilter} onValueChange={setSectorFilter}>
                    <SelectTrigger className="w-72">
                        <SelectValue placeholder="Filtrar por setor" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todos os setores</SelectItem>
                        {sectors.map((sector) => (
                            <SelectItem key={sector.id} value={sector.id}>
                                {sector.code} - {sector.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <Card className="overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Nº ID
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Produto
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Qtd Planejada
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Nº Receitas
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Qtd Produzida
                            </th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Status
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Setor
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Vínculo
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Data
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Ações
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {isLoading ? (
                            <tr>
                                <td colSpan={10} className="px-6 py-12 text-center">
                                    <Loader2 className="w-8 h-8 animate-spin text-brand-600 mx-auto" />
                                </td>
                            </tr>
                        ) : workOrders.length === 0 ? (
                            <tr>
                                <td colSpan={10} className="px-6 py-12 text-center text-gray-500">
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="text-4xl">🏭</div>
                                        <p className="text-lg font-medium">Nenhuma ordem de produção</p>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            workOrders.map((wo) => {
                                const idDisplay = wo.document_number
                                    ? `#${wo.document_number.toString().padStart(4, '0')}`
                                    : `#${wo.id.substring(0, 8)}`; // Fallback

                                return (
                                    <tr key={wo.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-500">
                                            {idDisplay}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-medium text-gray-900">
                                                {wo.item?.name}
                                            </div>
                                            {wo.item?.sku && (
                                                <div className="text-xs text-gray-500 font-mono">
                                                    {wo.item.sku}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                                            {wo.planned_qty} {wo.item?.uom}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                                            {formatRecipeCountLabel(calculateRecipeCount(wo.planned_qty, wo.bom?.yield_qty))}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                                            {wo.produced_qty} {wo.item?.uom}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            {getStatusBadge(wo.status)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                            {wo.sector ? `${wo.sector.code} - ${wo.sector.name}` : '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                            {wo.parent_work_order_id ? `Filha de #${wo.parent_work_order_id.slice(0, 8)}` : '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                            {new Date(wo.created_at).toLocaleDateString('pt-BR')}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                                            {(wo.status === 'planned' || wo.status === 'in_progress') && (
                                                <Button
                                                    size="sm"
                                                    onClick={() => handleFinish(wo)}
                                                >
                                                    <CheckCircle className="w-4 h-4 mr-1" />
                                                    Finalizar
                                                </Button>
                                            )}
                                        </td>
                                    </tr>
                                )
                            })
                        )}
                    </tbody>
                </table>
            </Card>

            {/* Finish Modal */}
            {showFinishModal && selectedWO && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <Card className="max-w-md w-full mx-4">
                        <CardContent className="p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold">Finalizar Ordem de Produção</h2>
                            <button
                                onClick={() => setShowFinishModal(false)}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="mb-4 p-3 bg-gray-50 rounded-2xl">
                            <p className="text-sm text-gray-600">Produto</p>
                            <p className="font-medium">{selectedWO.item?.name}</p>
                            <p className="text-xs text-gray-500 mt-1">
                                Planejado: {selectedWO.planned_qty} {selectedWO.item?.uom}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                                Receitas: {formatRecipeCountLabel(calculateRecipeCount(selectedWO.planned_qty, selectedWO.bom?.yield_qty))}
                            </p>
                        </div>

                        <form onSubmit={handleSubmitFinish} className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Quantidade Produzida *</label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={producedQty}
                                    onChange={(e) => setProducedQty(e.target.value)}
                                    required
                                    placeholder="0.00"
                                />
                            </div>

                            <div className="p-3 bg-yellow-50 rounded-2xl text-sm text-yellow-900">
                                <strong>Atenção:</strong> Ao finalizar, os componentes serão consumidos do estoque e o produto acabado será adicionado.
                            </div>

                            <div className="flex gap-3 justify-end pt-4">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={() => setShowFinishModal(false)}
                                >
                                    Cancelar
                                </Button>
                                <Button type="submit" disabled={isFinishing}>
                                    {isFinishing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                    Finalizar OP
                                </Button>
                            </div>
                        </form>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
