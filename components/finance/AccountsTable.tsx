"use client";

import * as React from "react";
import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabaseBrowser";
import { ArInstallment } from "@/types/financial";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/Badge";
import { Search, ChevronDown, Layers, ArrowUpCircle, ArrowDownCircle, ExternalLink, List, Package, X, Loader2, Download, CheckCircle } from "lucide-react";
import { formatCurrency, toTitleCase, cn } from "@/lib/utils";
import { AccountsInstallmentRowExpanded } from "./AccountsInstallmentRowExpanded";
import { AccountsGroupRow, GroupedOrder } from "./AccountsGroupRow";
import { BulkSettleModal } from "./BulkSettleModal";
import { startOfMonth, endOfMonth } from "date-fns";
import { DateRange } from "react-day-picker";
import { DateRangeFilter } from "@/components/ui/date-range-filter";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/Select";
import Link from "next/link";
import { Label } from "@/components/ui/Label";
import { Checkbox } from "@/components/ui/Checkbox";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/use-toast";

type Direction = 'IN' | 'OUT' | 'ALL';
type ViewMode = 'INSTALLMENT' | 'ORDER';

export function AccountsTable({ companyId }: { companyId: string }) {
    const { toast } = useToast();
    const [direction, setDirection] = useState<Direction>('IN');
    const [installments, setInstallments] = useState<ArInstallment[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

    // View Mode
    const [viewMode, setViewMode] = useState<ViewMode>('INSTALLMENT');

    // Selection State
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Bulk Settle State
    const [showBulkSettleModal, setShowBulkSettleModal] = useState(false);
    const [isBulkSettling, setIsBulkSettling] = useState(false);

    // Filters
    const [statusFilter, setStatusFilter] = useState('OPEN');
    // New: Date Type Filter
    const [dateTypeFilter, setDateTypeFilter] = useState<'DUE' | 'ISSUE'>('DUE');
    const [dateRange, setDateRange] = useState<DateRange | undefined>({
        from: startOfMonth(new Date()),
        to: endOfMonth(new Date())
    });

    const supabase = createClient();

    useEffect(() => {
        const savedMode = localStorage.getItem('finance_accounts_view_mode') as ViewMode;
        if (savedMode) setViewMode(savedMode);
    }, []);

    const handleViewModeChange = (mode: ViewMode) => {
        setViewMode(mode);
        localStorage.setItem('finance_accounts_view_mode', mode);
    };

    const fetchInstallments = async () => {
        if (direction === 'OUT') {
            setInstallments([]);
            return;
        }

        setLoading(true);

        // We filter ar_installments by ar_title.company_id = companyId
        // This requires !inner join on ar_title to enforce the filter.
        let query = supabase
            .from('ar_installments')
            .select(`
                *,
                ar_title:ar_titles!inner(
                    id, 
                    document_number, 
                    status,
                    amount_total,
                    amount_paid,
                    amount_open,
                    date_issued,
                    attention_status,
                    company_id,
                    sales_document:sales_documents(id, document_number),
                    organization:organizations!customer_id(id, trade_name, legal_name)
                ),
                ar_payment_allocations(
                    id, amount_allocated, 
                    ar_payments(*)
                )
            `)
            .eq('ar_title.company_id', companyId);

        if (statusFilter !== 'ALL') {
            if (statusFilter === 'OPEN') query = query.in('status', ['OPEN', 'PARTIAL']);
            else query = query.eq('status', statusFilter);
        }

        if (dateRange?.from) {
            const from = new Date(dateRange.from);
            from.setHours(0, 0, 0, 0);

            const to = dateRange.to ? new Date(dateRange.to) : new Date(dateRange.from);
            to.setHours(23, 59, 59, 999);

            if (dateTypeFilter === 'DUE') {
                query = query.gte('due_date', from.toISOString()).lte('due_date', to.toISOString());
                query = query.order('due_date', { ascending: true });
            } else {
                // Filter by ar_title.date_issued
                // Since we use !inner on ar_title, we can filter by its columns
                query = query.filter('ar_title.date_issued', 'gte', from.toISOString())
                    .filter('ar_title.date_issued', 'lte', to.toISOString());

                query = query.order('due_date', { ascending: true });
            }
        } else {
            query = query.order('due_date', { ascending: true });
        }

        const { data, error } = await query;

        if (!error && data) {
            let filtered = data as unknown as ArInstallment[];
            filtered = filtered.filter(i => i.ar_title?.status !== 'PENDING_APPROVAL');

            if (searchQuery) {
                const lower = searchQuery.toLowerCase();
                filtered = filtered.filter(i =>
                    i.ar_title?.organization?.trade_name.toLowerCase().includes(lower) ||
                    i.ar_title?.organization?.legal_name?.toLowerCase().includes(lower) ||
                    String(i.ar_title?.document_number).includes(lower) ||
                    String(i.ar_title?.sales_document?.document_number).includes(lower)
                );
            }
            setInstallments(filtered);
        }
        setLoading(false);
    };

    useEffect(() => {
        setSelectedIds(new Set());
        fetchInstallments();
    }, [direction, statusFilter, dateRange, dateTypeFilter]);

    // Grouping Logic
    const groupedOrders = useMemo(() => {
        if (viewMode !== 'ORDER') return [];

        const groups = new Map<string, GroupedOrder>();

        installments.forEach(inst => {
            if (!inst.ar_title) return;
            const titleId = inst.ar_title.id;

            if (!groups.has(titleId)) {
                let groupStatus: 'OPEN' | 'PARTIAL' | 'PAID' = 'OPEN';
                if (inst.ar_title.status === 'PAID') groupStatus = 'PAID';
                else if (inst.ar_title.status === 'PARTIAL') groupStatus = 'PARTIAL';
                else groupStatus = 'OPEN';

                groups.set(titleId, {
                    id: titleId,
                    document_number: Number(inst.ar_title.document_number || 0),
                    organization_name: inst.ar_title.organization?.trade_name || inst.ar_title.organization?.legal_name || 'Desconhecido',
                    issue_date: inst.ar_title.date_issued,
                    amount_total: inst.ar_title.amount_total,
                    amount_paid: inst.ar_title.amount_paid,
                    amount_open: inst.ar_title.amount_open,
                    status: groupStatus,
                    installments: [],
                    next_due_date: undefined
                });
            }

            const group = groups.get(titleId)!;
            group.installments.push(inst);
        });

        const result = Array.from(groups.values()).map(group => {
            group.installments.sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
            const openInst = group.installments.find(i => i.status === 'OPEN' || i.status === 'PARTIAL' || i.status === 'OVERDUE');
            group.next_due_date = openInst ? openInst.due_date : undefined;
            return group;
        });

        result.sort((a, b) => {
            const dateA = a.next_due_date || a.issue_date || '';
            const dateB = b.next_due_date || b.issue_date || '';
            return new Date(dateA).getTime() - new Date(dateB).getTime();
        });

        return result;

    }, [installments, viewMode]);


    const toggleExpand = (id: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        const newSet = new Set(expandedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setExpandedIds(newSet);
    };

    // --- Selection Handlers ---

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            const allIds = installments.map(i => i.id);
            setSelectedIds(new Set(allIds));
        } else {
            setSelectedIds(new Set());
        }
    };

    const handleSelect = (id: string, checked: boolean) => {
        const newSet = new Set(selectedIds);
        if (checked) newSet.add(id);
        else newSet.delete(id);
        setSelectedIds(newSet);
    };

    const handleToggleGroup = (ids: string[], checked: boolean) => {
        const newSet = new Set(selectedIds);
        ids.forEach(id => {
            if (checked) newSet.add(id);
            else newSet.delete(id);
        });
        setSelectedIds(newSet);
    };

    const clearSelection = () => setSelectedIds(new Set());

    const isAllSelected = installments.length > 0 && selectedIds.size === installments.length;
    const isIndeterminate = selectedIds.size > 0 && selectedIds.size < installments.length;

    // --- Bulk Settle Handler ---
    const handleConfirmBulkSettle = async (date: string, accountId: string, validIds: string[]) => {
        setIsBulkSettling(true);
        try {
            const response = await fetch('/api/finance/bulk-settle', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    installmentIds: validIds,
                    date,
                    accountId
                })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Erro ao realizar baixa');
            }

            toast({
                title: "Baixa em Lote Concluída",
                description: result.message,
                variant: "default"
            });

            if (result.errors && result.errors.length > 0) {
                // Optionally show detailed errors in a toast or modal
                console.warn("Errors during bulk settle:", result.errors);
            }

            setShowBulkSettleModal(false);
            setSelectedIds(new Set()); // Clear selection
            fetchInstallments(); // Refresh

        } catch (error: any) {
            toast({
                title: "Erro na Baixa",
                description: error.message,
                variant: 'destructive'
            });
        } finally {
            setIsBulkSettling(false);
        }
    };


    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'OPEN': return <Badge variant="outline" className="text-blue-600 bg-blue-50 border-blue-200">Aberta</Badge>;
            case 'PARTIAL': return <Badge variant="outline" className="text-orange-600 bg-orange-50 border-orange-200">Parcial</Badge>;
            case 'PAID': return <Badge variant="outline" className="text-green-600 bg-green-50 border-green-200">Paga</Badge>;
            case 'OVERDUE': return <Badge variant="outline" className="text-red-600 bg-red-50 border-red-200">Vencida</Badge>;
            default: return <Badge variant="outline">{status}</Badge>;
        }
    };

    return (
        <div className="space-y-6">
            <BulkSettleModal
                open={showBulkSettleModal}
                onOpenChange={setShowBulkSettleModal}
                selectedIds={selectedIds}
                installments={installments}
                onConfirm={handleConfirmBulkSettle}
                isProcessing={isBulkSettling}
            />

            {/* Top Controls: Type + Status */}
            <div className="flex flex-col items-center gap-4">
                <div className="flex items-center gap-8 bg-gray-100/50 p-1.5 rounded-2xl border border-gray-100">
                    {/* Direction Buttons */}
                    <div className="flex gap-1">
                        <button
                            onClick={() => setDirection('IN')}
                            className={cn(
                                "px-5 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-2",
                                direction === 'IN'
                                    ? "bg-white text-emerald-700 ring-1 ring-black/5"
                                    : "text-gray-500 hover:text-gray-900 hover:bg-white/50"
                            )}
                        >
                            <ArrowDownCircle className="w-4 h-4" /> A RECEBER
                        </button>
                        <button
                            onClick={() => setDirection('OUT')}
                            className={cn(
                                "px-5 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-2",
                                direction === 'OUT'
                                    ? "bg-white text-rose-700 ring-1 ring-black/5"
                                    : "text-gray-500 hover:text-gray-900 hover:bg-white/50"
                            )}
                        >
                            <ArrowUpCircle className="w-4 h-4" /> A PAGAR
                        </button>
                        <button
                            onClick={() => setDirection('ALL')}
                            className={cn(
                                "px-5 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-2",
                                direction === 'ALL'
                                    ? "bg-white text-blue-700 ring-1 ring-black/5"
                                    : "text-gray-500 hover:text-gray-900 hover:bg-white/50"
                            )}
                        >
                            <Layers className="w-4 h-4" /> TODOS
                        </button>
                    </div>

                    <div className="h-6 w-px bg-gray-300"></div>

                    {/* Status Buttons (New) */}
                    <div className="flex gap-1">
                        <button
                            onClick={() => setStatusFilter('OPEN')}
                            className={cn(
                                "px-4 py-2 rounded-full text-xs font-bold transition-all",
                                statusFilter === 'OPEN'
                                    ? "bg-blue-100 text-blue-700"
                                    : "text-gray-500 hover:text-gray-900 hover:bg-white/50"
                            )}
                        >
                            EM ABERTO
                        </button>
                        <button
                            onClick={() => setStatusFilter('PAID')}
                            className={cn(
                                "px-4 py-2 rounded-full text-xs font-bold transition-all",
                                statusFilter === 'PAID'
                                    ? "bg-green-100 text-green-700"
                                    : "text-gray-500 hover:text-gray-900 hover:bg-white/50"
                            )}
                        >
                            PAGAS
                        </button>
                        <button
                            onClick={() => setStatusFilter('ALL')}
                            className={cn(
                                "px-4 py-2 rounded-full text-xs font-bold transition-all",
                                statusFilter === 'ALL'
                                    ? "bg-gray-200 text-gray-700"
                                    : "text-gray-500 hover:text-gray-900 hover:bg-white/50"
                            )}
                        >
                            TODAS
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <Card>
                {/* Filters Header w/ Toggle */}
                <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row gap-4 justify-between items-center bg-gray-50/30">
                    <div className="relative w-full md:w-64 lg:w-72">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <Input
                            placeholder="Buscar cliente, documento..."
                            className="pl-9 bg-white"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    <div className="flex flex-wrap items-center gap-4">
                        {/* View Mode Toggle */}
                        <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-full">
                            <Label className="text-[10px] font-bold text-gray-500 uppercase px-2">Visualização:</Label>
                            <button
                                onClick={() => handleViewModeChange('INSTALLMENT')}
                                className={cn(
                                    "px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5",
                                    viewMode === 'INSTALLMENT'
                                        ? "bg-white text-gray-900 ring-1 ring-black/5"
                                        : "text-gray-500 hover:text-gray-900"
                                )}
                            >
                                <List className="w-3.5 h-3.5" /> Por Parcela
                            </button>
                            <button
                                onClick={() => handleViewModeChange('ORDER')}
                                className={cn(
                                    "px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5",
                                    viewMode === 'ORDER'
                                        ? "bg-white text-gray-900 ring-1 ring-black/5"
                                        : "text-gray-500 hover:text-gray-900"
                                )}
                            >
                                <Package className="w-3.5 h-3.5" /> Agrupar
                            </button>
                        </div>

                        <div className="w-px h-8 bg-gray-200 hidden sm:block"></div>

                        <div className="flex gap-2">
                            {/* Date Type Selector (Replaces Status Selector) */}
                            <Select value={dateTypeFilter} onValueChange={(v: any) => setDateTypeFilter(v)}>
                                <SelectTrigger className="w-36 bg-white">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="DUE">Vencimento</SelectItem>
                                    <SelectItem value="ISSUE">Lançamento</SelectItem>
                                </SelectContent>
                            </Select>

                            <DateRangeFilter
                                date={dateRange}
                                onDateChange={setDateRange}
                            />
                        </div>
                    </div>
                </div>

                {/* Selection Bar */}
                {selectedIds.size > 0 && (
                    <div className="mx-4 mt-4 p-3 bg-blue-50 border border-blue-100 rounded-2xl flex items-center justify-between animate-in fade-in slide-in-from-top-2">
                        <div className="flex items-center gap-3">
                            <div className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-semibold">
                                {selectedIds.size} {selectedIds.size === 1 ? 'lançamento selecionado' : 'lançamentos selecionados'}
                            </div>

                            <div className="h-4 w-px bg-blue-200 mx-1"></div>

                            <Button
                                size="sm"
                                onClick={() => setShowBulkSettleModal(true)}
                                className="bg-green-600 hover:bg-green-700 text-white h-8 font-bold gap-2 text-xs rounded-full px-4"
                            >
                                <CheckCircle className="w-3.5 h-3.5" />
                                BAIXAR SELECIONADOS
                            </Button>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={clearSelection}
                            className="text-blue-700 hover:text-blue-800 hover:bg-blue-100 h-8 text-xs"
                        >
                            <X className="w-3.5 h-3.5 mr-2" />
                            Limpar seleção
                        </Button>
                    </div>
                )}

                {/* Empty State for OUT */}
                {direction === 'OUT' && (
                    <div className="flex flex-col items-center justify-center p-20 text-center opacity-60">
                        <ArrowUpCircle className="w-16 h-16 text-gray-300 mb-4" />
                        <h3 className="text-xl font-bold text-gray-900">Nenhuma conta a pagar encontrada</h3>
                        <p className="text-gray-500 max-w-md mt-2">
                            A seção de Compras/Despesas ainda não foi implementada. Em breve você verá contas a pagar aqui.
                        </p>
                    </div>
                )}

                {/* Table Content */}
                {direction !== 'OUT' && (
                    <div className="relative">
                        <Table>
                            {/* Conditional Header based on View Mode */}
                            <TableHeader>
                                {viewMode === 'INSTALLMENT' ? (
                                    <TableRow className="bg-gray-50/40 hover:bg-gray-50/40">
                                        <TableHead className="w-12"></TableHead>
                                        <TableHead className="w-12">
                                            <Checkbox
                                                checked={isAllSelected ? true : isIndeterminate ? "indeterminate" : false}
                                                onCheckedChange={handleSelectAll}
                                            />
                                        </TableHead>
                                        <TableHead>Parcela</TableHead>
                                        <TableHead>Pessoa</TableHead>
                                        <TableHead>Vencimento</TableHead>
                                        <TableHead>Valor</TableHead>
                                        <TableHead>Pago</TableHead>
                                        <TableHead>Saldo</TableHead>
                                        <TableHead>Modalidade</TableHead>
                                        <TableHead className="text-center">Situação</TableHead>
                                        <TableHead>Origem</TableHead>
                                    </TableRow>
                                ) : (
                                    <TableRow className="bg-gray-50/40 hover:bg-gray-50/40">
                                        <TableHead className="w-12"></TableHead>
                                        <TableHead className="w-12">
                                            <Checkbox
                                                checked={isAllSelected ? true : isIndeterminate ? "indeterminate" : false}
                                                onCheckedChange={handleSelectAll}
                                            />
                                        </TableHead>
                                        <TableHead>Pedido</TableHead>
                                        <TableHead>Pessoa</TableHead>
                                        <TableHead>Emissão</TableHead>
                                        <TableHead>Total</TableHead>
                                        <TableHead>Pago</TableHead>
                                        <TableHead>Em Aberto</TableHead>
                                        <TableHead>Próx. Venc.</TableHead>
                                        <TableHead className="text-center">Situação</TableHead>
                                    </TableRow>
                                )}
                            </TableHeader>

                            <TableBody>
                                {loading ? (
                                    <TableRow><TableCell colSpan={11} className="h-32 text-center text-gray-500">Carregando...</TableCell></TableRow>
                                ) : installments.length === 0 ? (
                                    <TableRow><TableCell colSpan={11} className="h-32 text-center text-gray-500">Nenhum registro encontrado.</TableCell></TableRow>
                                ) : (
                                    <>
                                        {viewMode === 'INSTALLMENT' ? (
                                            /* INSTALLMENT VIEW */
                                            installments.map(inst => {
                                                const isExpanded = expandedIds.has(inst.id);
                                                const isSelected = selectedIds.has(inst.id);
                                                return (
                                                    <React.Fragment key={inst.id}>
                                                        <TableRow
                                                            className={cn("cursor-pointer transition-colors",
                                                                isExpanded ? "bg-blue-50/30" : "hover:bg-gray-50",
                                                                isSelected && !isExpanded ? "bg-blue-50/20" : ""
                                                            )}
                                                            onClick={(e) => toggleExpand(inst.id, e)}
                                                        >
                                                            <TableCell>
                                                                <ChevronDown className={cn("w-4 h-4 transition-transform", isExpanded && "rotate-180")} />
                                                            </TableCell>
                                                            <TableCell onClick={e => e.stopPropagation()}>
                                                                <Checkbox
                                                                    checked={isSelected}
                                                                    onCheckedChange={(checked) => handleSelect(inst.id, checked as boolean)}
                                                                />
                                                            </TableCell>
                                                            <TableCell className="font-medium text-gray-900">
                                                                #{inst.ar_title?.document_number || 'ND'}-{inst.installment_number}
                                                            </TableCell>
                                                            <TableCell>
                                                                <div className="flex flex-col">
                                                                    <span className="font-medium truncate inline-block w-48">
                                                                        {toTitleCase(inst.ar_title?.organization?.trade_name || inst.ar_title?.organization?.legal_name || 'Desconhecido')}
                                                                    </span>
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="text-gray-900 font-medium">
                                                                {new Date(inst.due_date).toLocaleDateString('pt-BR')}
                                                            </TableCell>
                                                            <TableCell className="font-bold">{formatCurrency(inst.amount_original)}</TableCell>
                                                            <TableCell className="text-green-600">{formatCurrency(inst.amount_paid)}</TableCell>
                                                            <TableCell className="text-red-600">{formatCurrency(inst.amount_open)}</TableCell>
                                                            <TableCell className="text-xs uppercase text-gray-500 font-bold">
                                                                {inst.payment_method || '-'}
                                                            </TableCell>
                                                            <TableCell className="text-center">
                                                                {getStatusBadge(inst.status)}
                                                            </TableCell>
                                                            <TableCell>
                                                                {inst.ar_title?.sales_document ? (
                                                                    <Link
                                                                        href={`/app/vendas/pedidos/${inst.ar_title.sales_document.id}`}
                                                                        className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                                                                        onClick={e => e.stopPropagation()}
                                                                    >
                                                                        Ord #{inst.ar_title.sales_document.document_number} <ExternalLink className="w-3 h-3" />
                                                                    </Link>
                                                                ) : (
                                                                    <span className="text-xs text-gray-400">-</span>
                                                                )}
                                                            </TableCell>
                                                        </TableRow>
                                                        {isExpanded && (
                                                            <TableRow>
                                                                <TableCell colSpan={11} className="p-0 border-none bg-blue-50/10">
                                                                    <div className="px-10 py-4">
                                                                        <AccountsInstallmentRowExpanded installment={inst} onRefresh={fetchInstallments} />
                                                                    </div>
                                                                </TableCell>
                                                            </TableRow>
                                                        )}
                                                    </React.Fragment>
                                                );
                                            })
                                        ) : (
                                            /* ORDER VIEW (GROUPED) */
                                            groupedOrders.map(group => (
                                                <AccountsGroupRow
                                                    key={group.id}
                                                    group={group}
                                                    onRefresh={fetchInstallments}
                                                    selectedIds={selectedIds}
                                                    onToggleGroup={handleToggleGroup}
                                                    onToggleInstallment={handleSelect}
                                                />
                                            ))
                                        )}
                                    </>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </Card>
        </div>
    );
}
