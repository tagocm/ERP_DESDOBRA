"use client";

import * as React from "react";
import { useEffect, useState, useMemo } from "react";
import {
    listPendingEventsAction,
    approveEventAction,
    batchApproveEventsAction,
    rejectEventAction,
    listGLAccountsAction,
    listCostCentersAction,
    listBankAccountsAction,
    listPaymentTermsAction,
    type GLAccountOption,
    type CostCenterOption,
    type BankAccountOption,
    type PaymentTermOption,
} from "@/app/actions/finance-events";
import { rejectSalesFinancial } from "@/app/actions/financial/reject-sales";
import { rejectPurchaseFinancial } from "@/app/actions/financial/reject-purchase";
import { type FinancialEvent } from '@/lib/finance/events-db';

import { Card } from "@/components/ui/Card";
import { CardHeaderStandard } from "@/components/ui/CardHeaderStandard";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/Badge";
import { Checkbox } from "@/components/ui/Checkbox";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
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

import { CheckCircle, Loader2, Search, Filter, LayoutGrid, ArrowUp, ArrowDown, ArrowUpDown, ChevronRight, ChevronDown, ExternalLink, Edit2, X } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { formatCurrency, toTitleCase, cn, formatDate } from "@/lib/utils";
import { EventDetailDrawer } from "./EventDetailDrawer";
import { EventInstallmentsTable } from "./EventInstallmentsTable";

interface UnifiedApprovalTableProps {
    companyId: string;
}

