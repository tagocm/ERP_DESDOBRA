"use client";

import { format } from "date-fns";
import { Eye, FileText, Trash2, Edit2, Calendar, Building2, CheckCircle, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useToast } from "@/components/ui/use-toast";
import {
    receivePurchaseOrderAction,
    cancelPurchaseOrderAction,
    sendPurchaseOrderBatchAction,
    receivePurchaseOrderBatchAction,
} from "@/app/actions/purchases";
import { ConfirmDialogDesdobra } from "@/components/ui/ConfirmDialogDesdobra";
import { Checkbox } from "@/components/ui/Checkbox";

interface PurchaseOrder {
    id: string;
    document_number?: number;
    status: string;
    ordered_at: string;
    total_amount?: number;
    total_cost?: number;
    supplier?: {
        name: string;
        trade_name?: string;
    };
    payment_term?: {
        name: string;
    };
    payment_mode?: {
        name: string;
    };
    items?: any[];
    receiving_blocked?: boolean;
    receiving_blocked_reason?: string | null;
    deleted_at?: string | null;
}

interface PurchasesTableProps {
    data: PurchaseOrder[];
    isLoading: boolean;
    onEdit: (order: PurchaseOrder) => void;
    onRefresh: () => void;
}

export function PurchasesTable({ data, isLoading, onEdit, onRefresh }: PurchasesTableProps) {
    const { toast } = useToast();
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Batch Actions State
    const [isBatchSending, setIsBatchSending] = useState(false);
    const [isBatchReceiving, setIsBatchReceiving] = useState(false);
    const [isBatchDeleting, setIsBatchDeleting] = useState(false);

    // Batch Action Handlers
    const handleBatchSend = async () => {
        const ids = Array.from(selectedIds);
        if (ids.length === 0) return;

        setIsBatchSending(true);
        try {
            const result = await sendPurchaseOrderBatchAction(ids);
            if (result.data) {
                toast({
                    title: "Processamento concluído",
                    description: `Enviados: ${result.data.sent} | Ignorados: ${result.data.skipped}`,
                });
            }
            onRefresh();
            setSelectedIds(new Set());
        } catch (error) {
            console.error(error);
            toast({ title: "Erro ao enviar pedidos", variant: "destructive" });
        } finally {
            setIsBatchSending(false);
        }
    };

    const handleBatchReceive = async () => {
        const ids = Array.from(selectedIds);
        if (ids.length === 0) return;

        setIsBatchReceiving(true);
        try {
            const result = await receivePurchaseOrderBatchAction(ids);
            if (result.data) {
                toast({
                    title: "Processamento concluído",
                    description: `Recebidos: ${result.data.received} | Ignorados: ${result.data.skipped}`,
                });
            }
            onRefresh();
            setSelectedIds(new Set());
        } catch (error) {
            console.error(error);
            toast({ title: "Erro ao receber pedidos", variant: "destructive" });
        } finally {
            setIsBatchReceiving(false);
        }
    };

    // Dialog State
    const [actionDialog, setActionDialog] = useState<{
        isOpen: boolean;
        type: 'receive' | 'cancel' | null;
        order: PurchaseOrder | null;
    }>({ isOpen: false, type: null, order: null });

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedIds(new Set(data.filter(d => !d.deleted_at).map(order => order.id)));
        } else {
            setSelectedIds(new Set());
        }
    };

    const handleSelectRow = (id: string, checked: boolean) => {
        const newSelected = new Set(selectedIds);
        if (checked) {
            newSelected.add(id);
        } else {
            newSelected.delete(id);
        }
        setSelectedIds(newSelected);
    };

    const getStatusBadge = (order: PurchaseOrder) => {
        if (order.receiving_blocked) {
            return (
                <div className="flex flex-col items-center gap-1">
                    <Badge variant="destructive" className="text-[10px] font-bold px-2 py-0.5" title={order.receiving_blocked_reason || 'Bloqueado'}>
                        NÃO RECEBER
                    </Badge>
                    <Badge variant="outline" className={cn('text-xs font-bold px-3 py-1 rounded-2xl bg-blue-100 text-blue-700 border-blue-300')}>
                        Enviado
                    </Badge>
                </div>
            );
        }

        const statusConfig = {
            draft: { label: 'Rascunho', className: 'bg-gray-100 text-gray-700 border-gray-300' },
            sent: { label: 'Enviado', className: 'bg-blue-100 text-blue-700 border-blue-300' },
            received: { label: 'Recebido', className: 'bg-green-100 text-green-700 border-green-300' },
            cancelled: { label: 'Cancelado', className: 'bg-red-100 text-red-700 border-red-300' }
        }[order.status] || { label: order.status, className: '' };

        return (
            <Badge variant="outline" className={cn('text-xs font-bold px-3 py-1 rounded-2xl', statusConfig.className)}>
                {statusConfig.label}
            </Badge>
        );
    };

    const calculateTotal = (order: PurchaseOrder) => {
        if (order.total_amount) return Number(order.total_amount);
        if (order.items) {
            return order.items.reduce((sum, item) => sum + (Number(item.total_cost) || 0), 0);
        }
        return 0;
    };

    // Open Dialog Handlers
    const onReceiveClick = (e: React.MouseEvent, order: PurchaseOrder) => {
        e.stopPropagation();
        setActionDialog({ isOpen: true, type: 'receive', order });
    };

    const onCancelClick = (e: React.MouseEvent, order: PurchaseOrder) => {
        e.stopPropagation();
        setActionDialog({ isOpen: true, type: 'cancel', order });
    };

    // Confirm Action Handler
    const handleConfirmAction = async () => {
        const { type, order } = actionDialog;
        if (!type || !order) return;

        setProcessingId(order.id);
        try {
            if (type === 'receive') {
                await receivePurchaseOrderAction(order.id);
                toast({ title: 'Sucesso', description: 'Pedido recebido e estoque atualizado.' });
            } else if (type === 'cancel') {
                await cancelPurchaseOrderAction(order.id);
                toast({ title: 'Pedido cancelado' });
            }
            onRefresh();
        } catch (error: any) {
            console.error(error);
            toast({
                title: 'Erro',
                description: error.message || (type === 'receive' ? 'Falha ao receber pedido.' : 'Erro ao cancelar.'),
                variant: 'destructive'
            });
        } finally {
            setProcessingId(null);
            setActionDialog({ isOpen: false, type: null, order: null });
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
                            onClick={handleBatchSend}
                            disabled={isBatchSending || isBatchReceiving || isBatchDeleting || !data.filter(o => selectedIds.has(o.id)).some(o => o.status === 'draft')}
                            className="bg-blue-600 text-white hover:bg-blue-700 h-8 font-medium gap-2 border-none disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Mudar status para Enviado"
                        >
                            {isBatchSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                            Confirmar Pedido
                        </Button>

                        <Button
                            size="sm"
                            onClick={handleBatchReceive}
                            disabled={isBatchSending || isBatchReceiving || isBatchDeleting || !data.filter(o => selectedIds.has(o.id)).some(o => o.status === 'sent')}
                            className="bg-green-600 text-white hover:bg-green-700 h-8 font-medium gap-2 border-none disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Gerar movimentações de estoque e financeiro"
                        >
                            {isBatchReceiving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Building2 className="w-4 h-4" />}
                            Confirmar Recebimento
                        </Button>


                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedIds(new Set())}
                        disabled={isBatchSending || isBatchReceiving || isBatchDeleting}
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
                        <thead className="bg-gray-50 text-gray-500 font-semibold border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-4 w-10">
                                    <Checkbox
                                        checked={data.length > 0 && selectedIds.size === data.length}
                                        onCheckedChange={(checked) => handleSelectAll(checked as boolean)}
                                        aria-label="Select all"
                                    />
                                </th>
                                <th className="px-6 py-4 w-28 text-xs uppercase tracking-wider">Número</th>
                                <th className="px-6 py-4 text-xs uppercase tracking-wider">Fornecedor</th>
                                <th className="px-6 py-4 w-36 text-xs uppercase tracking-wider">Data</th>
                                <th className="px-6 py-4 text-xs uppercase tracking-wider">Condição</th>
                                <th className="px-6 py-4 text-xs uppercase tracking-wider">Modalidade</th>
                                <th className="px-6 py-4 text-right text-xs uppercase tracking-wider">Total</th>
                                <th className="px-6 py-4 text-center text-xs uppercase tracking-wider">Status</th>
                                <th className="px-6 py-4 w-40 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {data.map((order) => (
                                <tr
                                    key={order.id}
                                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                                    onClick={() => onEdit(order)}
                                >
                                    <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                                        <Checkbox
                                            checked={selectedIds.has(order.id)}
                                            onCheckedChange={(checked) => handleSelectRow(order.id, checked as boolean)}
                                            aria-label={`Select order ${order.id}`}
                                        />
                                    </td>
                                    <td className="px-6 py-4 font-medium text-gray-900">
                                        <span className="font-bold text-brand-600">
                                            #{String(order.document_number || 0).padStart(4, '0')}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <Building2 className="w-4 h-4 text-gray-400" />
                                            <span className="font-semibold text-gray-900">
                                                {order.supplier?.name || 'Compra Avulsa'}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-gray-500 text-sm">
                                        <div className="flex items-center gap-2">
                                            <Calendar className="w-4 h-4 text-gray-400" />
                                            {format(new Date(order.ordered_at), 'dd/MM/yyyy')}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-gray-500 text-sm">
                                        <span className="font-medium text-gray-900">{order.payment_term?.name || '-'}</span>
                                    </td>
                                    <td className="px-6 py-4 text-gray-500 text-sm">
                                        <span className="font-medium text-gray-900">{order.payment_mode?.name || '-'}</span>
                                    </td>
                                    <td className="px-6 py-4 text-right font-bold text-gray-900">
                                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(calculateTotal(order))}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        {getStatusBadge(order)}
                                    </td>
                                    <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                                        <div className="flex items-center justify-end gap-1">
                                            {/* Ações depende do status */}
                                            {order.status === 'draft' && (
                                                <>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                                        onClick={(e) => { e.stopPropagation(); onEdit(order); }}
                                                        disabled={!!processingId}
                                                        title="Editar"
                                                    >
                                                        <Edit2 className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                                        onClick={(e) => onCancelClick(e, order)}
                                                        disabled={!!processingId}
                                                        title="Cancelar"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </>
                                            )}
                                            {/* Detalhes sempre visível - por enquanto usa Edit para ver */}
                                            {order.status !== 'draft' && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-8 w-8 p-0"
                                                    onClick={(e) => { e.stopPropagation(); onEdit(order); }}
                                                    title="Ver Detalhes"
                                                >
                                                    <Eye className="h-4 w-4" />
                                                </Button>
                                            )}

                                            {order.status === 'sent' && (
                                                <Button
                                                    variant="primary"
                                                    size="sm"
                                                    className="h-7 text-xs ml-2"
                                                    onClick={(e) => onReceiveClick(e, order)}
                                                    disabled={!!processingId}
                                                >
                                                    Receber
                                                </Button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <ConfirmDialogDesdobra
                    open={actionDialog.isOpen}
                    onOpenChange={(open) => !open && setActionDialog(prev => ({ ...prev, isOpen: false }))}
                    title={actionDialog.type === 'receive' ? 'Receber Pedido' : 'Cancelar Pedido'}
                    description={
                        <div className="space-y-3">
                            <p>
                                Tem certeza que deseja {actionDialog.type === 'receive' ? 'confirmar o recebimento do' : 'cancelar o'} pedido{' '}
                                <span className="font-bold">
                                    #{String(actionDialog.order?.document_number || 0).padStart(4, '0')}
                                </span>
                                ?
                            </p>
                            <p className="text-sm text-gray-600">
                                Fornecedor: <span className="font-medium">{actionDialog.order?.supplier?.trade_name || actionDialog.order?.supplier?.name || 'Desconhecido'}</span>
                            </p>

                            <div className={cn(
                                "p-3 border-l-4 rounded-2xl text-sm",
                                actionDialog.type === 'receive'
                                    ? "bg-blue-50 border-blue-500 text-blue-800"
                                    : "bg-red-50 border-red-500 text-red-800"
                            )}>
                                <p className="font-semibold">{actionDialog.type === 'receive' ? 'ℹ️ Atenção' : '⚠️ Atenção'}</p>
                                <p>
                                    {actionDialog.type === 'receive'
                                        ? 'Esta ação gerará movimentos de entrada no estoque e mudará o status para Recebido.'
                                        : 'O pedido será cancelado, mas permanecerá no histórico.'}
                                </p>
                            </div>
                        </div>
                    }
                    confirmText={actionDialog.type === 'receive' ? 'Confirmar Recebimento' : 'Cancelar Pedido'}
                    cancelText="Cancelar"
                    onConfirm={handleConfirmAction}
                    variant={actionDialog.type === 'receive' ? 'success' : 'danger'}
                    isLoading={!!processingId}
                />


            </Card>
        </>
    );
}
