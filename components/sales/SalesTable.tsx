"use client";

import { SalesOrder } from "@/types/sales";
import { format } from "date-fns";
import { Eye, FileText, Trash2, X, Printer, Loader2, Download, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import Link from "next/link";
import {
    getCommercialBadgeStyle,
    getLogisticsBadgeStyle,
    getFinancialBadgeStyle
} from "@/lib/constants/statusColors";
import { normalizeLogisticsStatus, translateLogisticsStatusPt } from "@/lib/constants/status";
import { useState, useEffect } from "react";
import { ConfirmDialogDesdobra } from "@/components/ui/ConfirmDialogDesdobra";
import { useToast } from "@/components/ui/use-toast";
import { useRouter } from "next/navigation";
import { Checkbox } from "@/components/ui/Checkbox";
// DropdownMenu imports removed

interface SalesTableProps {
    data: SalesOrder[];
    isLoading: boolean;
    onSelectionChange?: (selectedIds: string[]) => void;
}

export function SalesTable({ data, isLoading, onSelectionChange }: SalesTableProps) {
    const { toast } = useToast();
    const router = useRouter();
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [orderToDelete, setOrderToDelete] = useState<SalesOrder | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Batch actions state
    const [isBatchPrinting, setIsBatchPrinting] = useState(false);
    const [isBatchDownloading, setIsBatchDownloading] = useState(false);
    const [isBatchApproving, setIsBatchApproving] = useState(false);
    const [approveDialogOpen, setApproveDialogOpen] = useState(false);
    const [isBatchDeleting, setIsBatchDeleting] = useState(false);
    const [batchDeleteDialogOpen, setBatchDeleteDialogOpen] = useState(false);

    // Selection state
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Reset selection when data changes (e.g. pagination/filter)
    useEffect(() => {
        setSelectedIds(new Set());
    }, [data]);

    // Notify parent about selection changes
    useEffect(() => {
        onSelectionChange?.(Array.from(selectedIds));
    }, [selectedIds, onSelectionChange]);

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            const allIds = data.map(order => order.id);
            setSelectedIds(new Set(allIds));
        } else {
            setSelectedIds(new Set());
        }
    };

    const handleSelect = (id: string, checked: boolean) => {
        const newSelected = new Set(selectedIds);
        if (checked) {
            newSelected.add(id);
        } else {
            newSelected.delete(id);
        }
        setSelectedIds(newSelected);
    };

    const clearSelection = () => {
        setSelectedIds(new Set());
    };

    const isAllSelected = data.length > 0 && selectedIds.size === data.length;
    const isIndeterminate = selectedIds.size > 0 && selectedIds.size < data.length;

    const canDelete = (order: SalesOrder) => {
        const blockedStatuses = ['in_route', 'delivered', 'not_delivered'];
        const status = normalizeLogisticsStatus(order.status_logistic) || order.status_logistic;
        return !blockedStatuses.includes(status);
    };

    const handleDeleteClick = (order: SalesOrder) => {
        if (!canDelete(order)) {
            const statusLabel = translateLogisticsStatusPt(order.status_logistic).toUpperCase();
            toast({
                title: "Exclusão não permitida",
                description: `Pedido não pode ser excluído porque já está ${statusLabel}.`,
                variant: "destructive"
            });
            return;
        }
        setOrderToDelete(order);
        setDeleteDialogOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (!orderToDelete) return;

        console.log('Frontend deleting order ID:', orderToDelete.id);
        setIsDeleting(true);
        try {
            const response = await fetch(`/api/sales/orders/${orderToDelete.id}`, {
                method: 'DELETE',
            });

            const result = await response.json();

            if (!response.ok) {
                const errorMessage = result.details
                    ? `${result.error}: ${result.details}`
                    : (result.error || 'Erro ao excluir pedido');
                throw new Error(errorMessage);
            }

            toast({
                title: "Sucesso",
                description: result.message || 'Pedido excluído com sucesso',
            });

            setDeleteDialogOpen(false);
            setOrderToDelete(null);

            // Refresh the page to update the list
            router.refresh();

        } catch (error: any) {
            console.error('Delete error:', error);
            toast({
                title: "Erro",
                description: error.message || 'Erro ao excluir pedido',
                variant: "destructive"
            });
        } finally {
            setIsDeleting(false);
        }
    };

    const handleBatchAction = async (mode: 'zip' | 'pdf') => {
        const idsToProcess = Array.from(selectedIds);
        if (idsToProcess.length === 0) return;

        if (idsToProcess.length > 50) {
            toast({
                title: "Limite excedido",
                description: `O limite para ações em lote é de 50 pedidos. Você selecionou ${idsToProcess.length}.`,
                variant: "destructive"
            });
            return;
        }

        const isZip = mode === 'zip';
        if (isZip) setIsBatchDownloading(true);
        else setIsBatchPrinting(true);

        try {
            // Append mode to query param
            const response = await fetch(`/api/sales/print-batch?mode=${mode}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ ids: idsToProcess }),
            });

            if (!response.ok) {
                const result = await response.json().catch(() => ({}));
                throw new Error(result.error || 'Erro ao processar solicitação');
            }

            // Handle blob download
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;

            // Try to get filename from headers or generate fallback
            const contentDisposition = response.headers.get('Content-Disposition');
            let filename = `PEDIDOS_${format(new Date(), 'yyyy-MM-dd')}_${idsToProcess.length}.${isZip ? 'zip' : 'pdf'}`;

            if (contentDisposition) {
                const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
                if (filenameMatch && filenameMatch.length === 2) {
                    filename = filenameMatch[1];
                }
            }

            a.download = filename;
            document.body.appendChild(a);
            a.click();

            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            toast({
                title: "Sucesso",
                description: isZip
                    ? `Arquivo ZIP com ${idsToProcess.length} PDFs baixado com sucesso.`
                    : `PDF consolidado de ${idsToProcess.length} pedidos gerado com sucesso.`,
            });
        } catch (error: any) {
            console.error('Batch action error:', error);
            toast({
                title: isZip ? "Erro ao baixar" : "Erro ao imprimir",
                description: error.message || "Não foi possível gerar os arquivos.",
                variant: "destructive"
            });
        } finally {
            if (isZip) setIsBatchDownloading(false);
            else setIsBatchPrinting(false);
        }
    };

    const handleBatchApprove = async () => {
        const idsToProcess = Array.from(selectedIds);
        if (idsToProcess.length === 0) return;

        setIsBatchApproving(true);
        try {
            const response = await fetch('/api/sales/approve-batch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: idsToProcess }),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Erro ao aprovar pedidos');
            }

            toast({
                title: "Processamento concluído",
                description: `Aprovados: ${result.approved} | Ignorados: ${result.skipped}`,
                variant: "default"
            });

            setApproveDialogOpen(false);
            setSelectedIds(new Set()); // Clear selection
            router.refresh();

        } catch (error: any) {
            console.error('Batch approve error:', error);
            toast({
                title: "Erro na aprovação",
                description: error.message || "Erro ao processar solicitações.",
                variant: "destructive"
            });
        } finally {
            setIsBatchApproving(false);
        }
    };


    const getApprovalStats = () => {
        const selectedOrders = data.filter(order => selectedIds.has(order.id));
        const total = selectedOrders.length;

        let toApprove = 0;
        let alreadyApproved = 0;
        let ignored = 0;

        selectedOrders.forEach(order => {
            // Check if already approved or confirmed
            const isApproved = ['approved', 'confirmed'].includes(order.status_commercial);
            // Check if it's a budget/proposal that can be approved
            const isBudget = order.doc_type === 'proposal' || ['draft', 'sent'].includes(order.status_commercial);

            if (isApproved) {
                alreadyApproved++;
            } else if (isBudget) {
                toApprove++;
            } else {
                ignored++; // Cancelled, lost, or weird state
            }
        });

        return { total, toApprove, alreadyApproved, ignored };
    };

    const getDeleteStats = () => {
        const selectedOrders = data.filter(order => selectedIds.has(order.id));
        const total = selectedOrders.length;

        let toDelete = 0;
        let blocked = 0;

        selectedOrders.forEach(order => {
            if (canDelete(order)) {
                toDelete++;
            } else {
                blocked++;
            }
        });

        return { total, toDelete, blocked };
    };

    const handleBatchDelete = async () => {
        const idsToProcess = Array.from(selectedIds);
        if (idsToProcess.length === 0) return;

        setIsBatchDeleting(true);
        try {
            const response = await fetch('/api/sales/delete-batch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: idsToProcess }),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Erro ao excluir pedidos');
            }

            toast({
                title: "Processamento concluído",
                description: `Excluídos: ${result.deleted} | Ignorados (Bloqueados): ${result.skipped}`,
                variant: "default"
            });

            setBatchDeleteDialogOpen(false);
            setSelectedIds(new Set()); // Clear selection
            router.refresh();

        } catch (error: any) {
            console.error('Batch delete error:', error);
            toast({
                title: "Erro na exclusão",
                description: error.message || "Erro ao processar solicitações.",
                variant: "destructive"
            });
        } finally {
            setIsBatchDeleting(false);
        }
    };

    if (isLoading) {
        return <div className="p-8 text-center text-gray-500">Carregando pedidos...</div>;
    }

    if (!data || data.length === 0) {
        return (
            <div className="p-12 text-center border border-gray-200 rounded-2xl bg-gray-50 text-gray-500">
                <FileText className="w-12 h-12 mx-auto mb-4 opacity-20" />
                <h3 className="text-lg font-medium">Nenhum pedido encontrado</h3>
                <p>Ajuste os filtros ou crie um novo pedido.</p>
            </div>
        );
    }

    return (
        <>
            {selectedIds.size > 0 && (
                <div className="mb-4 p-4 bg-brand-50 border border-brand-100 rounded-2xl flex items-center justify-between animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-center gap-3">
                        <div className="bg-brand-100 text-brand-700 px-3 py-1 rounded-2xl text-sm font-semibold">
                            {selectedIds.size} {selectedIds.size === 1 ? 'pedido selecionado' : 'pedidos selecionados'}
                        </div>

                        <div className="h-4 w-px bg-brand-200 mx-2"></div>

                        <Button
                            size="sm"
                            onClick={() => setApproveDialogOpen(true)}
                            disabled={isBatchPrinting || isBatchDownloading || isBatchApproving || isBatchDeleting}
                            className="bg-green-600 text-white hover:bg-green-700 h-8 font-medium gap-2 border-none"
                        >
                            <CheckCircle className="w-4 h-4" />
                            Confirmar Orçamentos
                        </Button>

                        <div className="h-4 w-px bg-brand-200 mx-1"></div>

                        {/* Ações Rápidas */}
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleBatchAction('zip')}
                                disabled={isBatchPrinting || isBatchDownloading}
                                className="bg-white border-brand-200 text-brand-700 hover:bg-brand-50 hover:text-brand-800 h-8 font-medium gap-2"
                                title="Baixar PDFs em ZIP"
                            >
                                {isBatchDownloading ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                    <Download className="w-3.5 h-3.5" />
                                )}
                                {isBatchDownloading ? 'Baixando...' : 'Baixar'}
                            </Button>

                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleBatchAction('pdf')}
                                disabled={isBatchPrinting || isBatchDownloading}
                                className="bg-white border-brand-200 text-brand-700 hover:bg-brand-50 hover:text-brand-800 h-8 font-medium gap-2"
                                title="Gerar PDF único consolidado"
                            >
                                {isBatchPrinting ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                    <Printer className="w-3.5 h-3.5" />
                                )}
                                {isBatchPrinting ? 'Imprimindo...' : 'Imprimir'}
                            </Button>

                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setBatchDeleteDialogOpen(true)}
                                disabled={isBatchPrinting || isBatchDownloading || isBatchApproving || isBatchDeleting}
                                className="bg-white border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800 h-8 font-medium gap-2 ml-2"
                                title="Excluir pedidos selecionados"
                            >
                                {isBatchDeleting ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                    <Trash2 className="w-3.5 h-3.5" />
                                )}
                                {isBatchDeleting ? 'Excluindo...' : 'Excluir'}
                            </Button>
                        </div>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearSelection}
                        disabled={isBatchPrinting || isBatchDownloading}
                        className="text-brand-700 hover:text-brand-800 hover:bg-brand-100"
                    >
                        <X className="w-4 h-4 mr-2" />
                        Limpar seleção
                    </Button>
                </div>
            )}

            <Card className="bg-white overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-white text-gray-500 font-semibold border-b border-gray-200">
                            <tr>
                                <th className="w-12 px-6 py-4">
                                    <Checkbox
                                        checked={isAllSelected ? true : isIndeterminate ? "indeterminate" : false}
                                        onCheckedChange={handleSelectAll}
                                    />
                                </th>
                                <th className="px-6 py-4 w-24 text-xs uppercase tracking-wider">Número</th>
                                <th className="px-6 py-4 text-xs uppercase tracking-wider">Cliente</th>
                                <th className="px-6 py-4 w-36 text-xs uppercase tracking-wider">Data</th>
                                <th className="px-6 py-4 text-right text-xs uppercase tracking-wider">Total</th>
                                <th className="px-6 py-4 text-center text-xs uppercase tracking-wider">Comercial</th>
                                <th className="px-6 py-4 text-center text-xs uppercase tracking-wider">Logístico</th>
                                <th className="px-6 py-4 text-center text-xs uppercase tracking-wider">Financeiro</th>
                                <th className="px-6 py-4 w-24"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {data.map((order) => (
                                <tr
                                    key={order.id}
                                    className={`group transition-colors ${selectedIds.has(order.id) ? 'bg-brand-50/50 hover:bg-brand-50' : 'hover:bg-gray-50/80'}`}
                                >
                                    <td className="px-6 py-4">
                                        <Checkbox
                                            checked={selectedIds.has(order.id)}
                                            onCheckedChange={(checked) => handleSelect(order.id, checked)}
                                        />
                                    </td>
                                    <td className="px-6 py-4 font-medium text-gray-900">
                                        <Link href={`/app/vendas/pedidos/${order.id}`} className="hover:text-brand-700 text-brand-600 font-bold">
                                            #{order.document_number?.toString().padStart(4, '0') || '---'}
                                        </Link>
                                        <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">{order.doc_type === 'order' ? 'PEDIDO' : 'PROPOSTA'}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="font-semibold text-gray-900">{order.client?.trade_name || 'Desconhecido'}</div>
                                    </td>
                                    <td className="px-6 py-4 text-gray-500 text-sm">
                                        {order.date_issued ? format(new Date(order.date_issued), 'dd/MM/yyyy') : '-'}
                                    </td>
                                    <td className="px-6 py-4 text-right font-bold text-gray-900">
                                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.total_amount || 0)}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className={`inline-flex px-3 py-1 rounded-full text-xs font-bold ${getCommercialBadgeStyle(order.status_commercial).bg} ${getCommercialBadgeStyle(order.status_commercial).text}`}>
                                            {order.doc_type === 'proposal' && order.status_commercial === 'draft' ? "Orçamento" : getCommercialBadgeStyle(order.status_commercial).label}
                                        </span>
                                        {/* Archived Badge */}
                                        {order.deleted_at && (
                                            <span className="ml-1 inline-flex px-2 py-1 rounded-full text-[10px] font-bold bg-gray-100 text-gray-500 border border-gray-200">
                                                ARQUIVADO
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className={`inline-flex px-3 py-1 rounded-full text-xs font-bold ${getLogisticsBadgeStyle(order.status_logistic).bg} ${getLogisticsBadgeStyle(order.status_logistic).text}`}>
                                            {getLogisticsBadgeStyle(order.status_logistic).label}
                                        </span>
                                        {/* Blocked Badge */}
                                        {order.dispatch_blocked && (
                                            <div className="mt-1">
                                                <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 border border-red-300" title={order.dispatch_blocked_reason || 'Bloqueado'}>
                                                    NÃO CARREGAR
                                                </span>
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        {order.doc_type === 'order' && (
                                            <span className={`inline-flex px-3 py-1 rounded-full text-xs font-bold ${getFinancialBadgeStyle(order.financial_status || 'pending').bg} ${getFinancialBadgeStyle(order.financial_status || 'pending').text}`}>
                                                {getFinancialBadgeStyle(order.financial_status || 'pending').label}
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            <Link href={`/app/vendas/pedidos/${order.id}`}>
                                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                                    <Eye className="h-4 w-4" />
                                                </Button>
                                            </Link>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                                onClick={() => handleDeleteClick(order)}
                                                disabled={!canDelete(order)}
                                                title={!canDelete(order) ? 'Pedido não pode ser excluído neste status' : 'Excluir pedido'}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {/* Pagination Footer would go here - implemented in parent usually or passed props */}
            </Card>

            <ConfirmDialogDesdobra
                open={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}
                title="Excluir Pedido"
                description={
                    <div className="space-y-3">
                        <p>
                            Tem certeza que deseja excluir o pedido{' '}
                            <span className="font-bold">
                                #{orderToDelete?.document_number?.toString().padStart(4, '0')}
                            </span>
                            ?
                        </p>
                        <p className="text-sm text-gray-600">
                            Cliente: <span className="font-medium">{orderToDelete?.client?.trade_name}</span>
                        </p>
                        <div className="p-3 bg-red-50 border-l-4 border-red-500 rounded-r text-red-800 text-sm">
                            <p className="font-semibold">⚠️ Atenção</p>
                            <p>Esta ação não pode ser desfeita. O pedido será removido permanentemente do sistema.</p>
                        </div>
                    </div>
                }
                confirmText="Excluir Pedido"
                cancelText="Cancelar"
                onConfirm={handleConfirmDelete}
                variant="danger"
                isLoading={isDeleting}
            />

            {(() => {
                const stats = getApprovalStats();
                const nothingToApprove = stats.toApprove === 0;

                return (
                    <ConfirmDialogDesdobra
                        open={approveDialogOpen}
                        onOpenChange={setApproveDialogOpen}
                        title={nothingToApprove ? "Nenhum Orçamento Apto" : "Confirmar Orçamentos em Lote"}
                        description={
                            <div className="space-y-4 text-sm">
                                {nothingToApprove ? (
                                    <div className="p-3 bg-yellow-50 border-l-4 border-yellow-500 rounded-r text-yellow-800">
                                        <p className="font-bold mb-1">Atenção</p>
                                        <p>Nenhum dos itens selecionados precisa ser aprovado.</p>
                                        <ul className="list-disc pl-5 mt-2 space-y-1">
                                            {stats.alreadyApproved > 0 && <li><b>{stats.alreadyApproved}</b> já estão aprovados/confirmados.</li>}
                                            {stats.ignored > 0 && <li><b>{stats.ignored}</b> estão cancelados ou inválidos.</li>}
                                        </ul>
                                    </div>
                                ) : (
                                    <>
                                        <p>Você selecionou <span className="font-bold">{stats.total}</span> itens no total.</p>

                                        <div className="bg-gray-50 p-3 rounded-md border border-gray-100 space-y-2">
                                            <div className="flex justify-between items-center text-green-700 font-medium">
                                                <span>Confirmar Orçamentos:</span>
                                                <span className="bg-green-100 px-2 py-0.5 rounded text-xs">{stats.toApprove} itens</span>
                                            </div>
                                            {stats.alreadyApproved > 0 && (
                                                <div className="flex justify-between items-center text-blue-700">
                                                    <span>Já Confirmados (Manter):</span>
                                                    <span className="bg-blue-100 px-2 py-0.5 rounded text-xs">{stats.alreadyApproved} itens</span>
                                                </div>
                                            )}
                                            {stats.ignored > 0 && (
                                                <div className="flex justify-between items-center text-gray-500">
                                                    <span>Ignorados (Outros):</span>
                                                    <span className="bg-gray-100 px-2 py-0.5 rounded text-xs">{stats.ignored} itens</span>
                                                </div>
                                            )}
                                        </div>

                                        <p className="text-gray-500 text-xs">
                                            Os orçamentos confirmados serão movidos para o <b>Sandbox</b> logístico automaticamente.
                                        </p>
                                    </>
                                )}
                            </div>
                        }
                        confirmText={nothingToApprove ? "Entendi" : "Confirmar"}
                        cancelText={nothingToApprove ? undefined : "Cancelar"}
                        onConfirm={nothingToApprove ? () => setApproveDialogOpen(false) : handleBatchApprove}
                        variant={nothingToApprove ? "info" : "success"}
                        isLoading={isBatchApproving}
                    />
                );
            })()}

            {(() => {
                const stats = getDeleteStats();
                const nothingToDelete = stats.toDelete === 0;

                return (
                    <ConfirmDialogDesdobra
                        open={batchDeleteDialogOpen}
                        onOpenChange={setBatchDeleteDialogOpen}
                        title={nothingToDelete ? "Nenhum Pedido Pode Ser Excluído" : "Excluir Pedidos em Lote"}
                        description={
                            <div className="space-y-4 text-sm">
                                {nothingToDelete ? (
                                    <div className="p-3 bg-red-50 border-l-4 border-red-500 rounded-r text-red-800">
                                        <p className="font-bold mb-1">Bloqueado</p>
                                        <p>Todos os {stats.total} itens selecionados possuem restrições lógisticas.</p>
                                        <p className="text-xs mt-1">Pedidos "Em Rota", "Entregues" ou "Não Entregues" não podem ser excluídos.</p>
                                    </div>
                                ) : (
                                    <>
                                        <p>Você selecionou <span className="font-bold">{stats.total}</span> itens no total.</p>

                                        <div className="bg-gray-50 p-3 rounded-md border border-gray-100 space-y-2">
                                            <div className="flex justify-between items-center text-red-700 font-medium">
                                                <span>A Excluir:</span>
                                                <span className="bg-red-100 px-2 py-0.5 rounded text-xs">{stats.toDelete} itens</span>
                                            </div>
                                            {stats.blocked > 0 && (
                                                <div className="flex justify-between items-center text-gray-500">
                                                    <span>Bloqueados (Ignorar):</span>
                                                    <span className="bg-gray-100 px-2 py-0.5 rounded text-xs">{stats.blocked} itens</span>
                                                </div>
                                            )}
                                        </div>

                                        <p className="text-red-600 font-semibold text-xs mt-2">
                                            ⚠️ Esta ação não pode ser desfeita. Os pedidos excluídos serão arquivados.
                                        </p>
                                    </>
                                )}
                            </div>
                        }
                        confirmText={nothingToDelete ? "Fechar" : "Confirmar Exclusão"}
                        cancelText={nothingToDelete ? undefined : "Cancelar"}
                        onConfirm={nothingToDelete ? () => setBatchDeleteDialogOpen(false) : handleBatchDelete}
                        variant={nothingToDelete ? "info" : "danger"}
                        isLoading={isBatchDeleting}
                    />
                );
            })()}
        </>
    );
}