export function UnifiedApprovalTable({ companyId }: UnifiedApprovalTableProps) {
    const { toast } = useToast();
    const [events, setEvents] = useState<FinancialEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Detailed Event Drawer State
    const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

    // Filters
    const [filterDirection, setFilterDirection] = useState<string>("ALL"); // ALL, AR, AP
    const [searchQuery, setSearchQuery] = useState("");
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

    // Dialogs
    const [confirmDialog, setConfirmDialog] = useState<{
        open: boolean;
        type: 'APPROVE_BATCH';
    }>({ open: false, type: 'APPROVE_BATCH' });

    const [rejectDialog, setRejectDialog] = useState<{ open: boolean; eventId: string | null }>({ open: false, eventId: null });
    const [rejectReason, setRejectReason] = useState("");

    const [isProcessing, setIsProcessing] = useState(false);

    // Pre-loaded options for performance (avoid waterfall)
    const [options, setOptions] = useState<{
        glAccounts: GLAccountOption[];
        costCenters: CostCenterOption[];
        bankAccounts: BankAccountOption[];
        paymentTerms: PaymentTermOption[];
    }>({
        glAccounts: [],
        costCenters: [],
        bankAccounts: [],
        paymentTerms: []
    });

    // Fetch static options on mount
    useEffect(() => {
        if (!companyId) return;
        Promise.all([
            listGLAccountsAction(companyId),
            listCostCentersAction(companyId),
            listBankAccountsAction(companyId),
            listPaymentTermsAction(companyId)
        ]).then(([accRes, ccRes, bankRes, termRes]) => {
            setOptions({
                glAccounts: accRes.success ? accRes.data || [] : [],
                costCenters: ccRes.success ? ccRes.data || [] : [],
                bankAccounts: bankRes.success ? bankRes.data || [] : [],
                paymentTerms: termRes.success ? termRes.data || [] : []
            });
        });
    }, [companyId]);

    // --- Data Fetching ---
    const fetchEvents = async () => {
        setLoading(true);
        const res = await listPendingEventsAction(companyId);
        if (!res.success) {
            toast({ title: "Erro ao carregar", description: res.error, variant: "destructive" });
        } else {
            setEvents(res.data || []);
        }
        setLoading(false);
    };

    useEffect(() => {
        if (companyId) {
            fetchEvents();
        }
    }, [companyId]);

    // --- Computed ---
    const filteredEvents = useMemo(() => {
        let filtered = events;

        if (filterDirection !== 'ALL') {
            filtered = filtered.filter(t => t.direction === filterDirection);
        }

        if (searchQuery) {
            const lower = searchQuery.toLowerCase();
            filtered = filtered.filter(t =>
                (t.partner_name || '').toLowerCase().includes(lower) ||
                (t.origin_reference || '').toLowerCase().includes(lower) ||
                String(t.total_amount).includes(lower)
            );
        }

        return filtered;
    }, [events, filterDirection, searchQuery]);

    const sortedEvents = useMemo(() => {
        if (!sortConfig) return filteredEvents;
        return [...filteredEvents].sort((a, b) => {
            let aVal: any = '';
            let bVal: any = '';

            switch (sortConfig.key) {
                case 'issued':
                    aVal = new Date(a.issue_date).getTime();
                    bVal = new Date(b.issue_date).getTime();
                    break;
                case 'partner':
                    aVal = (a.partner_name || '').toLowerCase();
                    bVal = (b.partner_name || '').toLowerCase();
                    break;
                case 'total':
                    aVal = a.total_amount;
                    bVal = b.total_amount;
                    break;
                case 'direction':
                    aVal = a.direction;
                    bVal = b.direction;
                    break;
                default:
                    return 0;
            }

            if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [filteredEvents, sortConfig]);

    const totalPending = filteredEvents.reduce((sum, t) => sum + t.total_amount, 0);
    const totalSelected = filteredEvents.filter(t => selectedIds.has(t.id)).reduce((sum, t) => sum + t.total_amount, 0);

    // --- Event Handlers ---
    const handleSort = (key: string) => {
        setSortConfig(current => {
            if (current?.key === key) return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
            return { key, direction: 'asc' };
        });
    };

    const handleSelectAll = (checked: boolean) => {
        if (checked) setSelectedIds(new Set(filteredEvents.map(t => t.id)));
        else setSelectedIds(new Set());
    };

    const handleSelectRow = (id: string, checked: boolean) => {
        const next = new Set(selectedIds);
        if (checked) next.add(id); else next.delete(id);
        setSelectedIds(next);
    };

    const toggleExpand = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const next = new Set(expandedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setExpandedIds(next);
    };

    // --- Actions ---
    const executeBatchApprove = async () => {
        setIsProcessing(true);
        try {
            const ids = Array.from(selectedIds);
            const res = await batchApproveEventsAction(ids);

            if (res.success && res.data) {
                const { succeeded, failed } = res.data;

                if (failed.length === 0) {
                    toast({ title: `${succeeded.length} eventos aprovados com sucesso!` });
                } else {
                    toast({
                        title: "Aprovação parcial",
                        description: `${succeeded.length} aprovados, ${failed.length} falharam. Verifique os itens em atenção.`,
                        variant: "destructive"
                    });
                }

                fetchEvents();
                setSelectedIds(new Set());
                setConfirmDialog({ ...confirmDialog, open: false });
            }
        } catch (e: any) {
            toast({ title: "Erro", description: e.message, variant: "destructive" });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleSingleApprove = async (id: string) => {
        setIsProcessing(true);
        try {
            const res = await approveEventAction(id);
            if (res.success) {
                toast({
                    title: "Evento Aprovado!",
                    description: `Título ${res.data?.direction} ${res.data?.titleId} gerado. Verifique em ${res.data?.direction === 'AR' ? 'Recebimentos' : 'Pagamentos'}.`
                });
                fetchEvents();
            } else {
                toast({ title: "Erro ao aprovar", description: res.error, variant: "destructive" });
            }
        } finally {
            setIsProcessing(false);
        }
    };

    const handleSingleReject = (id: string) => {
        setRejectDialog({ open: true, eventId: id });
        setRejectReason("");
    };

    const handleConfirmReject = async () => {
        if (!rejectDialog.eventId || !rejectReason.trim()) {
            toast({ title: "Erro", description: "Informe um motivo para rejeição.", variant: "destructive" });
            return;
        }

        setIsProcessing(true);
        try {
            // Find the event to determine type (AR/AP) and linked document ID
            const event = events.find(e => e.id === rejectDialog.eventId);
            if (!event) {
                toast({ title: "Erro", description: "Evento não encontrado.", variant: "destructive" });
                return;
            }

            // We need the sales_document_id or purchase_order_id.
            // Assuming the event object has these or we can infer from `origin_id` or similar.
            // Looking at `FinancialEvent` type (inferred):
            // Usually has `sales_document_id` and `purchase_order_id` or `origin_id`.
            // Let's check the event object structure in a moment or assume standard fields.
            // If the event doesn't have them directly, we might need to fetch or use the `origin_reference`.
            // BUT, looking at `EventDetailDrawer` usage, it likely passes the full event.

            // Assume event has: direction ('AR' -> Sales, 'AP' -> Purchase), and maybe link ids.
            // If `sales_document_id` is present on the event, use it.

            console.log("Rejecting event:", event);

            let res;
            // TODO: Ensure FinancialEvent has sales_document_id/purchase_order_id
            // If they are missing from the type definition in `events-db`, we must fix that first.
            // For now, let's assume they exist or fallback to origin_id if applicable.

            // To be safe, I will pass `userId` as a hardcoded ID for now or get it from session if available?
            // This component is client-side. We usually don't have userId directly unless passed as prop.
            // BUT, the server action can get the session user. 
            // WAIT, `rejectSalesFinancial` requires `userId` as param.
            // I should modify the server action to get the user from the session, clearer and more secure.
            // OR I pass a placeholder if authentication is handled differently.
            // Let's update server actions to get user from session internally blocks later.
            // For now, let's pass a placeholder or remove the need for userId param if Action gets it.

            // Correction: The server Actions I wrote take `userId`. 
            // Valid pattern: `await supabaseServer.auth.getUser()`.
            // I should probably update the server actions to get the user themselves.
            // But let's stick to the plan. I'll use a placeholder "CURRENT_USER" and rely on the action to validate if needed, 
            // OR better: I'll update the server actions to use `auth().getUser()` inside.

            // Actually, best practice: Server Action gets user. 
            // I'll update the server actions in a moment.

            // Determine the correct ID based on origin_type
            if (event.origin_type === 'SALE' && event.origin_id) {
                res = await rejectSalesFinancial({
                    salesDocumentId: event.origin_id,
                    reason: rejectReason,
                    eventId: event.id // Pass event ID for closure
                });
            } else if (event.origin_type === 'PURCHASE' && event.origin_id) {
                res = await rejectPurchaseFinancial({
                    purchaseOrderId: event.origin_id,
                    reason: rejectReason,
                    eventId: event.id // Pass event ID for closure
                });
            } else {
                // Fallback
                res = await rejectEventAction(rejectDialog.eventId, rejectReason);
            }

            if (res.success) {
                toast({ title: "Rejeitado com sucesso", description: "As ações corretivas foram aplicadas." });
                fetchEvents();
                setRejectDialog({ open: false, eventId: null });
            } else {
                toast({ title: "Erro na rejeição", description: "Falha ao processar.", variant: "destructive" });
            }

        } catch (e: any) {
            toast({ title: "Erro", description: e.message, variant: "destructive" });
        } finally {
            setIsProcessing(false);
        }
    };

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

    // --- Helpers ---
    const getOperationalStatusLabel = (status: string | null | undefined, type: string) => {
        if (!status) return 'Desconhecido';

        const map: Record<string, string> = {
            // Logistics
            'pending': 'Aguardando',
            'separation': 'Em Separação',
            'expedition': 'Expedição',
            'delivered': 'Entregue',
            'not_loaded': 'Não Carregado',
            'loaded': 'Carregado',
            // Purchase
            'draft': 'Rascunho',
            'sent': 'Enviado',
            'received': 'Recebido',
            'cancelled': 'Cancelado',
            // Default (Commercial)
            'confirmed': 'Confirmado',
        };

        return map[status] || toTitleCase(status);
    };

    const getOperationalStatusColor = (status: string | null | undefined) => {
        switch (status) {
            case 'separation':
            case 'expedition':
            case 'sent':
                return "bg-blue-50 text-blue-700 border-blue-200";
            case 'delivered':
            case 'received':
            case 'loaded':
                return "bg-green-50 text-green-700 border-green-200";
            case 'pending':
            case 'draft':
                return "bg-gray-100 text-gray-600 border-gray-200";
            case 'not_loaded':
            case 'cancelled':
                return "bg-red-50 text-red-700 border-red-200";
            default:
                return "bg-gray-50 text-gray-700 border-gray-200";
        }
    };

    return (
        <div className="space-y-6">
            {/* Cards */}
            <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col gap-1 relative overflow-hidden">
                    <span className="text-[10px] uppercase font-black text-gray-400 tracking-widest pl-1">Total Pendente</span>
                    <div className="text-2xl font-black text-gray-900 tabular-nums">{formatCurrency(totalPending)}</div>
                </div>
                <div className="flex-1 bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col gap-1 relative overflow-hidden">
                    <span className="text-[10px] uppercase font-black text-gray-400 tracking-widest pl-1">Seleção Ativa</span>
                    <div className={`text-2xl font-black tabular-nums ${selectedIds.size > 0 ? 'text-blue-600' : 'text-gray-300'}`}>
                        {formatCurrency(totalSelected)}
                    </div>
                </div>
            </div>

            <Card className="min-h-[500px]">
                <CardHeaderStandard
                    title="Pré-Aprovação Financeira"
                    description="Valide os lançamentos antes de gerar títulos oficiais."
                    icon={<LayoutGrid className="w-5 h-5" />}
                    actions={
                        selectedIds.size > 0 && (
                            <div className="flex items-center gap-2 animate-in slide-in-from-right-4 bg-blue-50/50 p-1.5 rounded-xl border border-blue-100/50">
                                <span className="text-xs font-bold text-blue-700 px-2">{selectedIds.size} selecionados</span>
                                <Button
                                    size="sm"
                                    onClick={() => setConfirmDialog({ open: true, type: 'APPROVE_BATCH' })}
                                    className="h-8 text-xs font-bold bg-blue-600 hover:bg-blue-700"
                                >
                                    <CheckCircle className="w-3.5 h-3.5 mr-1.5" /> Aprovar em Lote
                                </Button>
                            </div>
                        )
                    }
                />

                <div className="px-6 pb-6 border-b border-gray-100 flex flex-col sm:flex-row gap-4 justify-between items-center">
                    <div className="relative w-full sm:w-auto flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <Input
                            placeholder="Buscar parceiro, origem ou valor..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 h-10 w-full bg-gray-50/50 border-gray-200 focus:bg-white"
                        />
                    </div>
                    <Select value={filterDirection} onValueChange={setFilterDirection}>
                        <SelectTrigger className="w-[180px] bg-white border-gray-200">
                            <Filter className="w-4 h-4 mr-2 text-gray-500" />
                            <SelectValue placeholder="Tipo" />
                        </SelectTrigger>
                        <SelectContent align="end">
                            <SelectItem value="ALL">Todos os Tipos</SelectItem>
                            <SelectItem value="AR">Recebimentos (AR)</SelectItem>
                            <SelectItem value="AP">Pagamentos (AP)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="relative">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-gray-50/40">
                                <TableHead className="w-[40px]"></TableHead>
                                <TableHead className="w-[40px]">
                                    <Checkbox
                                        checked={filteredEvents.length > 0 && selectedIds.size === filteredEvents.length}
                                        onCheckedChange={(c) => handleSelectAll(c as boolean)}
                                        className="translate-y-[2px]"
                                    />
                                </TableHead>
                                <SortableHead sortKey="direction" label="Tipo" className="w-[80px]" />
                                <SortableHead sortKey="partner" label="Parceiro" />
                                <TableHead>Origem</TableHead>
                                <TableHead className="w-[140px]">Status Operacional</TableHead>
                                <SortableHead sortKey="issued" label="Emissão" className="w-[100px]" />
                                <SortableHead sortKey="total" label="Total" className="w-[120px]" />
                                <TableHead className="w-[100px]">Status</TableHead>
                                <TableHead className="w-[40px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={10} className="h-32 text-center text-gray-400">
                                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                                        Carregando eventos...
                                    </TableCell>
                                </TableRow>
                            ) : sortedEvents.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={10} className="h-32 text-center text-gray-400">
                                        Nenhum evento pendente.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                sortedEvents.map(event => (
                                    <React.Fragment key={event.id}>
                                        <TableRow
                                            className={cn(
                                                "group cursor-pointer transition-colors hover:bg-gray-50/80",
                                                expandedIds.has(event.id) && "bg-gray-50 border-b-0"
                                            )}
                                            onClick={() => setSelectedEventId(event.id)}
                                        >
                                            <TableCell onClick={(e) => toggleExpand(event.id, e)} className="cursor-pointer text-gray-400 hover:text-gray-600">
                                                {expandedIds.has(event.id) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                            </TableCell>
                                            <TableCell onClick={(e) => e.stopPropagation()}>
                                                <Checkbox
                                                    checked={selectedIds.has(event.id)}
                                                    onCheckedChange={(c) => handleSelectRow(event.id, c as boolean)}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className={cn(
                                                    "font-bold text-[10px]",
                                                    event.direction === 'AR' ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"
                                                )}>
                                                    {event.direction === 'AR' ? 'RECEBIMENTO' : 'PAGAMENTO'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <span className="font-semibold text-gray-900 block truncate max-w-[200px]" title={event.partner_name || ''}>
                                                    {toTitleCase(event.partner_name || 'Desconhecido')}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col text-sm text-gray-600">
                                                    <span className="font-medium text-gray-700">{event.origin_reference}</span>
                                                    <span className="text-[10px] text-gray-400 uppercase">{event.origin_type}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className={cn("text-[10px] font-semibold", getOperationalStatusColor(event.operational_status))}>
                                                    {getOperationalStatusLabel(event.operational_status, event.origin_type)}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-xs text-gray-500">
                                                {formatDate(event.issue_date)}
                                            </TableCell>
                                            <TableCell className="font-bold text-gray-900">
                                                {formatCurrency(event.total_amount)}
                                            </TableCell>
                                            <TableCell>
                                                {event.status === 'em_atencao' ? (
                                                    <Badge className="bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-100">
                                                        Em Atenção
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="secondary" className="text-gray-500 bg-gray-100">Pendente</Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                                                        title="Aprovar"
                                                        onClick={(e) => { e.stopPropagation(); handleSingleApprove(event.id); }}
                                                        disabled={isProcessing}
                                                    >
                                                        <CheckCircle className="w-4 h-4" />
                                                    </Button>
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50"
                                                        title="Reprovar"
                                                        onClick={(e) => { e.stopPropagation(); setRejectDialog({ open: true, eventId: event.id }); }}
                                                        disabled={isProcessing}
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </Button>
                                                    <Button size="icon" variant="ghost" className="h-8 w-8 text-gray-400 hover:text-blue-600 hover:bg-blue-50" onClick={(e) => toggleExpand(event.id, e)}>
                                                        {expandedIds.has(event.id) ? <ChevronDown className="w-4 h-4" /> : <Edit2 className="w-4 h-4" />}
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>

                                        {/* Expanded Installments Preview */}
                                        {expandedIds.has(event.id) && (
                                            <TableRow className="bg-gray-50/50 hover:bg-gray-50/50 border-t-0">
                                                <TableCell colSpan={10} className="p-0 border-b">
                                                    <div className="px-2 py-2 sm:px-6">
                                                        <EventInstallmentsTable
                                                            event={event}
                                                            onUpdate={fetchEvents}
                                                            preloadedOptions={options}
                                                        />
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </React.Fragment>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </Card>

            {/* Batch Confirm Dialog */}
            <AlertDialog open={confirmDialog.open} onOpenChange={(o) => !o && setConfirmDialog(p => ({ ...p, open: false }))}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Aprovar {selectedIds.size} eventos?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Os eventos serão validados individualmente. Se houver pendências, eles não serão aprovados e ficarão "Em Atenção".
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={executeBatchApprove} disabled={isProcessing} className="bg-green-600 hover:bg-green-700">
                            {isProcessing ? "Processando..." : "Confirmar Aprovação"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Reject Dialog */}
            <AlertDialog open={rejectDialog.open} onOpenChange={(o) => !o && setRejectDialog({ open: false, eventId: null })}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Reprovar Lançamento</AlertDialogTitle>
                        <AlertDialogDescription>
                            O lançamento será marcado como reprovado e não gerará títulos.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="py-2">
                        <Textarea
                            placeholder="Motivo da reprovação (obrigatório, min 10 caracteres)"
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                        />
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-red-600 hover:bg-red-700"
                            disabled={rejectReason.length < 10 || isProcessing}
                            onClick={(e) => {
                                e.preventDefault(); // Prevent auto-close
                                handleConfirmReject();
                            }}
                        >
                            {isProcessing ? "Processando..." : "Confirmar Reprovação"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

        </div>
    );
}
