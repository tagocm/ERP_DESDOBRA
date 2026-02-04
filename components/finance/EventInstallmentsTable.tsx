
"use client";

import { useState, useMemo, useEffect, Fragment } from "react";
import { type FinancialEvent, type EventInstallment } from "@/lib/finance/events-db";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import { Edit2, Plus, RefreshCw, Save, X, ChevronDown, Copy } from "lucide-react";
import { InstallmentDetailPanel } from "./InstallmentDetailPanel";
import { updateInstallmentsAction, recalculateInstallmentsAction, listGLAccountsAction, listCostCentersAction, listBankAccountsAction, listPaymentTermsAction, type GLAccountOption, type CostCenterOption, type BankAccountOption, type PaymentTermOption } from "@/app/actions/finance-events";
import { useToast } from "@/components/ui/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/Dialog";
import { Label } from "@/components/ui/Label";
import { Input } from "@/components/ui/Input";
import { CurrencyInput } from "@/components/ui/CurrencyInput";
import { Card } from "@/components/ui/Card";


interface EventInstallmentsTableProps {
    event: FinancialEvent;
    onUpdate: () => void;
    // Pre-loaded options (optional - will fetch if missing)
    preloadedOptions?: {
        glAccounts: GLAccountOption[];
        costCenters: CostCenterOption[];
        bankAccounts: BankAccountOption[];
        paymentTerms: PaymentTermOption[];
    }
}

