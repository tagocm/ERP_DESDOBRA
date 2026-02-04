"use client";

import * as React from "react";
import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabaseBrowser";
import { ArTitle } from "@/types/financial";
import { Card } from "@/components/ui/Card";
import { CardHeaderStandard } from "@/components/ui/CardHeaderStandard";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/Badge";
import { Checkbox } from "@/components/ui/Checkbox";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/Select";
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
import { ChevronDown, CheckCircle, Loader2, Search, Filter, LayoutGrid, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { formatCurrency, toTitleCase, cn } from "@/lib/utils";
import { ApprovalRowExpanded } from "./ApprovalRowExpanded";
import { getFinancialBadgeStyle } from "@/lib/constants/statusColors";
import { normalizeFinancialStatus } from "@/lib/constants/status";

export function ApprovalTable({ companyId }: { companyId: string }) {
    const [postings, setPostings] = useState<ArTitle[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

    const [filterStatus, setFilterStatus] = useState<string>("PENDING_APPROVAL");
    const [searchQuery, setSearchQuery] = useState("");
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

    const { toast } = useToast();
    const supabase = createClient();

    // Stats for Cards
    const totalPending = postings.filter(p => p.status === 'PENDING_APPROVAL').reduce((s, c) => s + Number(c.amount_total), 0);
    const totalSelected = postings.filter(p => selectedIds.has(p.id)).reduce((s, c) => s + (Number(c.amount_total) || 0), 0);

    // Batch Action States
    const [isApproving, setIsApproving] = useState(false);
    const [showApproveDialog, setShowApproveDialog] = useState(false);

    const fetchPostings = async () => {
        setLoading(true);
        let query = supabase
            .from('ar_titles')
            .select(`
                *,
                sales_document:sales_documents(id, document_number, status_logistic, financial_status),
                organization:organizations!customer_id(id, trade_name, legal_name),
                ar_installments(due_date)
            `)
            .eq('company_id', companyId)
            .order('created_at', { ascending: false });

        if (filterStatus && filterStatus !== 'ALL') {
            query = query.eq('status', filterStatus);
        } else if (filterStatus === 'ALL') {
            query = query.neq('status', 'CANCELLED');
        }

        const { data, error } = await query;

        if (error) {
            console.error('Error fetching AR titles:', JSON.stringify(error, null, 2));
            toast({ title: "Erro ao carregar lançamentos", variant: "destructive" });
        } else {
            let filtered = data as unknown as ArTitle[];
            if (searchQuery) {
                const lower = searchQuery.toLowerCase();
                filtered = filtered.filter(p =>
                    p.organization?.trade_name.toLowerCase().includes(lower) ||
                    p.organization?.legal_name?.toLowerCase().includes(lower) ||
                    String(p.document_number).includes(lower) ||
                    String(p.sales_document?.document_number).includes(lower)
                );
            }
            setPostings(filtered);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchPostings();
    }, [filterStatus, searchQuery]);

    // Sorting Logic
    const handleSort = (key: string) => {
        setSortConfig(current => {
            if (current?.key === key) {
                return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
            }
            return { key, direction: 'asc' };
        });
    };

    // Helper to get raw first due date for sorting
    const getFirstDueDate = (p: ArTitle) => {
        if (!p.ar_installments || p.ar_installments.length === 0) return 0;
        const dates = p.ar_installments.map(i => new Date(i.due_date).getTime());
        return Math.min(...dates);
    };

    const sortedPostings = useMemo(() => {
        if (!sortConfig) return postings;

        return [...postings].sort((a, b) => {
            let aVal: any = '';
            let bVal: any = '';

            switch (sortConfig.key) {
                case 'document':
                    aVal = a.document_number || a.sales_document?.document_number || 0;
                    bVal = b.document_number || b.sales_document?.document_number || 0;
                    break;
                case 'client':
                    aVal = (a.organization?.trade_name || a.organization?.legal_name || '').toLowerCase();
                    bVal = (b.organization?.trade_name || b.organization?.legal_name || '').toLowerCase();
                    break;
                case 'date_issued':
                    aVal = new Date(a.date_issued || 0).getTime();
                    bVal = new Date(b.date_issued || 0).getTime();
                    break;
                case 'total':
                    aVal = Number(a.amount_total || 0);
                    bVal = Number(b.amount_total || 0);
                    break;
                case 'terms':
                    aVal = (a.payment_terms_snapshot || '').toLowerCase();
                    bVal = (b.payment_terms_snapshot || '').toLowerCase();
                    break;
                case 'flow': // Payment Method
                    aVal = (a.payment_method_snapshot || '').toLowerCase();
                    bVal = (b.payment_method_snapshot || '').toLowerCase();
                    break;
                case 'installments_count':
                    aVal = a.ar_installments?.length || 0;
                    bVal = b.ar_installments?.length || 0;
                    break;
                case 'due_date':
                    aVal = getFirstDueDate(a);
                    bVal = getFirstDueDate(b);
                    break;
                case 'status':
                    aVal = a.status;
                    bVal = b.status;
                    break;
                default:
                    return 0;
            }

            if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [postings, sortConfig]);

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedIds(new Set(postings.filter(p => p.status === 'PENDING_APPROVAL').map(p => p.id)));
        } else {
            setSelectedIds(new Set());
        }
    };

    const handleSelectOne = (id: string, checked: boolean) => {
        const newSet = new Set(selectedIds);
        if (checked) newSet.add(id);
        else newSet.delete(id);
        setSelectedIds(newSet);
    };

    const toggleExpand = (id: string) => {
        const newSet = new Set(expandedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setExpandedIds(newSet);
    };

    // --- Actions ---

    const handleBatchApprove = async () => {
        setIsApproving(true);
        try {
            const response = await fetch('/api/finance/postings/approve-batch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: Array.from(selectedIds) })
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Erro ao aprovar');
            }
            const result = await response.json();

            toast({ title: "Aprovação concluída", description: `${result.approved} itens aprovados.` });
            setSelectedIds(new Set());
            setShowApproveDialog(false);
            fetchPostings();
        } catch (error: any) {
            toast({ title: "Erro na aprovação", description: error.message, variant: "destructive" });
        } finally {
            setIsApproving(false);
        }
    };

    const handleSingleApprove = async (id: string) => {
        try {
            const response = await fetch('/api/finance/postings/approve-batch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: [id] })
            });
            if (!response.ok) throw new Error('Erro ao aprovar');
            toast({ title: "Lançamento aprovado com sucesso!" });
            fetchPostings();
        } catch (e) {
            toast({ title: "Erro na aprovação", variant: "destructive" });
        }
    };

    const handleDeleteTitle = async (id: string) => {
        try {
            const response = await fetch(`/api/finance/titles/${id}`, {
                method: 'DELETE'
            });
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Erro ao excluir');
            }
            toast({ title: "Lançamento excluído com sucesso." });
            fetchPostings();
        } catch (error: any) {
            toast({ title: "Erro na exclusão", description: error.message, variant: "destructive" });
        }
    };

    const getStatusBadge = (status: string) => {
        const styles: any = {
            PENDING_APPROVAL: "bg-amber-50 text-amber-700 border-amber-200",
            OPEN: "bg-blue-50 text-blue-700 border-blue-200",
            PAID: "bg-emerald-50 text-emerald-700 border-emerald-200",
            CANCELLED: "bg-gray-50 text-gray-700 border-gray-200",
            PARTIAL: "bg-indigo-50 text-indigo-700 border-indigo-200",
        };
        const labels: any = {
            PENDING_APPROVAL: "Pendente",
            OPEN: "Aberto",
            PAID: "Liquidado",
            CANCELLED: "Cancelado",
            PARTIAL: "Parcial",
        };
        return <Badge variant="outline" className={`${styles[status] || "bg-gray-100"} font-bold px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider whitespace-nowrap`}>
            {labels[status] || status}
        </Badge>;
    };

    const getInstallmentInfo = (posting: any) => {
        const insts = posting.ar_installments || [];
        if (insts.length === 0) return { count: 0, first: '-' };
        const sorted = [...insts].sort((a: any, b: any) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
        const first = new Date(sorted[0].due_date).toLocaleDateString('pt-BR');
        return { count: insts.length, first };
    };

    // Helper Component for Sortable Header
    const SortableHead = ({ label, sortKey, className = "" }: { label: string, sortKey: string, className?: string }) => {
        const isActive = sortConfig?.key === sortKey;
        return (
            <TableHead
                className={cn("cursor-pointer hover:bg-gray-100 transition-colors select-none group h-10", className)}
                onClick={() => handleSort(sortKey)}
            >
                <div className={cn("flex items-center gap-1.5", className?.includes("text-right") && "justify-end", className?.includes("text-center") && "justify-center")}>
                    {label}
                    <div className="flex flex-col items-center justify-center w-3">
                        {isActive ? (
                            sortConfig?.direction === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-600" /> : <ArrowDown className="w-3 h-3 text-blue-600" />
                        ) : (
                            <ArrowUpDown className="w-3 h-3 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                        )}
                    </div>
                </div>
            </TableHead>
        );
    };

    return (
            <div className="space-y-6 animate-in fade-in duration-700">
                {/* Top Stats Row */}
                <div className="flex flex-col sm:flex-row gap-4">
                <Card className="flex-1 p-4 border-gray-100 flex flex-col gap-1 relative overflow-hidden group hover:border-blue-200 transition-all">
                    <span className="text-[10px] uppercase font-black text-gray-400 tracking-widest pl-1">Total Pendente</span>
                    <div className="text-2xl font-black text-gray-900 tabular-nums">
                        {formatCurrency(totalPending)}
                    </div>
                    <div className="absolute -right-6 -top-6 bg-blue-50 w-24 h-24 rounded-full opacity-50 group-hover:scale-110 transition-transform" />
                </Card>
                <Card className="flex-1 p-4 border-gray-100 flex flex-col gap-1 relative overflow-hidden group hover:border-blue-200 transition-all">
                    <span className="text-[10px] uppercase font-black text-gray-400 tracking-widest pl-1">Seleção Ativa</span>
                    <div className={`text-2xl font-black tabular-nums ${selectedIds.size > 0 ? 'text-blue-600' : 'text-gray-300'}`}>
                        {formatCurrency(totalSelected)}
                    </div>
                    <div className="absolute -right-6 -top-6 bg-blue-50 w-24 h-24 rounded-full opacity-50 group-hover:scale-110 transition-transform" />
                </Card>
                </div>

            <Card>
                <CardHeaderStandard
                    title="Fluxo de Aprovação"
                    description="Revise e valide lançamentos financeiros antes de efetivá-los."
                    icon={<LayoutGrid className="w-5 h-5" />}
                    actions={
                        selectedIds.size > 0 && (
                            <div className="flex items-center gap-2 animate-in slide-in-from-right-4 bg-blue-50/50 p-1.5 rounded-2xl border border-blue-100/50">
                                <span className="text-xs font-bold text-blue-700 px-2">
                                    {selectedIds.size} selecionados
                                </span>
                                <Button
                                    size="sm"
                                    className="h-8 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white"
                                    onClick={() => setShowApproveDialog(true)}
                                >
                                    <CheckCircle className="w-3.5 h-3.5 mr-1.5" /> Aprovar
                                </Button>
                            </div>
                        )
                    }
                />

                {/* Embedded Toolbar */}
                <div className="px-6 pb-6 border-b border-gray-100 flex flex-col sm:flex-row gap-4 justify-between items-center">
                    <div className="relative w-full sm:w-auto flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <Input
                            placeholder="Buscar cliente ou pedido..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 h-10 w-full bg-gray-50/50 border-gray-200 focus:bg-white transition-colors"
                        />
                    </div>
                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                        <SelectTrigger className="w-full sm:w-44 h-10 bg-white border-gray-200">
                            <Filter className="w-4 h-4 mr-2 text-gray-500" />
                            <SelectValue placeholder="Filtrar Status" />
                        </SelectTrigger>
                        <SelectContent align="end">
                            <SelectItem value="PENDING_APPROVAL">Pendentes</SelectItem>
                            <SelectItem value="APPROVED">Aprovados</SelectItem>
                            <SelectItem value="ALL">Todos</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="relative">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-gray-50/40 hover:bg-gray-50/40 border-b border-gray-200">
                                <TableHead className="w-12 text-center"></TableHead>
                                <TableHead className="w-12">
                                    <Checkbox
                                        checked={postings.length > 0 && selectedIds.size === postings.filter(p => p.status === 'PENDING_APPROVAL').length}
                                        onCheckedChange={(checked) => handleSelectAll(checked as boolean)}
                                        className="translate-y-[2px]"
                                    />
                                </TableHead>
                                <SortableHead sortKey="document" label="Documento" className="w-32" />
                                <SortableHead sortKey="client" label="Cliente Parceiro" />
                                <SortableHead sortKey="date_issued" label="Lançado em" className="w-32" />
                                <SortableHead sortKey="total" label="Total" className="w-36" />
                                <SortableHead sortKey="terms" label="Condição" className="w-24" />
                                <SortableHead sortKey="flow" label="Fluxo" className="w-24" />
                                <SortableHead sortKey="installments_count" label="Parc." className="w-20 text-center" />
                                <SortableHead sortKey="due_date" label="Vencimento" className="w-32" />
                                <TableHead className="w-36 text-center">Status Pedido</TableHead>
                                <SortableHead sortKey="status" label="Status Pagamento" className="w-40 text-right" />
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={12} className="h-64 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <Loader2 className="h-8 w-8 animate-spin text-blue-500/30" />
                                            <span className="text-xs font-medium text-gray-400 uppercase tracking-widest">Carregando...</span>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : sortedPostings.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={12} className="h-64 text-center">
                                        <div className="flex flex-col items-center gap-2 opacity-50">
                                            <LayoutGrid className="w-10 h-10 text-gray-300" />
                                            <span className="text-sm font-medium text-gray-500">Nenhum registro encontrado</span>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                sortedPostings.map((posting) => {
                                    const isExpanded = expandedIds.has(posting.id);
                                    const instInfo = getInstallmentInfo(posting);
                                    const isPending = posting.status === 'PENDING_APPROVAL';

                                    return (
                                        <React.Fragment key={posting.id}>
                                            <TableRow
                                                className={cn(
                                                    "cursor-pointer transition-colors border-b-gray-50",
                                                    isExpanded ? 'bg-blue-50/30' : 'hover:bg-gray-50/50'
                                                )}
                                                onClick={() => toggleExpand(posting.id)}
                                            >
                                                <TableCell className="text-center pl-4 py-3">
                                                    <div
                                                        className={cn(
                                                            "w-6 h-6 rounded-full flex items-center justify-center transition-all duration-300",
                                                            isExpanded ? 'bg-blue-100 text-blue-600 rotate-180' : 'text-gray-300 hover:bg-gray-100 hover:text-gray-500'
                                                        )}
                                                    >
                                                        <ChevronDown className="h-4 w-4" />
                                                    </div>
                                                </TableCell>
                                                <TableCell onClick={(e) => e.stopPropagation()} className="py-3">
                                                    <Checkbox
                                                        checked={selectedIds.has(posting.id)}
                                                        onCheckedChange={(checked) => handleSelectOne(posting.id, checked as boolean)}
                                                        disabled={!isPending}
                                                        className="translate-y-[2px]"
                                                    />
                                                </TableCell>
                                                <TableCell className="py-3">
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-bold text-gray-900">
                                                            #{posting.document_number || posting.sales_document?.document_number}
                                                        </span>
                                                        <span className="text-[10px] text-gray-400 font-medium uppercase">Financiero</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="w-48 py-3">
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-medium text-gray-700 truncate" title={posting.organization?.legal_name || ""}>
                                                            {toTitleCase(posting.organization?.trade_name || posting.organization?.legal_name || 'Não identificado')}
                                                        </span>
                                                        <span className="text-[10px] text-gray-400">CNPJ/CPF: {posting.organization?.id?.slice(0, 8)}...</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-gray-500 font-medium text-xs py-3">
                                                    {posting.date_issued ? new Date(posting.date_issued).toLocaleDateString('pt-BR') : '-'}
                                                </TableCell>
                                                <TableCell className="py-3">
                                                    <span className="text-sm font-bold text-gray-900 tabular-nums">
                                                        {formatCurrency(posting.amount_total)}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="py-3">
                                                    <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full truncate block uppercase">
                                                        {posting.payment_terms_snapshot || '-'}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="py-3">
                                                    <span className="text-[10px] font-bold text-blue-600 uppercase">
                                                        {posting.payment_method_snapshot || '-'}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-center py-3">
                                                    <span className="text-xs text-gray-500 font-medium">
                                                        {instInfo.count > 0 ? `${instInfo.count}x` : '-'}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-gray-500 font-medium text-xs py-3">
                                                    {instInfo.first}
                                                </TableCell>
                                                <TableCell className="text-center py-3">
                                                    <span className={cn(
                                                        "inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                                                        getFinancialBadgeStyle(normalizeFinancialStatus(posting.sales_document?.financial_status) || posting.sales_document?.financial_status || 'pending').bg,
                                                        getFinancialBadgeStyle(normalizeFinancialStatus(posting.sales_document?.financial_status) || posting.sales_document?.financial_status || 'pending').text
                                                    )}>
                                                        {getFinancialBadgeStyle(normalizeFinancialStatus(posting.sales_document?.financial_status) || posting.sales_document?.financial_status || 'pending').label}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-right py-3 pr-4">
                                                    {getStatusBadge(posting.status)}
                                                </TableCell>
                                            </TableRow>

                                            {isExpanded && (
                                                <TableRow className="bg-transparent border-none hover:bg-transparent">
                                                    <TableCell colSpan={12} className="p-0 border-none bg-blue-50/10">
                                                        <div className="px-4 pb-6 pt-2 animate-in slide-in-from-top-2 duration-300">
                                                            <ApprovalRowExpanded
                                                                title={posting}
                                                                onRefresh={fetchPostings}
                                                                onApprove={handleSingleApprove}
                                                                onDeleteTitle={handleDeleteTitle}
                                                            />
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </React.Fragment>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </div>
            </Card>

            <AlertDialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
                <AlertDialogContent className="rounded-2xl border-none shadow-float">
                    <AlertDialogHeader>
                        <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mb-2 mx-auto sm:mx-0">
                            <CheckCircle className="w-6 h-6 text-blue-600" />
                        </div>
                        <AlertDialogTitle>Confirmar Aprovação?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Você está aprovando <b>{selectedIds.size} lançamentos</b>. Isso irá gerar os títulos no Contas a Receber.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleBatchApprove}
                            disabled={isApproving}
                            className="bg-blue-600 hover:bg-blue-700"
                        >
                            {isApproving ? "Processando..." : "Sim, Aprovar"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
