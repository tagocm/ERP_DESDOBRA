"use client";

import * as React from "react";
import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabaseBrowser";
import { ArInstallment } from "@/types/financial";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/Badge";
import { Search, ChevronDown, Layers, ArrowUpCircle, ArrowDownCircle, ExternalLink, List, Package } from "lucide-react";
import { formatCurrency, toTitleCase, cn } from "@/lib/utils";
import { AccountsInstallmentRowExpanded } from "./AccountsInstallmentRowExpanded";
import { AccountsGroupRow, GroupedOrder } from "./AccountsGroupRow";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/Select";
import Link from "next/link";
import { Label } from "@/components/ui/Label";

type Direction = 'IN' | 'OUT' | 'ALL';
type ViewMode = 'INSTALLMENT' | 'ORDER';

export function AccountsTable() {
    const [direction, setDirection] = useState<Direction>('IN');
    const [installments, setInstallments] = useState<ArInstallment[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

    // View Mode
    const [viewMode, setViewMode] = useState<ViewMode>('INSTALLMENT');

    // Filters
    const [statusFilter, setStatusFilter] = useState('OPEN'); // Default Open
    const [dateFilter, setDateFilter] = useState('this_month'); // Default This Month

    const supabase = createClient();

    // Load View Mode Preference
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

        let query = supabase
            .from('ar_installments')
            .select(`
                *,
                ar_title:ar_titles(
                    id, 
                    document_number, 
                    status,
                    amount_total,
                    amount_paid,
                    amount_open,
                    date_issued,
                    attention_status,
                    sales_document:sales_documents(id, document_number),
                    organization:organizations!customer_id(id, trade_name, legal_name)
                ),
                ar_payment_allocations(
                    id, amount_allocated, 
                    ar_payments(*)
                )
            `)
            .not('ar_title', 'is', null);

        // Apply filters
        // NOTE: For 'ORDER' mode, we might want different filtering logic, but adhering to the constraint of reusing the query:
        // We filter the installments. If View Mode is Order, we group the resulting installments.
        if (statusFilter !== 'ALL') {
            if (statusFilter === 'OPEN') query = query.in('status', ['OPEN', 'PARTIAL']);
            else query = query.eq('status', statusFilter);
        }

        // Date Filter Logic
        const now = new Date();
        if (dateFilter === 'this_month') {
            const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
            const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();
            query = query.gte('due_date', start).lte('due_date', end);
        } else if (dateFilter === 'last_month') {
            const start = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
            const end = new Date(now.getFullYear(), now.getMonth(), 0).toISOString();
            query = query.gte('due_date', start).lte('due_date', end);
        }

        // Order by due date
        query = query.order('due_date', { ascending: true });

        const { data, error } = await query;

        if (!error && data) {
            let filtered = data as unknown as ArInstallment[];

            // Filter out Pending Approval
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
        fetchInstallments();
    }, [direction, statusFilter, dateFilter]);

    // Grouping Logic
    const groupedOrders = useMemo(() => {
        if (viewMode !== 'ORDER') return [];

        const groups = new Map<string, GroupedOrder>();

        installments.forEach(inst => {
            if (!inst.ar_title) return;
            const titleId = inst.ar_title.id;

            if (!groups.has(titleId)) {
                // Initialize Group with Title Stats (Reliable)
                // We use ar_title stats for the header to be accurate regardless of filter
                // Derive Group Status from Title Status or calculate?
                // User Requirement: "PAGO = todas parcelas pagas".
                // Title status is usually reliable.
                let groupStatus: 'OPEN' | 'PARTIAL' | 'PAID' = 'OPEN';
                if (inst.ar_title.status === 'PAID') groupStatus = 'PAID';
                else if (inst.ar_title.status === 'PARTIAL') groupStatus = 'PARTIAL';
                else groupStatus = 'OPEN'; // Default for Open/Pending

                groups.set(titleId, {
                    id: titleId,
                    document_number: inst.ar_title.document_number || 0,
                    organization_name: inst.ar_title.organization?.trade_name || inst.ar_title.organization?.legal_name || 'Desconhecido',
                    issue_date: inst.ar_title.date_issued,
                    amount_total: inst.ar_title.amount_total,
                    amount_paid: inst.ar_title.amount_paid,
                    amount_open: inst.ar_title.amount_open,
                    status: groupStatus,
                    installments: [],
                    next_due_date: undefined // Will calc
                });
            }

            const group = groups.get(titleId)!;
            group.installments.push(inst);
        });

        // Post-process to find next_due_date from OPEN installments (even if filtered out? No, only visible ones)
        const result = Array.from(groups.values()).map(group => {
            // Sort installments by due date
            group.installments.sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());

            // Next Due Date: Earliest due date of an OPEN installment
            const openInst = group.installments.find(i => i.status === 'OPEN' || i.status === 'PARTIAL' || i.status === 'OVERDUE');
            group.next_due_date = openInst ? openInst.due_date : undefined;

            return group;
        });

        // Sort groups by next due date or issue date?
        // Usually by next due date is best for "Accounts Payable/Receivable".
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
            {/* 3-Button Segmented Control */}
            <div className="flex justify-center">
                <div className="bg-gray-100 p-1 rounded-xl inline-flex gap-1 shadow-inner">
                    <button
                        onClick={() => setDirection('IN')}
                        className={cn(
                            "px-6 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2",
                            direction === 'IN'
                                ? "bg-green-100 text-green-700 shadow-sm"
                                : "text-gray-500 hover:text-gray-900 hover:bg-gray-200/50"
                        )}
                    >
                        <ArrowDownCircle className="w-4 h-4" /> A RECEBER
                    </button>
                    <button
                        onClick={() => setDirection('OUT')}
                        className={cn(
                            "px-6 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2",
                            direction === 'OUT'
                                ? "bg-red-100 text-red-700 shadow-sm"
                                : "text-gray-500 hover:text-gray-900 hover:bg-gray-200/50"
                        )}
                    >
                        <ArrowUpCircle className="w-4 h-4" /> A PAGAR
                    </button>
                    <button
                        onClick={() => setDirection('ALL')}
                        className={cn(
                            "px-6 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2",
                            direction === 'ALL'
                                ? "bg-blue-100 text-blue-700 shadow-sm"
                                : "text-gray-500 hover:text-gray-900 hover:bg-gray-200/50"
                        )}
                    >
                        <Layers className="w-4 h-4" /> TODOS
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <Card className="min-h-[500px]">
                {/* Filters Header w/ Toggle */}
                <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row gap-4 justify-between items-center bg-gray-50/30">
                    <div className="relative w-full md:w-[250px] lg:w-[300px]">
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
                        <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-lg">
                            <Label className="text-[10px] font-bold text-gray-500 uppercase px-2">Visualização:</Label>
                            <button
                                onClick={() => handleViewModeChange('INSTALLMENT')}
                                className={cn(
                                    "px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5",
                                    viewMode === 'INSTALLMENT'
                                        ? "bg-white text-gray-900 shadow-sm"
                                        : "text-gray-500 hover:text-gray-900"
                                )}
                            >
                                <List className="w-3.5 h-3.5" /> Por Parcela
                            </button>
                            <button
                                onClick={() => handleViewModeChange('ORDER')}
                                className={cn(
                                    "px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5",
                                    viewMode === 'ORDER'
                                        ? "bg-white text-gray-900 shadow-sm"
                                        : "text-gray-500 hover:text-gray-900"
                                )}
                            >
                                <Package className="w-3.5 h-3.5" /> Agrupar
                            </button>
                        </div>

                        <div className="w-px h-8 bg-gray-200 hidden sm:block"></div>

                        <div className="flex gap-2">
                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                                <SelectTrigger className="w-[130px] bg-white">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="OPEN">Em Aberto</SelectItem>
                                    <SelectItem value="PAID">Pagas</SelectItem>
                                    <SelectItem value="ALL">Todas</SelectItem>
                                </SelectContent>
                            </Select>
                            <Select value={dateFilter} onValueChange={setDateFilter}>
                                <SelectTrigger className="w-[130px] bg-white">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="this_month">Este Mês</SelectItem>
                                    <SelectItem value="last_month">Mês Passado</SelectItem>
                                    <SelectItem value="all_time">Todo Período</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>

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
                                        <TableHead className="w-[50px]"></TableHead>
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
                                        <TableHead className="w-[50px]"></TableHead>
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
                                    <TableRow><TableCell colSpan={10} className="h-32 text-center text-gray-500">Carregando...</TableCell></TableRow>
                                ) : installments.length === 0 ? (
                                    <TableRow><TableCell colSpan={10} className="h-32 text-center text-gray-500">Nenhum registro encontrado.</TableCell></TableRow>
                                ) : (
                                    <>
                                        {viewMode === 'INSTALLMENT' ? (
                                            /* INSTALLMENT VIEW */
                                            installments.map(inst => {
                                                const isExpanded = expandedIds.has(inst.id);
                                                return (
                                                    <React.Fragment key={inst.id}>
                                                        <TableRow
                                                            className={cn("cursor-pointer", isExpanded ? "bg-blue-50/30" : "hover:bg-gray-50")}
                                                            onClick={(e) => toggleExpand(inst.id, e)}
                                                        >
                                                            <TableCell>
                                                                <ChevronDown className={cn("w-4 h-4 transition-transform", isExpanded && "rotate-180")} />
                                                            </TableCell>
                                                            <TableCell className="font-medium text-gray-900">
                                                                #{inst.ar_title?.document_number || 'ND'}-{inst.installment_number}
                                                            </TableCell>
                                                            <TableCell>
                                                                <div className="flex flex-col">
                                                                    <span className="font-medium truncate max-w-[200px]">
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
                                                                <TableCell colSpan={10} className="p-0 border-none bg-blue-50/10">
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
                                                <AccountsGroupRow key={group.id} group={group} onRefresh={fetchInstallments} />
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