export function EventInstallmentsTable({ event, onUpdate, preloadedOptions }: EventInstallmentsTableProps) {
    const { toast } = useToast();
    const [isEditing, setIsEditing] = useState(true); // Auto-enable editing mode
    const [localInstallments, setLocalInstallments] = useState<EventInstallment[]>([]);
    const [saving, setSaving] = useState(false);
    const [expandedInstallmentId, setExpandedInstallmentId] = useState<string | null>(null);
    const [recalculateOpen, setRecalculateOpen] = useState(false);

    // Options (fetched on edit or provided via props)
    const [glAccounts, setGlAccounts] = useState<GLAccountOption[]>(preloadedOptions?.glAccounts || []);
    const [costCenters, setCostCenters] = useState<CostCenterOption[]>(preloadedOptions?.costCenters || []);
    const [bankAccounts, setBankAccounts] = useState<BankAccountOption[]>(preloadedOptions?.bankAccounts || []);
    const [paymentTerms, setPaymentTerms] = useState<PaymentTermOption[]>(preloadedOptions?.paymentTerms || []);
    const [loadingOptions, setLoadingOptions] = useState(false);

    // Sync props if they update later (e.g. async load in parent)
    useEffect(() => {
        if (preloadedOptions) {
            setGlAccounts(preloadedOptions.glAccounts);
            setCostCenters(preloadedOptions.costCenters);
            setBankAccounts(preloadedOptions.bankAccounts);
            setPaymentTerms(preloadedOptions.paymentTerms);
        }
    }, [preloadedOptions]);

    // Global Control States
    const [globalTermId, setGlobalTermId] = useState<string>("");
    const [globalMethod, setGlobalMethod] = useState<string>("");
    const [globalAccountId, setGlobalAccountId] = useState<string>("");
    const [globalCostCenterId, setGlobalCostCenterId] = useState<string>("");
    const [globalGLAccountId, setGlobalGLAccountId] = useState<string>("");

    // Initialize local state
    useEffect(() => {
        setLocalInstallments(event.installments?.map(i => ({
            ...i,
            payment_method: i.payment_method ? i.payment_method.toLowerCase() : null
        })) || []);
    }, [event.installments]);

    // Pre-fill global controls based on installments data
    useEffect(() => {
        // Payment Method
        const methods = new Set(localInstallments.map(i => i.payment_method ? i.payment_method.toLowerCase() : null));
        setGlobalMethod(methods.size === 1 ? (Array.from(methods)[0] as string) || "" : "");

        // Financial Account
        const accounts = new Set(localInstallments.map(i => i.financial_account_id));
        setGlobalAccountId(accounts.size === 1 ? (Array.from(accounts)[0] as string) || "" : "");

        // Cost Center
        const mCostCenters = new Set(localInstallments.map(i => i.cost_center_id));
        setGlobalCostCenterId(mCostCenters.size === 1 ? (Array.from(mCostCenters)[0] as string) || "" : "");

        // GL Account
        const mGLAccounts = new Set(localInstallments.map(i => i.suggested_account_id));
        setGlobalGLAccountId(mGLAccounts.size === 1 ? (Array.from(mGLAccounts)[0] as string) || "" : "");

        // Payment Term (only if options loaded)
        if (paymentTerms.length > 0) {
            const conditions = new Set(localInstallments.map(i => i.payment_condition));
            if (conditions.size === 1) {
                const conditionName = Array.from(conditions)[0];
                const term = paymentTerms.find(t => t.name === conditionName);
                if (term) setGlobalTermId(term.id);
                else setGlobalTermId("");
            } else {
                setGlobalTermId("");
            }
        }
    }, [localInstallments, paymentTerms]);

    // Fetch options when editing starts (only if not preloaded)
    useEffect(() => {
        if (isEditing && glAccounts.length === 0 && !preloadedOptions) {
            setLoadingOptions(true);
            Promise.all([
                listGLAccountsAction(event.company_id),
                listCostCentersAction(event.company_id),
                listBankAccountsAction(event.company_id),
                listPaymentTermsAction(event.company_id)
            ]).then(([accRes, ccRes, bankRes, termRes]) => {
                if (accRes.success) setGlAccounts(accRes.data || []);
                if (ccRes.success) setCostCenters(ccRes.data || []);
                if (bankRes.success) setBankAccounts(bankRes.data || []);
                if (termRes.success) setPaymentTerms(termRes.data || []);
            }).finally(() => setLoadingOptions(false));
        }
    }, [isEditing, event.company_id]);

    const handleApplyToAll = (field: 'suggested_account_id' | 'cost_center_id' | 'payment_method' | 'payment_condition' | 'financial_account_id', value: string | null) => {
        setLocalInstallments(prev => prev.map(inst => ({ ...inst, [field]: value })));
        toast({ title: "Aplicado a todas as parcelas" });
    };

    // Computed
    const sumTotal = useMemo(() => localInstallments.reduce((sum, i) => sum + i.amount, 0), [localInstallments]);
    const difference = sumTotal - event.total_amount;
    const hasMismatch = Math.abs(difference) > 0.01;

    // Derived payment condition (simple heuristic)
    const paymentCondition = useMemo(() => {
        if (localInstallments.length === 0) return "Nenhuma";
        const conditions = new Set(localInstallments.map(i => i.payment_condition).filter(Boolean));
        if (conditions.size === 1) return Array.from(conditions)[0];
        return "Mista / Personalizada";
    }, [localInstallments]);


    // Derived dates
    const dates = useMemo(() => {
        if (localInstallments.length === 0) return { next: null, last: null };
        const sorted = [...localInstallments].sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
        return {
            next: sorted[0].due_date,
            last: sorted[sorted.length - 1].due_date
        };
    }, [localInstallments]);

    // Handlers
    const handleSave = async () => {
        if (hasMismatch) {
            toast({ title: "Erro de validação", description: "A soma das parcelas deve bater com o total do evento.", variant: "destructive" });
            return;
        }
        setSaving(true);
        try {
            // Strip system fields before sending and re-sequence numbers to avoid unique constraint errors
            const payload = localInstallments.map((inst, idx) => {
                const { id, event_id, created_at, updated_at, ...rest } = inst;
                return {
                    ...rest,
                    installment_number: idx + 1
                };
            });
            const res = await updateInstallmentsAction(event.id, payload);
            if (res.success) {
                toast({ title: "Parcelas salvas com sucesso!" });
                setIsEditing(false);
                onUpdate();
            } else {
                toast({ title: "Erro ao salvar", description: res.error, variant: "destructive" });
            }
        } finally {
            setSaving(false);
        }
    };

    const handleCancel = () => {
        setLocalInstallments(event.installments || []);
        setIsEditing(false);
        setExpandedInstallmentId(null);
    };

    const handleRecalculate = async (condition: string) => {
        setSaving(true);
        try {
            // In edit mode, we might want to recalculate locally, but for now let's use the server action
            // to get the new installments structure and then apply it to local state if editing, 
            // OR just save it directly if not editing. 
            // To simplify: Recalculate always saves and refreshes.
            const res = await recalculateInstallmentsAction(event.id, condition);
            if (res.success) {
                toast({ title: "Recalculado com sucesso" });
                onUpdate();
                setRecalculateOpen(false);
            } else {
                toast({ title: "Erro", description: res.error, variant: "destructive" });
            }
        } finally {
            setSaving(false);
        }
    }

    const handleInstallmentChange = (updated: EventInstallment) => {
        setLocalInstallments(prev => prev.map(p => p.id === updated.id ? updated : p));
    };

    const toggleParcelExpand = (id: string) => {
        if (expandedInstallmentId === id) setExpandedInstallmentId(null);
        else setExpandedInstallmentId(id);
    };

    const canEdit = event.status !== 'approved' && event.status !== 'rejected';

    return (
        <Card className="overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Extended Header */}
            <div className="bg-gray-50/50 border-b px-4 py-3 flex flex-col sm:flex-row gap-4 items-center justify-between">
                <div className="flex items-center gap-8 text-sm flex-1">
                    {isEditing ? (
                        <div className="flex flex-col gap-2 w-full">
                            {/* Row 1: Payment Terms and Payment Method */}
                            <div className="flex items-center gap-4">
                                <div className="flex flex-col gap-1 flex-1">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Prazo (Todos)</span>
                                    <select
                                        className="h-8 text-xs border rounded bg-white w-full px-2"
                                        value={globalTermId}
                                        onChange={(e) => {
                                            const newVal = e.target.value;
                                            setGlobalTermId(newVal);
                                            const selectedTerm = paymentTerms.find(t => t.id === newVal);
                                            handleApplyToAll('payment_condition', selectedTerm?.name || null);
                                        }}
                                        disabled={loadingOptions}
                                    >
                                        <option value="">Selecione...</option>
                                        {paymentTerms.map(term => (
                                            <option key={term.id} value={term.id}>{term.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex flex-col gap-1 flex-1">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Forma de Pagto (Todos)</span>
                                    <select
                                        className="h-8 text-xs border rounded bg-white w-full px-2"
                                        value={globalMethod}
                                        onChange={(e) => {
                                            const val = e.target.value || null;
                                            setGlobalMethod(val || "");
                                            handleApplyToAll('payment_method', val);
                                        }}
                                    >
                                        <option value="">Selecione...</option>
                                        <option value="boleto">Boleto</option>
                                        <option value="pix">PIX</option>
                                        <option value="transferencia">Transferência</option>
                                        <option value="cartao_credito">Cartão de Crédito</option>
                                        <option value="dinheiro">Dinheiro</option>
                                        <option value="cheque">Cheque</option>
                                    </select>
                                </div>
                            </div>
                            {/* Row 2: Bank Account, GL Account, Cost Center */}
                            <div className="flex items-center gap-4">
                                <div className="flex flex-col gap-1 flex-1">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Conta Corrente (Todos)</span>
                                    <select
                                        className="h-8 text-xs border rounded bg-white w-full px-2"
                                        value={globalAccountId}
                                        onChange={(e) => {
                                            const val = e.target.value || null;
                                            setGlobalAccountId(val || "");
                                            handleApplyToAll('financial_account_id', val);
                                        }}
                                        disabled={loadingOptions}
                                    >
                                        <option value="">Selecione...</option>
                                        {bankAccounts.map(acc => (
                                            <option key={acc.id} value={acc.id}>{acc.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex flex-col gap-1 flex-1">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Plano de Contas (Todos)</span>
                                    <select
                                        className="h-8 text-xs border rounded bg-white w-full px-2"
                                        value={globalGLAccountId}
                                        onChange={(e) => {
                                            const val = e.target.value || null;
                                            setGlobalGLAccountId(val || "");
                                            handleApplyToAll('suggested_account_id', val);
                                        }}
                                        disabled={loadingOptions}
                                    >
                                        <option value="">Selecione...</option>
                                        {glAccounts.map(acc => (
                                            <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex flex-col gap-1 flex-1">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Centro de Custo (Todos)</span>
                                    <select
                                        className="h-8 text-xs border rounded bg-white w-full px-2"
                                        value={globalCostCenterId}
                                        onChange={(e) => {
                                            const val = e.target.value || null;
                                            setGlobalCostCenterId(val || "");
                                            handleApplyToAll('cost_center_id', val);
                                        }}
                                        disabled={loadingOptions}
                                    >
                                        <option value="">Selecione...</option>
                                        {costCenters.map(cc => (
                                            <option key={cc.id} value={cc.id}>{cc.code ? `${cc.code} - ` : ''}{cc.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Condição</span>
                                <span className="font-semibold text-gray-900 leading-tight">{paymentCondition}</span>
                            </div>

                            <div className="h-8 w-px bg-gray-200" /> {/* Divider */}

                            <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Vencimentos</span>
                                <div className="flex items-center gap-2 text-xs font-medium text-gray-700 leading-tight">
                                    <span>1ª: {dates.next ? formatDate(dates.next) : '-'}</span>
                                    <span className="text-gray-300">|</span>
                                    <span>Últ: {dates.last ? formatDate(dates.last) : '-'}</span>
                                </div>
                            </div>

                            <div className="h-8 w-px bg-gray-200" /> {/* Divider */}

                            <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total vs Soma</span>
                                <div className="flex items-center gap-2 leading-tight">
                                    <span className="font-bold text-gray-900">{formatCurrency(sumTotal)}</span>
                                    {hasMismatch ? (
                                        <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">
                                            Dif: {formatCurrency(difference)}
                                        </Badge>
                                    ) : (
                                        <span className="text-[10px] text-green-600 font-medium bg-green-50 px-1.5 py-0.5 rounded">
                                            Ok
                                        </span>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {canEdit && (
                    <div className="flex items-center gap-2">
                        {!isEditing ? (
                            <>
                                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setRecalculateOpen(true)}>
                                    <RefreshCw className="w-3.5 h-3.5 mr-2 text-gray-500" />
                                    Recalcular
                                </Button>
                                <Button size="sm" className="h-8 text-xs" onClick={() => setIsEditing(true)}>
                                    <Edit2 className="w-3.5 h-3.5 mr-2" />
                                    Editar Parcelas
                                </Button>
                            </>
                        ) : (
                            <>
                                <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={handleCancel} disabled={saving}>
                                    Cancelar
                                </Button>
                                <Button size="sm" className="h-8 text-xs bg-green-600 hover:bg-green-700" onClick={handleSave} disabled={saving || hasMismatch}>
                                    <Save className="w-3.5 h-3.5 mr-2" />
                                    Salvar
                                </Button>
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* Table */}
            <Table>
                <TableHeader>
                    <TableRow className="bg-gray-50/30 text-xs hover:bg-gray-50/30">
                        <TableHead className="w-10 text-center font-bold text-gray-500">#</TableHead>
                        <TableHead className="w-48 font-bold text-gray-500">Vencimento</TableHead>
                        <TableHead className="w-48 text-right font-bold text-gray-500">Valor</TableHead>
                        <TableHead className="w-56 font-bold text-gray-500">Forma Pagto</TableHead>
                        <TableHead className="w-48 font-bold text-gray-500">Conta Destino</TableHead>
                        <TableHead className="font-bold text-gray-500">Classificação</TableHead>
                        <TableHead className="w-20 text-center font-bold text-gray-500">Status</TableHead>
                        <TableHead className="w-12"></TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {localInstallments.map((inst, idx) => (
                        <Fragment key={inst.id}>
                            <TableRow
                                className={cn(
                                    "cursor-pointer hover:bg-gray-50 transition-colors h-10",
                                    expandedInstallmentId === inst.id && "bg-blue-50/30 border-b-0"
                                )}
                                onClick={(e) => {
                                    // Prevent expansion if clicking an input
                                    if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'SELECT') return;
                                    toggleParcelExpand(inst.id);
                                }}
                            >
                                <TableCell className="text-center font-mono text-xs text-gray-400 py-1">
                                    {inst.installment_number}
                                </TableCell>
                                <TableCell className="py-1">
                                    {isEditing ? (
                                        <Input
                                            type="date"
                                            value={inst.due_date ? new Date(inst.due_date).toISOString().split('T')[0] : ''}
                                            onChange={(e) => handleInstallmentChange({ ...inst, due_date: e.target.value })}
                                            className="h-7 text-xs px-2 bg-white"
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                    ) : (
                                        <span className="font-medium text-xs text-gray-900">{formatDate(inst.due_date)}</span>
                                    )}
                                </TableCell>
                                <TableCell className="py-1">
                                    {isEditing ? (
                                        <CurrencyInput
                                            value={inst.amount}
                                            onChange={(newValue) => handleInstallmentChange({ ...inst, amount: newValue })}
                                            className="h-7 text-xs px-2 text-right bg-white font-mono"
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                    ) : (
                                        <div className="text-right font-medium text-xs text-gray-900">{formatCurrency(inst.amount)}</div>
                                    )}
                                </TableCell>
                                <TableCell className="py-1">
                                    {isEditing ? (
                                        <select
                                            className="h-7 text-xs border rounded bg-white w-full px-1"
                                            value={inst.payment_method || ''}
                                            onChange={(e) => handleInstallmentChange({ ...inst, payment_method: e.target.value })}
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <option value="">Selecione...</option>
                                            <option value="boleto">Boleto</option>
                                            <option value="pix">PIX</option>
                                            <option value="transferencia">Transferência</option>
                                            <option value="cartao_credito">Cartão de Crédito</option>
                                            <option value="dinheiro">Dinheiro</option>
                                            <option value="cheque">Cheque</option>
                                        </select>
                                    ) : (
                                        <span className="text-xs text-gray-600 block truncate" title={inst.payment_method || ''}>{inst.payment_method || <span className="text-gray-300">-</span>}</span>
                                    )}
                                </TableCell>

                                <TableCell className="py-1">
                                    {isEditing ? (
                                        <select
                                            className="h-7 text-xs border rounded bg-white w-full px-1"
                                            value={inst.financial_account_id || ''}
                                            onChange={(e) => handleInstallmentChange({ ...inst, financial_account_id: e.target.value || null })}
                                            onClick={(e) => e.stopPropagation()}
                                            disabled={loadingOptions}
                                        >
                                            <option value="">Selecione...</option>
                                            {bankAccounts.map(acc => (
                                                <option key={acc.id} value={acc.id}>{acc.name}</option>
                                            ))}
                                        </select>
                                    ) : (
                                        <span className="text-xs text-gray-600 block truncate" title={bankAccounts.find(a => a.id === inst.financial_account_id)?.name || ''}>
                                            {bankAccounts.find(a => a.id === inst.financial_account_id)?.name || <span className="text-gray-300">-</span>}
                                        </span>
                                    )}
                                </TableCell>

                                <TableCell className="text-xs text-gray-500 py-1">
                                    {isEditing ? (
                                        <div className="flex flex-col gap-1">
                                            {/* Account Select */}
                                            <div className="flex items-center gap-1">
                                                <select
                                                    className="h-7 text-[10px] border rounded bg-white w-full px-1 min-w-48"
                                                    value={inst.suggested_account_id || ''}
                                                    onChange={(e) => handleInstallmentChange({ ...inst, suggested_account_id: e.target.value || null })}
                                                    onClick={(e) => e.stopPropagation()}
                                                    disabled={loadingOptions}
                                                >
                                                    <option value="">Conta...</option>
                                                    {glAccounts.map(acc => (
                                                        <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>
                                                    ))}
                                                </select>
                                                <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-400 hover:text-blue-600" title="Aplicar conta a todos" onClick={(e) => { e.stopPropagation(); handleApplyToAll('suggested_account_id', inst.suggested_account_id); }}>
                                                    <Copy className="w-3 h-3" />
                                                </Button>
                                            </div>

                                            {/* Cost Center Select */}
                                            <div className="flex items-center gap-1">
                                                <select
                                                    className="h-7 text-[10px] border rounded bg-white w-full px-1 min-w-48"
                                                    value={inst.cost_center_id || ''}
                                                    onChange={(e) => handleInstallmentChange({ ...inst, cost_center_id: e.target.value || null })}
                                                    onClick={(e) => e.stopPropagation()}
                                                    disabled={loadingOptions}
                                                >
                                                    <option value="">C. Custo...</option>
                                                    {costCenters.map(cc => (
                                                        <option key={cc.id} value={cc.id}>{cc.code ? `${cc.code} - ` : ''}{cc.name}</option>
                                                    ))}
                                                </select>
                                                <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-400 hover:text-blue-600" title="Aplicar C. Custo a todos" onClick={(e) => { e.stopPropagation(); handleApplyToAll('cost_center_id', inst.cost_center_id); }}>
                                                    <Copy className="w-3 h-3" />
                                                </Button>
                                            </div>
                                        </div>
                                    ) : (
                                    <div className="flex flex-col gap-0.5 max-w-44">
                                            {inst.suggested_account_id ? (
                                                <span className="text-[10px] font-medium text-blue-700 bg-blue-50 px-1 rounded truncate">
                                                    Conta: ...{inst.suggested_account_id.slice(-4)}
                                                </span>
                                            ) : <span className="text-[10px] text-gray-300">S/ Conta</span>}

                                            {inst.cost_center_id ? (
                                                <span className="text-[10px] text-gray-600 border px-1 rounded truncate">
                                                    CC: ...{inst.cost_center_id.slice(-4)}
                                                </span>
                                            ) : <span className="text-[10px] text-gray-300">S/ C. Custo</span>}
                                        </div>
                                    )}
                                </TableCell>
                                <TableCell className="text-center py-1">
                                    <Badge variant="outline" className="text-[9px] h-4 px-1.5 font-normal text-gray-500 bg-gray-50">
                                        Aberta
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-center py-1">
                                    <ChevronDown className={cn("w-3 h-3 text-gray-300 transition-transform", expandedInstallmentId === inst.id && "rotate-180")} />
                                </TableCell>
                            </TableRow>

                            {/* Level 3: Detail Panel */}
                            {
                                expandedInstallmentId === inst.id && (
                                    <TableRow className="bg-blue-50/30 hover:bg-blue-50/30">
                                        <TableCell colSpan={8} className="p-0 border-t-0">
                                            <InstallmentDetailPanel
                                                installment={inst}
                                                isEditing={isEditing}
                                                onChange={handleInstallmentChange}
                                                glAccounts={glAccounts}
                                                costCenters={costCenters}
                                            />
                                        </TableCell>
                                    </TableRow>
                                )
                            }
                        </Fragment>
                    ))}
                    {
                        localInstallments.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={8} className="h-24 text-center text-gray-400">
                                    Nenhuma parcela definida.
                                </TableCell>
                            </TableRow>
                        )
                    }
                </TableBody>
            </Table>

            <RecalculateDialog
                open={recalculateOpen}
                onOpenChange={setRecalculateOpen}
                onConfirm={handleRecalculate}
            />
        </Card>
    );
}

function RecalculateDialog({ open, onOpenChange, onConfirm }: { open: boolean, onOpenChange: (open: boolean) => void, onConfirm: (val: string) => void }) {
    const [val, setVal] = useState("");
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Recalcular Parcelas</DialogTitle>
                </DialogHeader>
                <div className="py-4">
                    <Label>Condição de Pagamento</Label>
                    <Input
                        placeholder="Ex: 30/60/90, 3x30, À vista"
                        value={val}
                        onChange={e => setVal(e.target.value)}
                        className="mt-2"
                    />
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                    <Button onClick={() => onConfirm(val)}>Confirmar</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
