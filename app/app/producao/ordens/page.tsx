"use client";

import { useCompany } from "@/contexts/CompanyContext";
import { createClient } from "@/lib/supabaseBrowser";
import { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { Search, Eye, Play, CheckCircle2, Trash2, XCircle, AlertOctagon, Pencil, Download, Printer, X, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/Select";
import { useToast } from "@/components/ui/use-toast";
import { deleteWorkOrderAction, changeWorkOrderStatusAction, updateWorkOrderAction } from "@/app/actions/pcp-planning";
import { PageHeader } from "@/components/ui/PageHeader";
import { PcpModuleTabs } from "@/components/pcp/PcpModuleTabs";

// Internal Component: New Work Order Modal
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/Dialog";
import { Label } from "@/components/ui/Label";
import { Textarea } from "@/components/ui/Textarea";
import { calculateRecipeCount, formatRecipeCountLabel } from "@/lib/pcp/work-order-metrics";
import { Checkbox } from "@/components/ui/Checkbox";

import { NewWorkOrderModal } from "@/components/pcp/NewWorkOrderModal";
import { ListPagination } from "@/components/ui/ListPagination";

// Types
interface WorkOrder {
    id: string;
    document_number: number | null;
    planned_qty: number;
    produced_qty: number;
    status: 'planned' | 'in_progress' | 'done' | 'cancelled';
    created_at: string;
    scheduled_date: string;
    parent_work_order_id: string | null;
    sector: {
        id: string;
        code: string;
        name: string;
    } | null;
    item: {
        id: string;
        name: string;
        uom: string;
    };
    bom: {
        version: number;
        yield_qty: number;
        yield_uom: string;
    } | null;
}

interface WorkOrderQueryRow extends Omit<WorkOrder, "item" | "bom" | "sector"> {
    item: WorkOrder["item"] | WorkOrder["item"][];
    bom: WorkOrder["bom"] | WorkOrder["bom"][];
    sector: WorkOrder["sector"] | WorkOrder["sector"][];
}

interface SectorOption {
    id: string;
    code: string;
    name: string;
}

const STATUS_LABELS: Record<WorkOrder["status"], string> = {
    planned: "Planejada",
    in_progress: "Em Produção",
    done: "Concluída",
    cancelled: "Cancelada",
};

const escapeHtml = (input: string): string =>
    input
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");

export default function WorkOrdersPage() {
    const { selectedCompany } = useCompany();
    const supabase = createClient();
    const { toast } = useToast();

    const [orders, setOrders] = useState<WorkOrder[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [sectorFilter, setSectorFilter] = useState("all");
    const [sectors, setSectors] = useState<SectorOption[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [currentPage, setCurrentPage] = useState(1);
    const [isBatchPrinting, setIsBatchPrinting] = useState(false);
    const [isBatchDownloading, setIsBatchDownloading] = useState(false);
    const [isBatchDeleting, setIsBatchDeleting] = useState(false);
    const [batchDeleteDialogOpen, setBatchDeleteDialogOpen] = useState(false);
    const PAGE_SIZE = 100;

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
    const [editModal, setEditModal] = useState<{
        isOpen: boolean;
        order: WorkOrder | null;
        plannedQty: number;
        notes: string;
    }>({ isOpen: false, order: null, plannedQty: 0, notes: "" });

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
                    document_number,
                    planned_qty,
                    produced_qty,
                    status,
                    created_at,
                    scheduled_date,
                    parent_work_order_id,
                    sector:production_sectors(id, code, name),
                    item:items!inner (id, name, uom),
                    bom:bom_headers (version, yield_qty, yield_uom)
                `)
                .eq('company_id', selectedCompany!.id)
                .is('deleted_at', null)
                .order('created_at', { ascending: false });

            if (statusFilter !== 'all') {
                query = query.eq('status', statusFilter);
            }

            const [{ data, error }, { data: sectorsData, error: sectorsError }] = await Promise.all([
                query,
                supabase
                    .from('production_sectors')
                    .select('id, code, name')
                    .eq('company_id', selectedCompany!.id)
                    .is('deleted_at', null)
                    .eq('is_active', true)
                    .order('name')
            ]);

            if (error) throw error;
            if (sectorsError) throw sectorsError;

            // Map data to ensure types match (Supabase returns arrays for relations sometimes)
            const mappedOrders: WorkOrder[] = ((data || []) as WorkOrderQueryRow[]).map((o) => ({
                ...o,
                item: Array.isArray(o.item) ? o.item[0] : o.item,
                bom: Array.isArray(o.bom) ? o.bom[0] : o.bom,
                sector: Array.isArray(o.sector) ? o.sector[0] : o.sector
            }));

            setOrders(mappedOrders);
            setSectors((sectorsData || []) as SectorOption[]);

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
            <span className={`inline-flex items-center rounded-2xl px-2 py-1 text-xs font-medium ring-1 ring-inset ${styles[status]}`}>
                {labels[status] || status}
            </span>
        );
    };

    const handleDeleteClick = (order: WorkOrder) => {
        setDeleteModal({ isOpen: true, order });
    };

    const handleEditClick = (order: WorkOrder) => {
        setEditModal({
            isOpen: true,
            order,
            plannedQty: Number(order.planned_qty ?? 0),
            notes: "",
        });
    };

    const confirmEdit = async () => {
        if (!editModal.order) return;
        if (!Number.isFinite(editModal.plannedQty) || editModal.plannedQty <= 0) {
            toast({
                title: "Quantidade inválida",
                description: "Informe uma quantidade planejada maior que zero.",
                variant: "destructive"
            });
            return;
        }

        try {
            await updateWorkOrderAction(editModal.order.id, {
                planned_qty: editModal.plannedQty,
                notes: editModal.notes || undefined,
            });
            toast({ title: "Sucesso", description: "Ordem de produção atualizada.", variant: "default" });
            await fetchOrders();
            setEditModal({ isOpen: false, order: null, plannedQty: 0, notes: "" });
        } catch (error: unknown) {
            console.error(error);
            const message = error instanceof Error ? error.message : "Erro ao atualizar ordem.";
            toast({
                title: "Erro",
                description: message,
                variant: "destructive"
            });
        }
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

    const childCountByParent = useMemo(() => {
        const map = new Map<string, number>();
        for (const order of orders) {
            if (!order.parent_work_order_id) continue;
            const current = map.get(order.parent_work_order_id) || 0;
            map.set(order.parent_work_order_id, current + 1);
        }
        return map;
    }, [orders]);

    const filteredOrders = orders.filter(order => {
        const matchesSearch = searchTerm === "" ||
            order.item?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (order.document_number ? String(order.document_number).includes(searchTerm.trim()) : false) ||
            order.id.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesSector = sectorFilter === "all" || order.sector?.id === sectorFilter;
        return matchesSearch && matchesSector;
    });

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, statusFilter, sectorFilter, orders.length]);

    const totalFilteredOrders = filteredOrders.length;
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    const pagedFilteredOrders = filteredOrders.slice(startIndex, startIndex + PAGE_SIZE);
    const selectedOrders = useMemo(
        () => orders.filter((order) => selectedIds.has(order.id)),
        [orders, selectedIds]
    );
    const selectedVisibleCount = pagedFilteredOrders.filter((order) => selectedIds.has(order.id)).length;
    const isAllVisibleSelected = pagedFilteredOrders.length > 0 && selectedVisibleCount === pagedFilteredOrders.length;
    const isVisibleIndeterminate = selectedVisibleCount > 0 && !isAllVisibleSelected;

    useEffect(() => {
        setSelectedIds((current) => {
            if (current.size === 0) return current;
            const available = new Set(orders.map((order) => order.id));
            const next = new Set<string>();
            for (const id of current) {
                if (available.has(id)) next.add(id);
            }
            return next.size === current.size ? current : next;
        });
    }, [orders]);

    const handleSelectRow = (orderId: string, checked: boolean) => {
        setSelectedIds((current) => {
            const next = new Set(current);
            if (checked) {
                next.add(orderId);
            } else {
                next.delete(orderId);
            }
            return next;
        });
    };

    const handleSelectAllVisible = (checked: boolean) => {
        setSelectedIds((current) => {
            const next = new Set(current);
            for (const order of pagedFilteredOrders) {
                if (checked) {
                    next.add(order.id);
                } else {
                    next.delete(order.id);
                }
            }
            return next;
        });
    };

    const clearSelection = () => setSelectedIds(new Set());

    const buildSelectedOrdersCsv = (rows: WorkOrder[]): string => {
        const headers = ["OP", "ID técnico", "Produto", "Status", "Setor", "Planejado", "UOM", "Receitas", "Produzido", "Data Programada", "Criado em"];
        const contentRows = rows.map((order) => {
            const recipes = formatRecipeCountLabel(calculateRecipeCount(order.planned_qty, order.bom?.yield_qty));
            return [
                order.document_number ? `#${order.document_number}` : "#---",
                order.id,
                order.item?.name ?? "-",
                STATUS_LABELS[order.status],
                order.sector ? `${order.sector.code} - ${order.sector.name}` : "-",
                String(order.planned_qty),
                order.item?.uom ?? "-",
                recipes,
                String(order.produced_qty),
                order.scheduled_date ? new Date(order.scheduled_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : "-",
                new Date(order.created_at).toLocaleDateString(),
            ];
        });
        return [headers, ...contentRows]
            .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(";"))
            .join("\n");
    };

    const handleBatchDownload = async () => {
        if (selectedOrders.length === 0) return;
        setIsBatchDownloading(true);
        try {
            const csv = buildSelectedOrdersCsv(selectedOrders);
            const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `ops_selecionadas_${new Date().toISOString().slice(0, 10)}.csv`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            toast({ title: "Download iniciado", description: "Arquivo CSV das OPs selecionadas gerado com sucesso." });
        } catch (error) {
            console.error(error);
            toast({ title: "Erro", description: "Falha ao gerar arquivo para download.", variant: "destructive" });
        } finally {
            setIsBatchDownloading(false);
        }
    };

    const handleBatchPrint = async () => {
        if (selectedOrders.length === 0) return;
        setIsBatchPrinting(true);
        try {
            const rows = selectedOrders
                .map((order) => {
                    const recipes = formatRecipeCountLabel(calculateRecipeCount(order.planned_qty, order.bom?.yield_qty));
                    return `
                        <tr>
                            <td>${escapeHtml(order.document_number ? `#${order.document_number}` : '#---')}</td>
                            <td>${escapeHtml(order.item?.name ?? '-')}</td>
                            <td>${escapeHtml(STATUS_LABELS[order.status])}</td>
                            <td>${escapeHtml(order.sector ? `${order.sector.code} - ${order.sector.name}` : '-')}</td>
                            <td style="text-align:right;">${escapeHtml(String(order.planned_qty))} ${escapeHtml(order.item?.uom ?? '-')}</td>
                            <td style="text-align:right;">${escapeHtml(recipes)}</td>
                            <td style="text-align:right;">${escapeHtml(String(order.produced_qty))} ${escapeHtml(order.item?.uom ?? '-')}</td>
                        </tr>
                    `;
                })
                .join("");

            const printWindow = window.open("", "_blank", "noopener,noreferrer,width=1200,height=800");
            if (!printWindow) {
                throw new Error("Não foi possível abrir a janela de impressão.");
            }

            printWindow.document.write(`
                <!DOCTYPE html>
                <html lang="pt-BR">
                <head>
                    <meta charset="utf-8" />
                    <title>OPs Selecionadas</title>
                    <style>
                        body { font-family: Arial, sans-serif; margin: 24px; color: #0f172a; }
                        h1 { margin: 0 0 8px 0; font-size: 20px; }
                        p { margin: 0 0 16px 0; color: #475569; }
                        table { width: 100%; border-collapse: collapse; font-size: 12px; }
                        th, td { border: 1px solid #cbd5e1; padding: 8px; vertical-align: top; }
                        th { background: #f1f5f9; text-align: left; font-weight: 700; }
                        @media print { body { margin: 8mm; } }
                    </style>
                </head>
                <body>
                    <h1>Ordens de Produção Selecionadas</h1>
                    <p>Total: ${selectedOrders.length} OP(s)</p>
                    <table>
                        <thead>
                            <tr>
                                <th>OP</th>
                                <th>Produto</th>
                                <th>Status</th>
                                <th>Setor</th>
                                <th>Planejado</th>
                                <th>Receitas</th>
                                <th>Produzido</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </body>
                </html>
            `);
            printWindow.document.close();
            printWindow.focus();
            printWindow.print();
        } catch (error) {
            console.error(error);
            const message = error instanceof Error ? error.message : "Falha ao imprimir OPs selecionadas.";
            toast({ title: "Erro", description: message, variant: "destructive" });
        } finally {
            setIsBatchPrinting(false);
        }
    };

    const getBatchDeleteStats = () => {
        const selected = selectedOrders;
        const deletable = selected.filter((order) => order.status === "planned" && Number(order.produced_qty || 0) <= 0);
        return {
            total: selected.length,
            deletableCount: deletable.length,
            blockedCount: selected.length - deletable.length,
            deletableIds: deletable.map((order) => order.id),
        };
    };

    const handleBatchDelete = async () => {
        const stats = getBatchDeleteStats();
        if (stats.deletableIds.length === 0) {
            toast({
                title: "Nenhuma OP apta",
                description: "Selecione OPs planejadas e sem produção para excluir.",
                variant: "destructive"
            });
            setBatchDeleteDialogOpen(false);
            return;
        }

        setIsBatchDeleting(true);
        try {
            let deletedCount = 0;
            let failedCount = 0;
            const failedMessages: string[] = [];

            for (const orderId of stats.deletableIds) {
                try {
                    await deleteWorkOrderAction(orderId, { deletePlannedChildren: true });
                    deletedCount += 1;
                } catch (error) {
                    failedCount += 1;
                    const message = error instanceof Error ? error.message : "Erro ao excluir OP.";
                    if (failedMessages.length < 3) {
                        failedMessages.push(message);
                    }
                }
            }

            setBatchDeleteDialogOpen(false);
            clearSelection();
            await fetchOrders();

            toast({
                title: "Exclusão em lote concluída",
                description: failedCount > 0
                    ? `Excluídas: ${deletedCount}. Falhas: ${failedCount}. ${failedMessages.join(" ")}`
                    : `Excluídas: ${deletedCount}.`,
                variant: failedCount > 0 ? "destructive" : "default",
            });
        } finally {
            setIsBatchDeleting(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* ... (NewWorkOrderModal) */}
            <NewWorkOrderModal
                isOpen={isNewOrderOpen}
                onClose={() => setIsNewOrderOpen(false)}
                onSuccess={fetchOrders}
            />

            <PageHeader
                title="Ordens de Produção"
                subtitle="Gerencie e acompanhe ordens planejadas, em produção e concluídas."
                children={<PcpModuleTabs />}
                actions={
                    <Button onClick={() => setIsNewOrderOpen(true)}>
                        Nova Ordem
                    </Button>
                }
            />

            <div className="px-6">
                {selectedIds.size > 0 && (
                    <div className="mb-4 p-4 bg-brand-50 border border-brand-100 rounded-2xl flex items-center justify-between animate-in fade-in slide-in-from-top-2">
                        <div className="flex items-center gap-3">
                            <div className="bg-brand-100 text-brand-700 px-3 py-1 rounded-2xl text-sm font-semibold">
                                {selectedIds.size} {selectedIds.size === 1 ? 'OP selecionada' : 'OPs selecionadas'}
                            </div>

                            <div className="h-4 w-px bg-brand-200 mx-1" />

                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleBatchDownload}
                                disabled={isBatchDownloading || isBatchPrinting || isBatchDeleting}
                                className="bg-white border-brand-200 text-brand-700 hover:bg-brand-50 hover:text-brand-800 h-8 font-medium gap-2"
                                title="Baixar OPs selecionadas"
                            >
                                {isBatchDownloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                                {isBatchDownloading ? 'Baixando...' : 'Baixar'}
                            </Button>

                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleBatchPrint}
                                disabled={isBatchDownloading || isBatchPrinting || isBatchDeleting}
                                className="bg-white border-brand-200 text-brand-700 hover:bg-brand-50 hover:text-brand-800 h-8 font-medium gap-2"
                                title="Imprimir OPs selecionadas"
                            >
                                {isBatchPrinting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Printer className="w-3.5 h-3.5" />}
                                {isBatchPrinting ? 'Imprimindo...' : 'Imprimir'}
                            </Button>

                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setBatchDeleteDialogOpen(true)}
                                disabled={isBatchDownloading || isBatchPrinting || isBatchDeleting}
                                className="bg-white border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800 h-8 font-medium gap-2"
                                title="Excluir OPs selecionadas"
                            >
                                {isBatchDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                                {isBatchDeleting ? 'Excluindo...' : 'Excluir'}
                            </Button>
                        </div>

                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={clearSelection}
                            disabled={isBatchDownloading || isBatchPrinting || isBatchDeleting}
                            className="text-brand-700 hover:text-brand-800 hover:bg-brand-100"
                        >
                            <X className="w-4 h-4 mr-2" />
                            Limpar seleção
                        </Button>
                    </div>
                )}

                <Card>
                    <CardContent className="p-0">
                        <div className="flex flex-wrap gap-3 p-4 border-b border-gray-100/70">
                            <div className="w-full md:w-72 relative">
                                <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
                                <Input
                                    placeholder="Buscar produto ou ID..."
                                    className="pl-9 h-9"
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <div className="w-full md:w-48">
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
                            <div className="w-full md:w-64">
                                <Select value={sectorFilter} onValueChange={setSectorFilter}>
                                    <SelectTrigger className="h-9">
                                        <SelectValue placeholder="Setor" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Todos os Setores</SelectItem>
                                        {sectors.map((sector) => (
                                            <SelectItem key={sector.id} value={sector.id}>
                                                {sector.code} - {sector.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                {/* ... (thead) */}
                                <thead className="bg-white text-gray-500 font-semibold border-b border-gray-200">
                                    <tr>
                                        <th className="px-6 py-3 w-10">
                                            <Checkbox
                                                checked={isAllVisibleSelected ? true : isVisibleIndeterminate ? "indeterminate" : false}
                                                onCheckedChange={(checked) => handleSelectAllVisible(checked === true)}
                                                aria-label="Selecionar todas as OPs visíveis"
                                            />
                                        </th>
                                        <th className="px-6 py-3 text-left">OP</th>
                                        <th className="px-6 py-3 text-left">Produto</th>
                                        <th className="px-6 py-3 text-center">Status</th>
                                        <th className="px-6 py-3 text-left">Criado em</th>
                                        <th className="px-6 py-3 text-left">Data Programada</th>
                                        <th className="px-6 py-3 text-left">Setor</th>
                                        <th className="px-6 py-3 text-left">Vínculo</th>
                                        <th className="px-6 py-3 text-right">Planejado</th>
                                        <th className="px-6 py-3 text-right">Receitas</th>
                                        <th className="px-6 py-3 text-right">Produzido</th>
                                        <th className="px-6 py-3 text-right">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {isLoading ? (
                                        <tr>
                                            <td colSpan={12} className="px-6 py-8 text-center text-gray-500">
                                                Carregando...
                                            </td>
                                        </tr>
                                    ) : filteredOrders.length === 0 ? (
                                        <tr>
                                            <td colSpan={12} className="px-6 py-8 text-center text-gray-500">
                                                Nenhuma ordem de produção encontrada.
                                            </td>
                                        </tr>
                                    ) : (
                                        pagedFilteredOrders.map((order) => (
                                            <tr
                                                key={order.id}
                                                className={`transition-colors ${selectedIds.has(order.id) ? 'bg-brand-50/50 hover:bg-brand-50' : 'hover:bg-gray-50'}`}
                                            >
                                                <td className="px-6 py-3">
                                                    <Checkbox
                                                        checked={selectedIds.has(order.id)}
                                                        onCheckedChange={(checked) => handleSelectRow(order.id, checked === true)}
                                                        aria-label={`Selecionar OP ${order.document_number ?? order.id.slice(0, 8)}`}
                                                    />
                                                </td>
                                                <td className="px-6 py-3">
                                                    <div className="flex flex-col leading-tight">
                                                        <span className="font-semibold text-gray-800">
                                                            {order.document_number ? `#${order.document_number}` : '#---'}
                                                        </span>
                                                        <span className="font-mono text-[11px] text-gray-400">
                                                            ID {order.id.slice(0, 8)}
                                                        </span>
                                                    </div>
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
                                                <td className="px-6 py-3 text-xs text-gray-700">
                                                    {order.sector ? `${order.sector.code} - ${order.sector.name}` : "-"}
                                                </td>
                                                <td className="px-6 py-3 text-xs text-gray-700">
                                                    {order.parent_work_order_id
                                                        ? `Filha de #${order.parent_work_order_id.slice(0, 8)}`
                                                        : (childCountByParent.get(order.id)
                                                            ? `Mãe (${childCountByParent.get(order.id)})`
                                                            : "-")}
                                                </td>
                                                <td className="px-6 py-3 text-right font-medium text-gray-700">
                                                    {order.planned_qty} <span className="text-xs font-normal text-gray-400">{order.item?.uom}</span>
                                                </td>
                                                <td className="px-6 py-3 text-right font-medium text-gray-700">
                                                    {formatRecipeCountLabel(calculateRecipeCount(order.planned_qty, order.bom?.yield_qty))}
                                                </td>
                                                <td className="px-6 py-3 text-right font-medium text-brand-700">
                                                    {order.produced_qty} <span className="text-xs font-normal text-brand-400">{order.item?.uom}</span>
                                                </td>
                                                <td className="px-6 py-3 text-right">
                                                    <div className="flex justify-end items-center gap-2">

                                                    {order.status === 'planned' && (
                                                        <>
                                                            <Button
                                                                variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-500 hover:bg-slate-100"
                                                                title="Editar OP"
                                                                onClick={() => handleEditClick(order)}
                                                            >
                                                                <Pencil className="w-4 h-4 text-slate-500" />
                                                            </Button>
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
                <ListPagination
                    page={currentPage}
                    pageSize={PAGE_SIZE}
                    total={totalFilteredOrders}
                    onPageChange={setCurrentPage}
                    label="ordens"
                    disabled={isLoading}
                />
            </div>

            <StatusChangeModal
                isOpen={statusModal.isOpen}
                onClose={() => setStatusModal({ ...statusModal, isOpen: false })}
                onConfirm={(reason: string) => executeStatusChange(statusModal.order!.id, statusModal.newStatus, reason)}
                requireReason={statusModal.reasonRequired}
                newStatus={statusModal.newStatus}
            />

            <Dialog open={batchDeleteDialogOpen} onOpenChange={setBatchDeleteDialogOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Excluir OPs selecionadas</DialogTitle>
                        <DialogDescription>
                            {(() => {
                                const stats = getBatchDeleteStats();
                                if (stats.total === 0) {
                                    return "Nenhuma OP selecionada.";
                                }
                                return (
                                    <>
                                        Você selecionou <strong>{stats.total}</strong> OP(s).
                                        <br />
                                        Aptas para exclusão: <strong>{stats.deletableCount}</strong>.
                                        {stats.blockedCount > 0 && (
                                            <>
                                                <br />
                                                Bloqueadas pelas regras básicas: <strong>{stats.blockedCount}</strong>.
                                            </>
                                        )}
                                        <br />
                                        As regras finais (consumos, produção iniciada e dependências) serão validadas ao confirmar.
                                    </>
                                );
                            })()}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setBatchDeleteDialogOpen(false)} disabled={isBatchDeleting}>
                            Cancelar
                        </Button>
                        <Button
                            variant="danger"
                            onClick={handleBatchDelete}
                            disabled={isBatchDeleting || getBatchDeleteStats().deletableCount === 0}
                        >
                            {isBatchDeleting ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Excluindo...
                                </>
                            ) : (
                                "Confirmar exclusão"
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={deleteModal.isOpen} onOpenChange={(open) => !open && setDeleteModal({ isOpen: false, order: null })}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Excluir Ordem de Produção</DialogTitle>
                        <DialogDescription>
                            Tem certeza que deseja excluir a ordem{' '}
                            <b>
                                {deleteModal.order?.document_number
                                    ? `#${deleteModal.order.document_number}`
                                    : `#${deleteModal.order?.id.slice(0, 8)}`}
                            </b>
                            ?
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

            <Dialog open={editModal.isOpen} onOpenChange={(open) => !open && setEditModal({ isOpen: false, order: null, plannedQty: 0, notes: "" })}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Editar Ordem de Produção</DialogTitle>
                        <DialogDescription>
                            Ajuste a quantidade planejada da OP{' '}
                            <b>
                                {editModal.order?.document_number
                                    ? `#${editModal.order.document_number}`
                                    : `#${editModal.order?.id.slice(0, 8)}`}
                            </b>.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 py-1">
                        <div>
                            <Label htmlFor="edit-planned-qty">Quantidade planejada</Label>
                            <Input
                                id="edit-planned-qty"
                                type="number"
                                min={0}
                                step="0.01"
                                value={editModal.plannedQty}
                                onChange={(event) => setEditModal((current) => ({
                                    ...current,
                                    plannedQty: Number(event.target.value)
                                }))}
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <Label htmlFor="edit-planned-notes">Observações</Label>
                            <Textarea
                                id="edit-planned-notes"
                                value={editModal.notes}
                                onChange={(event) => setEditModal((current) => ({
                                    ...current,
                                    notes: event.target.value
                                }))}
                                className="mt-1 h-20"
                                placeholder="Opcional"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditModal({ isOpen: false, order: null, plannedQty: 0, notes: "" })}>Cancelar</Button>
                        <Button onClick={confirmEdit}>Salvar</Button>
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
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 mb-4">
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
