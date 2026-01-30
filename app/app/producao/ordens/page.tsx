"use client";

import { useCompany } from "@/contexts/CompanyContext";
import { createClient } from "@/lib/supabaseBrowser";
import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { CardHeaderStandard } from "@/components/ui/CardHeaderStandard";
import { ListFilter, Search, ArrowUpDown, Eye, Edit2, Play, CheckCircle2, AlertOctagon, Calendar, Trash2, XCircle } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/Select";
import { useToast } from "@/components/ui/use-toast";
import { deleteWorkOrderAction, changeWorkOrderStatusAction } from "@/app/actions/pcp-planning";

// Internal Component: New Work Order Modal
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/Dialog";
import { Label } from "@/components/ui/Label";
import { Textarea } from "@/components/ui/Textarea";

import { NewWorkOrderModal } from "@/components/pcp/NewWorkOrderModal";

// Types
interface WorkOrder {
    id: string;
    planned_qty: number;
    produced_qty: number;
    status: 'planned' | 'in_progress' | 'done' | 'cancelled';
    created_at: string;
    scheduled_date: string;
    item: {
        id: string;
        name: string;
        uom: string;
    };
    bom: {
        version: number;
    } | null;
}

export default function WorkOrdersPage() {
    const { selectedCompany } = useCompany();
    const supabase = createClient();
    const { toast } = useToast();

    const [orders, setOrders] = useState<WorkOrder[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");

    // ... (previous code)

    // Modal State
    const [isNewOrderOpen, setIsNewOrderOpen] = useState(false);

    // Status Change Modal
    const [statusModal, setStatusModal] = useState<{
        isOpen: boolean;
        order: WorkOrder | null;
        newStatus: string;
        reasonRequired: boolean;
    }>({ isOpen: false, order: null, newStatus: "", reasonRequired: false });

    // Delete Confirmation Modal
    const [deleteModal, setDeleteModal] = useState<{
        isOpen: boolean;
        order: WorkOrder | null;
    }>({ isOpen: false, order: null });

    // Negative Stock Confirmation Modal
    const [negativeStockModal, setNegativeStockModal] = useState<{
        isOpen: boolean;
        items: any[];
        orderId: string | null;
        newStatus: string | null;
        originalReason?: string;
    }>({ isOpen: false, items: [], orderId: null, newStatus: null });

    useEffect(() => {
        if (selectedCompany) fetchOrders();
    }, [selectedCompany, statusFilter]);

    const fetchOrders = async () => {
        setIsLoading(true);
        try {
            let query = supabase
                .from('work_orders')
                .select(`
                    id,
                    planned_qty,
                    produced_qty,
                    status,
                    created_at,
                    scheduled_date,
                    item:items!inner (id, name, uom),
                    bom:bom_headers (version)
                `)
                .eq('company_id', selectedCompany!.id)
                .is('deleted_at', null)
                .order('created_at', { ascending: false });

            if (statusFilter !== 'all') {
                query = query.eq('status', statusFilter);
            }

            const { data, error } = await query;

            if (error) throw error;

            // Map data to ensure types match (Supabase returns arrays for relations sometimes)
            const mappedOrders: WorkOrder[] = (data || []).map((o: any) => ({
                ...o,
                item: Array.isArray(o.item) ? o.item[0] : o.item,
                bom: Array.isArray(o.bom) ? o.bom[0] : o.bom
            }));

            setOrders(mappedOrders);

        } catch (error) {
            console.error("Error fetching work orders:", error);
            toast({ title: "Erro", description: "Falha ao carregar ordens de produção.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    const statusBadge = (status: string) => {
        const styles: Record<string, string> = {
            planned: "bg-gray-100 text-gray-700 ring-gray-600/20",
            in_progress: "bg-blue-50 text-blue-700 ring-blue-700/10",
            done: "bg-green-50 text-green-700 ring-green-600/20",
            cancelled: "bg-red-50 text-red-700 ring-red-600/10"
        };
        const labels: Record<string, string> = {
            planned: "Planejada",
            in_progress: "Em Produção",
            done: "Concluída",
            cancelled: "Cancelada"
        };
        return (
            <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${styles[status]}`}>
                {labels[status] || status}
            </span>
        );
    };

    const handleDeleteClick = (order: WorkOrder) => {
        setDeleteModal({ isOpen: true, order });
    };

    const confirmDelete = async () => {
        if (!deleteModal.order) return;

        try {
            await deleteWorkOrderAction(deleteModal.order.id);
            toast({ title: "Sucesso", description: "Ordem de produção excluída.", variant: "default" });
            // Remove from local state
            setOrders(prev => prev.filter(o => o.id !== deleteModal.order!.id));
            setDeleteModal({ isOpen: false, order: null });
        } catch (error: any) {
            console.error(error);
            toast({
                title: "Erro",
                description: error.message || "Erro ao excluir ordem.",
                variant: "destructive"
            });
        }
    };

    const handleStatusTransition = async (order: WorkOrder, newStatus: string) => {
        // Validation Logic for Reason Requirement
        let requireReason = false;

        if (newStatus === 'done' && order.planned_qty !== order.produced_qty) {
            requireReason = true;
        }

        // Always open modal for critical actions (Cancel or Done with reason)
        // For simple transitions like Start (planned -> in_progress), we can skip if desired, 
        // but for consistency let's require confirmation for Cancel too.

        if (requireReason || newStatus === 'cancelled') {
            setStatusModal({ isOpen: true, order, newStatus, reasonRequired: requireReason });
        } else {
            // Direct execution for non-critical (Start) or straightforward Done (exact match)
            // Actually, maybe we should confirm "Start" too? The user didn't complain about that.
            // Let's stick to the prompt: User complained about "Cancel" prompt style.

            // For Done (Exact Match), previous logic didn't confirm. Should we?
            // "Confirmar a alteração de status?" is in the modal.
            // Let's use modal for ALL 'done' and 'cancelled' to be safe and "True Gold".
            // Only 'in_progress' (Start) might be instant.

            if (newStatus === 'done') {
                setStatusModal({ isOpen: true, order, newStatus, reasonRequired: false });
            } else {
                await executeStatusChange(order.id, newStatus);
            }
        }
    };

    const executeStatusChange = async (orderId: string, newStatus: string, reason?: string, negativeStockConfirmed: boolean = false, negativeReason?: string) => {
        // Don't set global isLoading to avoid table flash
        try {
            const result = await changeWorkOrderStatusAction(orderId, newStatus, reason, negativeStockConfirmed, negativeReason);

            if (result && result.data) {
                // Update local state with returned data
                setOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...(result.data as any) } : o));
            }

            toast({ title: "Sucesso", description: "Status atualizado.", variant: "default" });
            setStatusModal({ isOpen: false, order: null, newStatus: "", reasonRequired: false });
            setNegativeStockModal({ isOpen: false, items: [], orderId: null, newStatus: null });
        } catch (error: any) {
            console.error(error);

            // Handle Negative Stock Error
            if (error.message === "NEGATIVE_STOCK_DETECTED" && error.negativeItems) {
                setNegativeStockModal({
                    isOpen: true,
                    items: error.negativeItems,
                    orderId,
                    newStatus,
                    originalReason: reason
                });
                return;
            }

            toast({
                title: "Erro",
                description: error.message || "Erro ao atualizar status.",
                variant: "destructive"
            });
        }
    };

    const filteredOrders = orders.filter(order => {
        const matchesSearch = searchTerm === "" ||
            order.item?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            order.id.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesSearch;
    });

    return (
        <div className="space-y-6">
            {/* ... (NewWorkOrderModal) */}
            <NewWorkOrderModal
                isOpen={isNewOrderOpen}
                onClose={() => setIsNewOrderOpen(false)}
                onSuccess={fetchOrders}
            />

            <Card>
                {/* ... (CardHeader) */}
                <CardHeaderStandard
                    icon={<ListFilter className="w-5 h-5 text-brand-600" />}
                    title="Ordens de Produção"
                    actions={
                        <div className="flex gap-2">
                            <Button onClick={() => setIsNewOrderOpen(true)}>
                                Nova Ordem
                            </Button>
                        </div>
                    }
                >
                    {/* ... (Search/Filter inputs) */}
                    <div className="flex gap-4 mt-4 pb-2 border-b border-gray-100/50">
                        <div className="w-64 relative">
                            <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
                            <Input
                                placeholder="Buscar produto ou ID..."
                                className="pl-9 h-9"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="w-48">
                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                                <SelectTrigger className="h-9">
                                    <SelectValue placeholder="Status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todos os Status</SelectItem>
                                    <SelectItem value="planned">Planejada</SelectItem>
                                    <SelectItem value="in_progress">Em Produção</SelectItem>
                                    <SelectItem value="done">Concluída</SelectItem>
                                    <SelectItem value="cancelled">Cancelada</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardHeaderStandard>

                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            {/* ... (thead) */}
                            <thead className="bg-gray-50/50 text-gray-500 font-medium border-b border-gray-100">
                                <tr>
                                    <th className="px-6 py-3 text-left">Nº ID</th>
                                    <th className="px-6 py-3 text-left">Produto</th>
                                    <th className="px-6 py-3 text-center">Status</th>
                                    <th className="px-6 py-3 text-left">Criado em</th>
                                    <th className="px-6 py-3 text-left">Data Programada</th>
                                    <th className="px-6 py-3 text-right">Planejado</th>
                                    <th className="px-6 py-3 text-right">Produzido</th>
                                    <th className="px-6 py-3 text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                                            Carregando...
                                        </td>
                                    </tr>
                                ) : filteredOrders.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                                            Nenhuma ordem de produção encontrada.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredOrders.map((order) => (
                                        <tr key={order.id} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="px-6 py-3 font-mono text-xs text-gray-500">
                                                #{order.id.slice(0, 8)}
                                            </td>
                                            <td className="px-6 py-3 font-medium text-gray-900">
                                                {order.item?.name}
                                                {order.bom && <span className="ml-2 text-xs text-gray-400 font-normal">(v{order.bom.version})</span>}
                                            </td>
                                            <td className="px-6 py-3 text-center">
                                                {statusBadge(order.status)}
                                            </td>
                                            <td className="px-6 py-3 text-gray-500 text-xs">
                                                {new Date(order.created_at).toLocaleDateString()}
                                            </td>
                                            <td className="px-6 py-3 text-gray-700 text-xs font-medium">
                                                {order.scheduled_date ? new Date(order.scheduled_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '-'}
                                            </td>
                                            <td className="px-6 py-3 text-right font-medium text-gray-700">
                                                {order.planned_qty} <span className="text-xs font-normal text-gray-400">{order.item?.uom}</span>
                                            </td>
                                            <td className="px-6 py-3 text-right font-medium text-brand-700">
                                                {order.produced_qty} <span className="text-xs font-normal text-brand-400">{order.item?.uom}</span>
                                            </td>
                                            <td className="px-6 py-3 text-right">
                                                <div className="flex justify-end items-center gap-2">

                                                    {order.status === 'planned' && (
                                                        <>
                                                            <Button
                                                                variant="ghost" size="sm" className="h-8 w-8 p-0 text-blue-600 hover:bg-blue-50"
                                                                title="Iniciar Produção"
                                                                onClick={() => handleStatusTransition(order, 'in_progress')}
                                                            >
                                                                <Play className="w-4 h-4 text-blue-600" />
                                                            </Button>
                                                            <Button
                                                                variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-600 hover:bg-red-50"
                                                                title="Cancelar Ordem"
                                                                onClick={() => handleStatusTransition(order, 'cancelled')}
                                                            >
                                                                <XCircle className="w-4 h-4 text-red-400" />
                                                            </Button>
                                                            <Button
                                                                variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-600"
                                                                title={order.produced_qty > 0 ? "Não é possível excluir: possui produção." : "Excluir Ordem"}
                                                                onClick={() => handleDeleteClick(order)}
                                                                disabled={order.produced_qty > 0}
                                                            >
                                                                <Trash2 className={`w-4 h-4 ${order.produced_qty > 0 ? 'text-gray-300' : 'text-gray-400'}`} />
                                                            </Button>
                                                        </>
                                                    )}

                                                    {order.status === 'in_progress' && (
                                                        <>
                                                            <Button
                                                                variant="ghost" size="sm" className="h-8 w-8 p-0 text-green-600 hover:bg-green-50"
                                                                title="Finalizar Ordem"
                                                                onClick={() => handleStatusTransition(order, 'done')}
                                                            >
                                                                <CheckCircle2 className="w-4 h-4 text-green-600" />
                                                            </Button>
                                                            <Button
                                                                variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-600 hover:bg-red-50"
                                                                title="Cancelar Ordem"
                                                                onClick={() => handleStatusTransition(order, 'cancelled')}
                                                                disabled={order.produced_qty > 0}
                                                            >
                                                                <XCircle className="w-4 h-4 text-red-400" />
                                                            </Button>
                                                        </>
                                                    )}

                                                    {(order.status === 'done' || order.status === 'cancelled') && (
                                                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Ver Detalhes">
                                                            <Eye className="w-4 h-4 text-gray-400" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            <StatusChangeModal
                isOpen={statusModal.isOpen}
                onClose={() => setStatusModal({ ...statusModal, isOpen: false })}
                onConfirm={(reason: string) => executeStatusChange(statusModal.order!.id, statusModal.newStatus, reason)}
                requireReason={statusModal.reasonRequired}
                newStatus={statusModal.newStatus}
            />

            <Dialog open={deleteModal.isOpen} onOpenChange={(open) => !open && setDeleteModal({ isOpen: false, order: null })}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Excluir Ordem de Produção</DialogTitle>
                        <DialogDescription>
                            Tem certeza que deseja excluir a ordem <b>#{deleteModal.order?.id.slice(0, 8)}</b>?
                            <br />
                            Esta ação não pode ser desfeita.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteModal({ isOpen: false, order: null })}>Cancelar</Button>
                        <Button variant="danger" onClick={confirmDelete}>Excluir</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <NegativeStockModal
                isOpen={negativeStockModal.isOpen}
                onClose={() => setNegativeStockModal({ ...negativeStockModal, isOpen: false })}
                items={negativeStockModal.items}
                onConfirm={(reason: string) => executeStatusChange(negativeStockModal.orderId!, negativeStockModal.newStatus!, negativeStockModal.originalReason, true, reason)}
            />
        </div>
    );
}

// ... StatusChangeModal ...
// ... NewWorkOrderModal ...

function StatusChangeModal({ isOpen, onClose, onConfirm, requireReason, newStatus }: any) {
    const [reason, setReason] = useState("");

    const handleOpenChange = (open: boolean) => {
        if (!open) {
            onClose();
            // Reset reason when closing
            setReason("");
        }
    };

    const handleSubmit = () => {
        if (requireReason && !reason.trim()) {
            return; // Block empty
        }
        onConfirm(reason);
    };

    const getTitle = () => {
        if (newStatus === 'done') return "Finalizar Ordem";
        if (newStatus === 'cancelled') return "Cancelar Ordem";
        return "Alterar Status";
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>{getTitle()}</DialogTitle>
                    <DialogDescription>
                        {requireReason
                            ? "Identificamos uma divergência entre o planejado e o realizado. Por favor, justifique para prosseguir."
                            : "Deseja confirmar a alteração de status?"}
                    </DialogDescription>
                </DialogHeader>

                {requireReason && (
                    <div className="py-2">
                        <Label>Motivo (Obrigatório)</Label>
                        <Textarea
                            value={reason}
                            onChange={e => setReason(e.target.value)}
                            placeholder="Descreva o motivo..."
                            className="mt-2 h-24"
                        />
                    </div>
                )}

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Voltar</Button>
                    <Button onClick={handleSubmit} disabled={requireReason && !reason.trim()}>
                        Confirmar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function NegativeStockModal({ isOpen, onClose, items, onConfirm }: any) {
    const [reason, setReason] = useState("");

    const handleOpenChange = (open: boolean) => {
        if (!open) {
            onClose();
            // Reset reason when closing
            setReason("");
        }
    };

    const handleSubmit = () => {
        if (!reason.trim()) return;
        onConfirm(reason);
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle className="text-amber-600 flex items-center gap-2">
                        <AlertOctagon className="w-5 h-5" />
                        Atenção: Estoque Negativo
                    </DialogTitle>
                    <DialogDescription>
                        A finalização desta ordem causará estoque negativo nos seguintes insumos:
                    </DialogDescription>
                </DialogHeader>

                <div className="py-2">
                    <div className="bg-amber-50 border border-amber-200 rounded-md p-3 mb-4">
                        <ul className="space-y-2 text-sm text-amber-900">
                            {items.map((item: any) => (
                                <li key={item.item_id} className="flex justify-between border-b border-amber-200/50 pb-1 last:border-0 last:pb-0">
                                    <span>{item.item_name}</span>
                                    <span className="font-mono font-bold text-red-600">
                                        {item.balance_after?.toFixed(2)} {item.uom}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <Label>Justificativa para Estoque Negativo (Obrigatório)</Label>
                    <Textarea
                        value={reason}
                        onChange={e => setReason(e.target.value)}
                        placeholder="Ex: Contagem física confirmada, entrada pendente..."
                        className="mt-2 h-24"
                    />
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Cancelar</Button>
                    <Button variant="danger" onClick={handleSubmit} disabled={!reason.trim()}>
                        Confirmar Negativo
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}


// Internal NewWorkOrderModal component removed. Using imported version.