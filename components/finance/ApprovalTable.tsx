"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabaseBrowser";
import { ArTitle } from "@/types/financial";
import { Card } from "@/components/ui/Card";
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
import { ChevronRight, ChevronDown, CheckCircle, PauseCircle, Loader2, Search, Filter } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { formatCurrency, toTitleCase } from "@/lib/utils";
import { ApprovalRowExpanded } from "./ApprovalRowExpanded";

export function ApprovalTable() {
    const [postings, setPostings] = useState<ArTitle[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

    const [filterStatus, setFilterStatus] = useState<string>("PENDING_APPROVAL");
    const [searchQuery, setSearchQuery] = useState("");
    const { toast } = useToast();
    const supabase = createClient();

    // Batch Action States
    const [isApproving, setIsApproving] = useState(false);
    const [isHolding, setIsHolding] = useState(false);

    // Dialogs
    const [showApproveDialog, setShowApproveDialog] = useState(false);
    const [showHoldDialog, setShowHoldDialog] = useState(false);

    const fetchPostings = async () => {
        setLoading(true);
        let query = supabase
            .from('ar_titles')
            .select(`
                *,
                sales_document:sales_documents(id, document_number, status_logistic),
                organization:organizations!customer_id(id, trade_name, legal_name),
                ar_installments(due_date)
            `)
            .order('created_at', { ascending: false });

        if (filterStatus && filterStatus !== 'ALL') {
            query = query.eq('status', filterStatus);
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

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedIds(new Set(postings.filter(p => p.status === 'PENDING_APPROVAL' || p.status === 'ON_HOLD').map(p => p.id)));
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

    const handleBatchHold = async () => {
        setIsHolding(true);
        try {
            const response = await fetch('/api/finance/postings/hold-batch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: Array.from(selectedIds) })
            });

            if (!response.ok) throw new Error('Erro ao segurar itens');

            toast({ title: "Itens colocados em espera (Hold) com sucesso." });
            setSelectedIds(new Set());
            setShowHoldDialog(false);
            fetchPostings();
        } catch (error: any) {
            toast({ title: "Erro ao processar", description: error.message, variant: "destructive" });
        } finally {
            setIsHolding(false);
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

    const handleSingleHold = async (id: string) => {
        try {
            const response = await fetch('/api/finance/postings/hold-batch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: [id] })
            });
            if (!response.ok) throw new Error('Erro ao colocar em hold');
            toast({ title: "Lançamento em espera." });
            fetchPostings();
        } catch (e) {
            toast({ title: "Erro ao alterar status", variant: "destructive" });
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
            ON_HOLD: "bg-orange-50 text-orange-700 border-orange-200 shadow-sm"
        };
        const labels: any = {
            PENDING_APPROVAL: "Pendente",
            OPEN: "Aberto",
            PAID: "Liquidado",
            CANCELLED: "Cancelado",
            PARTIAL: "Parcial",
            ON_HOLD: "Segurado"
        };
        return <Badge variant="outline" className={`${styles[status] || "bg-gray-100"} font-bold px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider`}>
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

    const totalSelectedValue = postings
        .filter(p => selectedIds.has(p.id))
        .reduce((sum, curr) => sum + (Number(curr.amount_total) || 0), 0);

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Action Bar */}
            <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white p-5 rounded-2xl border shadow-sm">
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                        <Input
                            placeholder="Buscar cliente ou pedido..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full md:w-80 bg-gray-50/50 border-gray-100 pl-10 h-11 focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all rounded-xl"
                        />
                    </div>

                    <div className="flex items-center gap-2 bg-gray-50/50 p-1 rounded-xl border border-gray-100">
                        <Select value={filterStatus} onValueChange={setFilterStatus}>
                            <SelectTrigger className="w-[160px] border-none bg-transparent h-9 shadow-none focus:ring-0">
                                <Filter className="w-3 h-3 mr-2 text-gray-400" />
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-gray-100 shadow-xl">
                                <SelectItem value="PENDING_APPROVAL" className="rounded-lg">Pendentes</SelectItem>
                                <SelectItem value="ON_HOLD" className="rounded-lg">Segurados</SelectItem>
                                <SelectItem value="OPEN" className="rounded-lg">Aprovados</SelectItem>
                                <SelectItem value="ALL" className="rounded-lg">Todos os Status</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {selectedIds.size > 0 ? (
                    <div className="flex items-center gap-4 bg-blue-50/50 p-2 pl-4 rounded-2xl border border-blue-100 animate-in slide-in-from-right-4">
                        <div className="flex flex-col -space-y-1">
                            <span className="text-[10px] uppercase font-black text-blue-400 tracking-tighter">Selecionados ({selectedIds.size})</span>
                            <span className="text-sm font-black text-blue-700">{formatCurrency(totalSelectedValue)}</span>
                        </div>

                        <div className="flex gap-2">
                            <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => setShowHoldDialog(true)}
                                className="h-10 bg-white text-orange-600 hover:bg-orange-50 border border-orange-100 rounded-xl px-4 font-bold active:scale-95 transition-all"
                            >
                                <PauseCircle className="w-4 h-4 mr-2" /> Segurar
                            </Button>

                            <Button
                                size="sm"
                                className="h-10 bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-6 font-bold shadow-lg shadow-blue-100 active:scale-95 transition-all"
                                onClick={() => setShowApproveDialog(true)}
                            >
                                <CheckCircle className="w-4 h-4 mr-2" /> Aprovar Lote
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="hidden md:flex flex-col items-end -space-y-1 text-right">
                        <span className="text-[10px] uppercase font-bold text-gray-400">Total em Tela</span>
                        <span className="text-lg font-black text-gray-900">{formatCurrency(postings.reduce((s, c) => s + Number(c.amount_total), 0))}</span>
                    </div>
                )}
            </div>

            {/* Table */}
            <Card className="overflow-hidden border-gray-100 shadow-xl rounded-2xl">
                <Table>
                    <TableHeader className="bg-gray-50/50">
                        <TableRow className="border-b-gray-100">
                            <TableHead className="w-[50px]"></TableHead>
                            <TableHead className="w-[50px]">
                                <Checkbox
                                    className="rounded-md border-gray-300"
                                    checked={selectedIds.size === postings.filter(p => p.status === 'PENDING_APPROVAL' || p.status === 'ON_HOLD').length && postings.length > 0}
                                    onCheckedChange={(checked) => handleSelectAll(checked as boolean)}
                                />
                            </TableHead>
                            <TableHead className="text-[10px] uppercase font-black text-gray-500 tracking-widest">Pedido</TableHead>
                            <TableHead className="text-[10px] uppercase font-black text-gray-500 tracking-widest">Cliente</TableHead>
                            <TableHead className="text-[10px] uppercase font-black text-gray-500 tracking-widest">Em Rota</TableHead>
                            <TableHead className="text-[10px] uppercase font-black text-gray-500 tracking-widest">Valor Total</TableHead>
                            <TableHead className="text-[10px] uppercase font-black text-gray-500 tracking-widest">Condição</TableHead>
                            <TableHead className="text-[10px] uppercase font-black text-gray-500 tracking-widest">Modalidade</TableHead>
                            <TableHead className="text-[10px] uppercase font-black text-gray-500 tracking-widest text-center">Parcelas</TableHead>
                            <TableHead className="text-[10px] uppercase font-black text-gray-500 tracking-widest">1º Vencimento</TableHead>
                            <TableHead className="text-[10px] uppercase font-black text-gray-500 tracking-widest text-right">Status</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={11} className="text-center py-20 text-gray-500">
                                    <Loader2 className="h-10 w-10 animate-spin mx-auto mb-4 text-blue-500 opacity-20" />
                                    <p className="font-bold text-gray-300 uppercase tracking-widest text-xs">Sincronizando fluxo...</p>
                                </TableCell>
                            </TableRow>
                        ) : postings.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={11} className="text-center py-20">
                                    <div className="flex flex-col items-center gap-2 opacity-30 grayscale">
                                        <Filter className="w-12 h-12" />
                                        <p className="font-bold text-xs uppercase tracking-widest">Nenhum lançamento pendente encontrado.</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            postings.map((posting) => {
                                const isExpanded = expandedIds.has(posting.id);
                                const instInfo = getInstallmentInfo(posting);
                                const isPending = posting.status === 'PENDING_APPROVAL' || posting.status === 'ON_HOLD';

                                return (
                                    <React.Fragment key={posting.id}>
                                        <TableRow className={`group cursor-pointer transition-all ${isExpanded ? 'bg-blue-50/20' : 'hover:bg-gray-50/80 border-b-gray-50'}`} onClick={() => toggleExpand(posting.id)}>
                                            <TableCell onClick={(e) => e.stopPropagation()}>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className={`h-8 w-8 p-0 rounded-full transition-all ${isExpanded ? 'bg-blue-100 text-blue-600 rotate-180' : 'text-gray-400'}`}
                                                    onClick={() => toggleExpand(posting.id)}
                                                >
                                                    <ChevronDown className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                            <TableCell onClick={(e) => e.stopPropagation()}>
                                                <Checkbox
                                                    className="rounded-md border-gray-300 data-[state=checked]:bg-blue-600"
                                                    checked={selectedIds.has(posting.id)}
                                                    onCheckedChange={(checked) => handleSelectOne(posting.id, checked as boolean)}
                                                    disabled={!isPending}
                                                />
                                            </TableCell>
                                            <TableCell className="font-black text-gray-900">
                                                #{posting.document_number || posting.sales_document?.document_number}
                                            </TableCell>
                                            <TableCell className="max-w-[180px] truncate font-bold text-gray-600" title={posting.organization?.trade_name || ""}>
                                                {toTitleCase(posting.organization?.trade_name || posting.organization?.legal_name || 'NI')}
                                            </TableCell>
                                            <TableCell className="text-gray-500 font-medium">
                                                {posting.date_issued ? new Date(posting.date_issued).toLocaleDateString('pt-BR') : '-'}
                                            </TableCell>
                                            <TableCell className="font-black text-gray-900 bg-gray-50/30 group-hover:bg-transparent">
                                                {formatCurrency(posting.amount_total)}
                                            </TableCell>
                                            <TableCell className="text-[10px] font-bold text-gray-400 max-w-[100px] truncate">
                                                {posting.payment_terms_snapshot || '-'}
                                            </TableCell>
                                            <TableCell className="text-[10px] font-bold text-gray-400">
                                                {posting.payment_method_snapshot || '-'}
                                            </TableCell>
                                            <TableCell className="text-center font-black text-blue-600/60">
                                                {instInfo.count > 0 ? `${instInfo.count}x` : '-'}
                                            </TableCell>
                                            <TableCell className="text-gray-500 font-medium">
                                                {instInfo.first}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {getStatusBadge(posting.status)}
                                            </TableCell>
                                        </TableRow>

                                        {isExpanded && (
                                            <TableRow className="bg-transparent border-none">
                                                <TableCell colSpan={11} className="p-0 border-none">
                                                    <div className="px-4 pb-4 animate-in slide-in-from-top-4 duration-500">
                                                        <ApprovalRowExpanded
                                                            title={posting}
                                                            onRefresh={fetchPostings}
                                                            onApprove={handleSingleApprove}
                                                            onHold={handleSingleHold}
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
            </Card>

            {/* Dialogs */}
            <AlertDialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
                <AlertDialogContent className="rounded-2xl border-none shadow-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="font-black text-2xl text-gray-900">Confirmar Aprovação?</AlertDialogTitle>
                        <AlertDialogDescription className="text-gray-500 font-medium">
                            Você está prestes a aprovar <span className="text-blue-600 font-bold">{selectedIds.size} lançamentos</span>.
                            Isso irá gerar títulos abertos no Contas a Receber e permitirá a baixa financeira definitiva.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="mt-6">
                        <AlertDialogCancel className="rounded-xl border-gray-100 font-bold">Voltar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleBatchApprove} className="bg-blue-600 hover:bg-blue-700 rounded-xl font-bold px-8">
                            Aprovar Lote
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={showHoldDialog} onOpenChange={setShowHoldDialog}>
                <AlertDialogContent className="rounded-2xl border-none shadow-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="font-black text-2xl text-orange-700">Pausar Lançamentos?</AlertDialogTitle>
                        <AlertDialogDescription className="text-gray-500 font-medium">
                            Os <span className="font-bold">{selectedIds.size} itens</span> serão marcados como "Segurado" (Hold) e sairão do fluxo principal de aprovações pendentes até que sejam liberados novamente.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="mt-6">
                        <AlertDialogCancel className="rounded-xl border-gray-100 font-bold">Voltar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleBatchHold} className="bg-orange-600 hover:bg-orange-700 rounded-xl font-bold px-8">
                            Confirmar Hold
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

import React from "react";
