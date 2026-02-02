"use client";

import { RecurringRule, RecurringRuleStatus } from "@/types/recurring-rules";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
    Edit2,
    Power,
    PowerOff,
    Trash2,
    Calendar,
    ArrowRight,
    MoreHorizontal,
    User,
} from "lucide-react";
import { cn, toTitleCase } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";
import { useState } from "react";
import {
    updateRecurringRuleStatusAction,
    deleteRecurringRuleAction,
} from "@/app/actions/recurring-rules";
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
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";

interface RecurringRulesTableProps {
    rules: RecurringRule[];
    loading?: boolean;
}

export function RecurringRulesTable({ rules, loading }: RecurringRulesTableProps) {
    const { toast } = useToast();
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    // Dialog state
    const [confirmDialog, setConfirmDialog] = useState<{
        open: boolean;
        title: string;
        description: string;
        action: () => Promise<void>;
    }>({
        open: false,
        title: "",
        description: "",
        action: async () => { },
    });

    const handleStatusUpdate = async (id: string, newStatus: RecurringRuleStatus) => {
        setActionLoading(id);
        const result = await updateRecurringRuleStatusAction(id, newStatus);
        if (result.success) {
            toast({ title: "Status atualizado com sucesso!" });
        } else {
            toast({
                title: "Erro ao atualizar status",
                description: result.error,
                variant: "destructive",
            });
        }
        setActionLoading(null);
        setConfirmDialog((prev) => ({ ...prev, open: false }));
    };

    const handleDelete = async (id: string) => {
        setActionLoading(id);
        const result = await deleteRecurringRuleAction(id);
        if (result.success) {
            toast({ title: "Fato gerador excluído com sucesso!" });
        } else {
            toast({
                title: "Erro ao excluir",
                description: result.error,
                variant: "destructive",
            });
        }
        setActionLoading(null);
        setConfirmDialog((prev) => ({ ...prev, open: false }));
    };

    const getStatusBadge = (status: RecurringRuleStatus) => {
        const styles: Record<RecurringRuleStatus, string> = {
            ATIVO: "bg-emerald-50 text-emerald-700 border-emerald-200",
            ENCERRADO: "bg-gray-50 text-gray-700 border-gray-200",
            RASCUNHO: "bg-amber-50 text-amber-700 border-amber-200",
        };
        const labels: Record<RecurringRuleStatus, string> = {
            ATIVO: "ATIVO",
            ENCERRADO: "ENCERRADO",
            RASCUNHO: "RASCUNHO",
        };

        return (
            <Badge
                variant="outline"
                className={cn(
                    "font-bold px-2 py-0.5 rounded-full text-[10px] tracking-wider uppercase whitespace-nowrap",
                    styles[status]
                )}
            >
                {labels[status]}
            </Badge>
        );
    };

    const formatValidity = (start: string, end?: string | null) => {
        const startDate = new Date(start).toLocaleDateString("pt-BR");
        if (!end) return `${startDate} → Sem fim`;
        const endDate = new Date(end).toLocaleDateString("pt-BR");
        return `${startDate} → ${endDate}`;
    };

    const formatCurrency = (val?: number | null) => {
        if (!val) return "—";
        return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    };

    if (loading) {
        return (
            <div className="h-64 flex items-center justify-center text-gray-500 uppercase tracking-widest text-xs font-bold">
                Carregando dados...
            </div>
        );
    }

    if (rules.length === 0) {
        return (
            <div className="h-64 flex flex-col items-center justify-center text-gray-400 gap-2">
                <Calendar className="w-12 h-12 opacity-20" />
                <span className="text-sm font-medium">Nenhum fato gerador encontrado</span>
            </div>
        );
    }

    return (
        <div className="relative overflow-x-auto">
            <Table>
                <TableHeader>
                    <TableRow className="bg-gray-50/40 hover:bg-gray-50/40 border-b border-gray-200">
                        <TableHead className="pl-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">
                            Fato Gerador / Fornecedor
                        </TableHead>
                        <TableHead className="py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">
                            Tipo / Valor
                        </TableHead>
                        <TableHead className="py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">
                            Modo de Geração
                        </TableHead>
                        <TableHead className="py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">
                            Vigência
                        </TableHead>
                        <TableHead className="py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">
                            Status
                        </TableHead>
                        <TableHead className="pr-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">
                            Ações
                        </TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {rules.map((rule) => (
                        <TableRow key={rule.id} className="hover:bg-gray-50/50 transition-colors border-b-gray-50">
                            <TableCell className="pl-6 py-4">
                                <div className="flex flex-col">
                                    <span className="text-sm font-bold text-gray-900 leading-tight">
                                        {rule.name}
                                    </span>
                                    <span className="text-[11px] text-gray-400 flex items-center gap-1 mt-0.5">
                                        <User className="w-3 h-3" /> {toTitleCase(rule.partner_name)}
                                    </span>
                                </div>
                            </TableCell>
                            <TableCell className="py-4">
                                <div className="flex flex-col">
                                    <span className={cn(
                                        "text-[10px] font-bold px-1.5 py-0.5 rounded-md w-fit mb-1",
                                        rule.amount_type === 'FIXO' ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : "bg-purple-50 text-purple-600 border border-purple-100"
                                    )}>
                                        {rule.amount_type === 'FIXO' ? 'FIXO' : 'VARIÁVEL'}
                                    </span>
                                    <span className="text-sm font-medium text-gray-700">
                                        {rule.amount_type === 'FIXO' ? formatCurrency(rule.fixed_amount) : formatCurrency(rule.estimated_amount)}
                                    </span>
                                </div>
                            </TableCell>
                            <TableCell className="py-4 font-medium text-gray-700">
                                <div className="flex flex-col">
                                    <span className="text-xs text-gray-700">
                                        {rule.generation_mode === 'MANUAL' ? 'Manual' : (rule.billing_plan_type === 'RECORRENTE' ? 'Recorrente' : `Parcelado (${rule.installments_count}x)`)}
                                    </span>
                                    {rule.first_due_date && (
                                        <span className="text-[10px] text-gray-400">
                                            1º Venc: {new Date(rule.first_due_date).toLocaleDateString('pt-BR')}
                                        </span>
                                    )}
                                </div>
                            </TableCell>
                            <TableCell className="py-4 text-xs font-medium text-gray-500 tabular-nums">
                                {formatValidity(rule.valid_from, rule.valid_to)}
                            </TableCell>
                            <TableCell className="py-4 text-center">
                                {getStatusBadge(rule.status)}
                            </TableCell>
                            <TableCell className="pr-6 py-4 text-right">
                                <div className="flex items-center justify-end gap-1">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 w-8 p-0 text-gray-400 hover:text-gray-900"
                                        title="Editar"
                                    >
                                        <Edit2 className="w-4 h-4" />
                                    </Button>

                                    {rule.status === "ATIVO" && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 w-8 p-0 text-gray-400 hover:text-amber-600"
                                            title="Encerrar"
                                            onClick={() => setConfirmDialog({
                                                open: true,
                                                title: "Encerrar Fato Gerador?",
                                                description: `Deseja encerrar "${rule.name}"? Não serão gerados novos lançamentos automaticamente.`,
                                                action: () => handleStatusUpdate(rule.id, "ENCERRADO")
                                            })}
                                        >
                                            <PowerOff className="w-4 h-4" />
                                        </Button>
                                    )}

                                    {rule.status === "ENCERRADO" && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 w-8 p-0 text-gray-400 hover:text-emerald-600"
                                            title="Reativar"
                                            onClick={() => setConfirmDialog({
                                                open: true,
                                                title: "Reativar Fato Gerador?",
                                                description: `Deseja reativar "${rule.name}"?`,
                                                action: () => handleStatusUpdate(rule.id, "ATIVO")
                                            })}
                                        >
                                            <Power className="w-4 h-4" />
                                        </Button>
                                    )}

                                    {rule.status === "RASCUNHO" && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 w-8 p-0 text-gray-400 hover:text-red-600"
                                            title="Excluir"
                                            onClick={() => setConfirmDialog({
                                                open: true,
                                                title: "Excluir Rascunho?",
                                                description: `Deseja excluir permanentemente o rascunho "${rule.name}"?`,
                                                action: () => handleDelete(rule.id)
                                            })}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    )}
                                </div>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>

            <AlertDialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog(prev => ({ ...prev, open }))}>
                <AlertDialogContent className="rounded-2xl border-none shadow-xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>{confirmDialog.title}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {confirmDialog.description}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmDialog.action}
                            className="bg-blue-600 hover:bg-blue-700 rounded-xl"
                        >
                            Confirmar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
