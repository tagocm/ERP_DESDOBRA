"use client";

import { useState, useMemo, useEffect, Fragment } from "react";
import { type FinancialEvent, type EventInstallment } from "@/lib/finance/events-db";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import { Edit2, RefreshCw, Save, ChevronDown, Copy, ListTree } from "lucide-react";
import { InstallmentDetailPanel } from "./InstallmentDetailPanel";
import {
    updateInstallmentsAction,
    recalculateInstallmentsAction,
    listCostCentersAction,
    listBankAccountsAction,
    listPaymentTermsAction,
    getAutomaticAllocationPreviewAction,
    type GLAccountOption,
    type CostCenterOption,
    type BankAccountOption,
    type PaymentTermOption
} from "@/app/actions/finance-events";
import { recalculateInstallments } from "@/lib/utils/finance-calculations";
import { useToast } from "@/components/ui/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/Dialog";
import { Label } from "@/components/ui/Label";
import { Input } from "@/components/ui/Input";
import { CurrencyInput } from "@/components/ui/CurrencyInput";
import { Card } from "@/components/ui/Card";

interface AllocationPreviewRow {
    gl_account_id: string;
    code: string;
    name: string;
    amount: number;
}

interface EventInstallmentsTableProps {
    event: FinancialEvent;
    onUpdate: () => void;
    preloadedOptions?: {
        glAccounts: GLAccountOption[];
        costCenters: CostCenterOption[];
        bankAccounts: BankAccountOption[];
        paymentTerms: PaymentTermOption[];
    }
}

export function EventInstallmentsTable({ event, onUpdate, preloadedOptions }: EventInstallmentsTableProps) {
    const { toast } = useToast();
    const [isEditing, setIsEditing] = useState(true);
    const [localInstallments, setLocalInstallments] = useState<EventInstallment[]>([]);
    const [saving, setSaving] = useState(false);
    const [expandedInstallmentId, setExpandedInstallmentId] = useState<string | null>(null);
    const [recalculateOpen, setRecalculateOpen] = useState(false);
    const [allocationPreviewOpen, setAllocationPreviewOpen] = useState(false);
    const [allocationPreviewLoading, setAllocationPreviewLoading] = useState(false);
    const [allocationPreviewRows, setAllocationPreviewRows] = useState<AllocationPreviewRow[]>([]);

    const [costCenters, setCostCenters] = useState<CostCenterOption[]>(preloadedOptions?.costCenters || []);
    const [bankAccounts, setBankAccounts] = useState<BankAccountOption[]>(preloadedOptions?.bankAccounts || []);
    const [paymentTerms, setPaymentTerms] = useState<PaymentTermOption[]>(preloadedOptions?.paymentTerms || []);
    const [loadingOptions, setLoadingOptions] = useState(false);

    useEffect(() => {
        if (preloadedOptions) {
            setCostCenters(preloadedOptions.costCenters);
            setBankAccounts(preloadedOptions.bankAccounts);
            setPaymentTerms(preloadedOptions.paymentTerms);
        }
    }, [preloadedOptions]);

    const [globalTermId, setGlobalTermId] = useState<string>("");
    const [globalMethod, setGlobalMethod] = useState<string>("");
    const [globalAccountId, setGlobalAccountId] = useState<string>("");
    const [globalCostCenterId, setGlobalCostCenterId] = useState<string>("");

    useEffect(() => {
        setLocalInstallments(
            event.installments?.map((installment) => ({
                ...installment,
                payment_method: installment.payment_method ? installment.payment_method.toLowerCase() : null
            })) || []
        );
    }, [event.installments]);

    useEffect(() => {
        const methods = new Set(localInstallments.map((item) => (item.payment_method ? item.payment_method.toLowerCase() : null)));
        setGlobalMethod(methods.size === 1 ? (Array.from(methods)[0] as string) || "" : "");

        const accounts = new Set(localInstallments.map((item) => item.financial_account_id));
        setGlobalAccountId(accounts.size === 1 ? (Array.from(accounts)[0] as string) || "" : "");

        const centers = new Set(localInstallments.map((item) => item.cost_center_id));
        setGlobalCostCenterId(centers.size === 1 ? (Array.from(centers)[0] as string) || "" : "");

        if (paymentTerms.length > 0) {
            const conditions = new Set(localInstallments.map((item) => item.payment_condition));
            if (conditions.size === 1) {
                const conditionName = Array.from(conditions)[0];
                const term = paymentTerms.find((paymentTerm) => paymentTerm.name === conditionName);
                setGlobalTermId(term?.id || "");
            } else {
                setGlobalTermId("");
            }
        }
    }, [localInstallments, paymentTerms]);

    useEffect(() => {
        if (isEditing && costCenters.length === 0 && !preloadedOptions) {
            setLoadingOptions(true);
            Promise.all([
                listCostCentersAction(event.company_id),
                listBankAccountsAction(event.company_id),
                listPaymentTermsAction(event.company_id)
            ])
                .then(([ccRes, bankRes, termRes]) => {
                    if (ccRes.success) setCostCenters(ccRes.data || []);
                    if (bankRes.success) setBankAccounts(bankRes.data || []);
                    if (termRes.success) setPaymentTerms(termRes.data || []);
                })
                .finally(() => setLoadingOptions(false));
        }
    }, [isEditing, event.company_id, costCenters.length, preloadedOptions]);

    const handleApplyToAll = (field: 'cost_center_id' | 'payment_method' | 'payment_condition' | 'financial_account_id', value: string | null) => {
        setLocalInstallments((previous) => previous.map((installment) => ({ ...installment, [field]: value })));
        toast({ title: "Aplicado a todas as parcelas" });
    };

    const sumTotal = useMemo(() => localInstallments.reduce((sum, installment) => sum + installment.amount, 0), [localInstallments]);
    const difference = sumTotal - event.total_amount;
    const hasMismatch = Math.abs(difference) > 0.01;

    const paymentCondition = useMemo(() => {
        if (localInstallments.length === 0) return "Nenhuma";
        const conditions = new Set(localInstallments.map((item) => item.payment_condition).filter(Boolean));
        if (conditions.size === 1) return Array.from(conditions)[0] as string;
        return "Mista / Personalizada";
    }, [localInstallments]);

    const dates = useMemo(() => {
        if (localInstallments.length === 0) return { next: null, last: null };
        const sorted = [...localInstallments].sort(
            (left, right) => new Date(left.due_date).getTime() - new Date(right.due_date).getTime()
        );
        return {
            next: sorted[0].due_date,
            last: sorted[sorted.length - 1].due_date
        };
    }, [localInstallments]);

    const classificationSummary = useMemo(() => {
        if (allocationPreviewRows.length > 0) {
            return `${allocationPreviewRows.length} conta${allocationPreviewRows.length > 1 ? 's' : ''}`;
        }
        const distinctAccounts = new Set(localInstallments.map((item) => item.suggested_account_id).filter(Boolean));
        if (distinctAccounts.size > 0) {
            return `${distinctAccounts.size} conta${distinctAccounts.size > 1 ? 's' : ''}`;
        }
        return 'A definir automaticamente';
    }, [allocationPreviewRows, localInstallments]);

    const openAllocationPreview = async () => {
        setAllocationPreviewOpen(true);
        setAllocationPreviewLoading(true);
        try {
            const response = await getAutomaticAllocationPreviewAction(event.id);
            if (!response.success || !response.data) {
                toast({
                    title: "Falha ao carregar rateio",
                    description: response.error || "Não foi possível montar o rateio automático",
                    variant: "destructive"
                });
                setAllocationPreviewRows([]);
                return;
            }
            setAllocationPreviewRows(response.data);
        } finally {
            setAllocationPreviewLoading(false);
        }
    };

    const handleSave = async () => {
        if (hasMismatch) {
            toast({
                title: "Erro de validação",
                description: "A soma das parcelas deve bater com o total do evento.",
                variant: "destructive"
            });
            return;
        }

        setSaving(true);
        try {
            const payload = localInstallments.map((installment, index) => {
                const { id, event_id, created_at, updated_at, ...rest } = installment;
                return {
                    ...rest,
                    installment_number: index + 1
                };
            });
            const result = await updateInstallmentsAction(event.id, payload);
            if (result.success) {
                toast({ title: "Parcelas salvas com sucesso!" });
                setIsEditing(false);
                onUpdate();
            } else {
                toast({ title: "Erro ao salvar", description: result.error, variant: "destructive" });
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
            const result = await recalculateInstallmentsAction(event.id, condition);
            if (result.success) {
                toast({ title: "Recalculado com sucesso" });
                onUpdate();
                setRecalculateOpen(false);
            } else {
                toast({ title: "Erro", description: result.error, variant: "destructive" });
            }
        } finally {
            setSaving(false);
        }
    };

    const handleInstallmentChange = (updated: EventInstallment) => {
        setLocalInstallments((previous) => previous.map((item) => (item.id === updated.id ? updated : item)));
    };

    const toggleParcelExpand = (id: string) => {
        if (expandedInstallmentId === id) {
            setExpandedInstallmentId(null);
        } else {
            setExpandedInstallmentId(id);
        }
    };

    const canEdit = event.status !== 'approved' && event.status !== 'rejected';

    return (
        <Card className="overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-gray-50/50 border-b px-4 py-3 flex flex-col sm:flex-row gap-4 items-center justify-between">
                <div className="flex items-center gap-8 text-sm flex-1">
                    {isEditing ? (
                        <div className="flex flex-col gap-2 w-full">
                            <div className="flex items-center gap-4">
                                <div className="flex flex-col gap-1 flex-1">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Prazo (Todos)</span>
                                    <select
                                        className="h-8 text-xs border rounded bg-white w-full px-2"
                                        value={globalTermId}
                                        onChange={(eventChange) => {
                                            const termId = eventChange.target.value;
                                            setGlobalTermId(termId);
                                            const selectedTerm = paymentTerms.find((term) => term.id === termId);

                                            if (!selectedTerm) {
                                                handleApplyToAll('payment_condition', null);
                                                return;
                                            }

                                            const baseDate = new Date(event.issue_date);
                                            const recalculated = recalculateInstallments(
                                                event.total_amount,
                                                baseDate,
                                                {
                                                    installments_count: selectedTerm.installments_count,
                                                    first_due_days: selectedTerm.first_due_days,
                                                    cadence_days: selectedTerm.cadence_days
                                                },
                                                globalMethod,
                                                selectedTerm.name
                                            );

                                            const merged = recalculated.map((installment, index) => ({
                                                ...installment,
                                                id: localInstallments[index]?.id,
                                                event_id: event.id,
                                                financial_account_id: globalAccountId || null,
                                                cost_center_id: globalCostCenterId || null
                                            })) as EventInstallment[];

                                            setLocalInstallments(merged);
                                            toast({
                                                title: `Recalculado para ${selectedTerm.name}`,
                                                description: `${selectedTerm.installments_count} parcelas criadas automaticamente`
                                            });
                                        }}
                                        disabled={loadingOptions}
                                    >
                                        <option value="">Selecione...</option>
                                        {paymentTerms.map((term) => (
                                            <option key={term.id} value={term.id}>{term.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex flex-col gap-1 flex-1">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Forma de Pagto (Todos)</span>
                                    <select
                                        className="h-8 text-xs border rounded bg-white w-full px-2"
                                        value={globalMethod}
                                        onChange={(eventChange) => {
                                            const value = eventChange.target.value || null;
                                            setGlobalMethod(value || "");
                                            handleApplyToAll('payment_method', value);
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

                            <div className="flex items-center gap-4">
                                <div className="flex flex-col gap-1 flex-1">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Conta Corrente (Todos)</span>
                                    <select
                                        className="h-8 text-xs border rounded bg-white w-full px-2"
                                        value={globalAccountId}
                                        onChange={(eventChange) => {
                                            const value = eventChange.target.value || null;
                                            setGlobalAccountId(value || "");
                                            handleApplyToAll('financial_account_id', value);
                                        }}
                                        disabled={loadingOptions}
                                    >
                                        <option value="">Selecione...</option>
                                        {bankAccounts.map((account) => (
                                            <option key={account.id} value={account.id}>{account.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex flex-col gap-1 flex-1">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Centro de Custo (Todos)</span>
                                    <select
                                        className="h-8 text-xs border rounded bg-white w-full px-2"
                                        value={globalCostCenterId}
                                        onChange={(eventChange) => {
                                            const value = eventChange.target.value || null;
                                            setGlobalCostCenterId(value || "");
                                            handleApplyToAll('cost_center_id', value);
                                        }}
                                        disabled={loadingOptions}
                                    >
                                        <option value="">Selecione...</option>
                                        {costCenters.map((costCenter) => (
                                            <option key={costCenter.id} value={costCenter.id}>
                                                {costCenter.code ? `${costCenter.code} - ` : ''}{costCenter.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex flex-col gap-1 flex-1">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Classificação</span>
                                    <div className="h-8 px-2 rounded border bg-white flex items-center justify-between text-xs">
                                        <span className="text-gray-600 font-medium">Automática ({classificationSummary})</span>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 text-xs text-blue-600 hover:text-blue-700"
                                            onClick={openAllocationPreview}
                                        >
                                            <ListTree className="w-3.5 h-3.5 mr-1" />
                                            Ver rateio
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Condição</span>
                                <span className="font-semibold text-gray-900 leading-tight">{paymentCondition}</span>
                            </div>
                            <div className="h-8 w-px bg-gray-200" />
                            <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Vencimentos</span>
                                <div className="flex items-center gap-2 text-xs font-medium text-gray-700 leading-tight">
                                    <span>1ª: {dates.next ? formatDate(dates.next) : '-'}</span>
                                    <span className="text-gray-300">|</span>
                                    <span>Últ: {dates.last ? formatDate(dates.last) : '-'}</span>
                                </div>
                            </div>
                            <div className="h-8 w-px bg-gray-200" />
                            <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total vs Soma</span>
                                <div className="flex items-center gap-2 leading-tight">
                                    <span className="font-bold text-gray-900">{formatCurrency(sumTotal)}</span>
                                    {hasMismatch ? (
                                        <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">Dif: {formatCurrency(difference)}</Badge>
                                    ) : (
                                        <span className="text-[10px] text-green-600 font-medium bg-green-50 px-1.5 py-0.5 rounded">Ok</span>
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
                        <TableHead className="w-12" />
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {localInstallments.map((installment, index) => (
                        <Fragment key={installment.id || `temp-${index}`}>
                            <TableRow
                                className={cn(
                                    "cursor-pointer hover:bg-gray-50 transition-colors h-10",
                                    expandedInstallmentId === installment.id && "bg-blue-50/30 border-b-0"
                                )}
                                onClick={(eventClick) => {
                                    const target = eventClick.target as HTMLElement;
                                    if (target.tagName === 'INPUT' || target.tagName === 'SELECT') return;
                                    toggleParcelExpand(installment.id);
                                }}
                            >
                                <TableCell className="text-center font-mono text-xs text-gray-400 py-1">{installment.installment_number}</TableCell>
                                <TableCell className="py-1">
                                    {isEditing ? (
                                        <Input
                                            type="date"
                                            value={installment.due_date ? new Date(installment.due_date).toISOString().split('T')[0] : ''}
                                            onChange={(eventChange) => handleInstallmentChange({ ...installment, due_date: eventChange.target.value })}
                                            className="h-7 text-xs px-2 bg-white"
                                            onClick={(eventClick) => eventClick.stopPropagation()}
                                        />
                                    ) : (
                                        <span className="font-medium text-xs text-gray-900">{formatDate(installment.due_date)}</span>
                                    )}
                                </TableCell>
                                <TableCell className="py-1">
                                    {isEditing ? (
                                        <CurrencyInput
                                            value={installment.amount}
                                            onChange={(newValue) => handleInstallmentChange({ ...installment, amount: newValue })}
                                            className="h-7 text-xs px-2 text-right bg-white font-mono"
                                            onClick={(eventClick) => eventClick.stopPropagation()}
                                        />
                                    ) : (
                                        <div className="text-right font-medium text-xs text-gray-900">{formatCurrency(installment.amount)}</div>
                                    )}
                                </TableCell>
                                <TableCell className="py-1">
                                    {isEditing ? (
                                        <select
                                            className="h-7 text-xs border rounded bg-white w-full px-1"
                                            value={installment.payment_method || ''}
                                            onChange={(eventChange) => handleInstallmentChange({ ...installment, payment_method: eventChange.target.value })}
                                            onClick={(eventClick) => eventClick.stopPropagation()}
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
                                        <span className="text-xs text-gray-600 block truncate" title={installment.payment_method || ''}>
                                            {installment.payment_method || <span className="text-gray-300">-</span>}
                                        </span>
                                    )}
                                </TableCell>
                                <TableCell className="py-1">
                                    {isEditing ? (
                                        <select
                                            className="h-7 text-xs border rounded bg-white w-full px-1"
                                            value={installment.financial_account_id || ''}
                                            onChange={(eventChange) => handleInstallmentChange({ ...installment, financial_account_id: eventChange.target.value || null })}
                                            onClick={(eventClick) => eventClick.stopPropagation()}
                                            disabled={loadingOptions}
                                        >
                                            <option value="">Selecione...</option>
                                            {bankAccounts.map((account) => (
                                                <option key={account.id} value={account.id}>{account.name}</option>
                                            ))}
                                        </select>
                                    ) : (
                                        <span className="text-xs text-gray-600 block truncate" title={bankAccounts.find((account) => account.id === installment.financial_account_id)?.name || ''}>
                                            {bankAccounts.find((account) => account.id === installment.financial_account_id)?.name || <span className="text-gray-300">-</span>}
                                        </span>
                                    )}
                                </TableCell>
                                <TableCell className="text-xs text-gray-500 py-1">
                                    {isEditing ? (
                                        <div className="flex flex-col gap-1">
                                            <div className="h-7 px-2 rounded border bg-white flex items-center justify-between">
                                                <span className="text-[10px] font-medium text-gray-600">Classificação automática</span>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-6 text-[10px] text-blue-600 hover:text-blue-700"
                                                    onClick={(eventClick) => {
                                                        eventClick.stopPropagation();
                                                        void openAllocationPreview();
                                                    }}
                                                >
                                                    Ver rateio
                                                </Button>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <select
                                                    className="h-7 text-[10px] border rounded bg-white w-full px-1 min-w-48"
                                                    value={installment.cost_center_id || ''}
                                                    onChange={(eventChange) => handleInstallmentChange({ ...installment, cost_center_id: eventChange.target.value || null })}
                                                    onClick={(eventClick) => eventClick.stopPropagation()}
                                                    disabled={loadingOptions}
                                                >
                                                    <option value="">C. Custo...</option>
                                                    {costCenters.map((costCenter) => (
                                                        <option key={costCenter.id} value={costCenter.id}>
                                                            {costCenter.code ? `${costCenter.code} - ` : ''}{costCenter.name}
                                                        </option>
                                                    ))}
                                                </select>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6 text-gray-400 hover:text-blue-600"
                                                    title="Aplicar C. Custo a todos"
                                                    onClick={(eventClick) => {
                                                        eventClick.stopPropagation();
                                                        handleApplyToAll('cost_center_id', installment.cost_center_id);
                                                    }}
                                                >
                                                    <Copy className="w-3 h-3" />
                                                </Button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col gap-0.5 max-w-44">
                                            <span className="text-[10px] font-medium text-blue-700 bg-blue-50 px-1 rounded truncate">
                                                Classificação automática
                                            </span>
                                            {installment.cost_center_id ? (
                                                <span className="text-[10px] text-gray-600 border px-1 rounded truncate">
                                                    CC: ...{installment.cost_center_id.slice(-4)}
                                                </span>
                                            ) : (
                                                <span className="text-[10px] text-gray-300">S/ C. Custo</span>
                                            )}
                                        </div>
                                    )}
                                </TableCell>
                                <TableCell className="text-center py-1">
                                    <Badge variant="outline" className="text-[9px] h-4 px-1.5 font-normal text-gray-500 bg-gray-50">Aberta</Badge>
                                </TableCell>
                                <TableCell className="text-center py-1">
                                    <ChevronDown className={cn("w-3 h-3 text-gray-300 transition-transform", expandedInstallmentId === installment.id && "rotate-180")} />
                                </TableCell>
                            </TableRow>

                            {expandedInstallmentId === installment.id && (
                                <TableRow className="bg-blue-50/30 hover:bg-blue-50/30">
                                    <TableCell colSpan={8} className="p-0 border-t-0">
                                        <InstallmentDetailPanel
                                            installment={installment}
                                            isEditing={isEditing}
                                            onChange={handleInstallmentChange}
                                            glAccounts={[]}
                                            costCenters={costCenters}
                                        />
                                    </TableCell>
                                </TableRow>
                            )}
                        </Fragment>
                    ))}

                    {localInstallments.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={8} className="h-24 text-center text-gray-400">
                                Nenhuma parcela definida.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>

            <RecalculateDialog
                open={recalculateOpen}
                onOpenChange={setRecalculateOpen}
                onConfirm={handleRecalculate}
            />

            <AllocationPreviewDialog
                open={allocationPreviewOpen}
                loading={allocationPreviewLoading}
                rows={allocationPreviewRows}
                onOpenChange={setAllocationPreviewOpen}
            />
        </Card>
    );
}

function RecalculateDialog({
    open,
    onOpenChange,
    onConfirm
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: (value: string) => void;
}) {
    const [value, setValue] = useState("");

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
                        value={value}
                        onChange={(eventChange) => setValue(eventChange.target.value)}
                        className="mt-2"
                    />
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                    <Button onClick={() => onConfirm(value)}>Confirmar</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function AllocationPreviewDialog({
    open,
    onOpenChange,
    loading,
    rows
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    loading: boolean;
    rows: AllocationPreviewRow[];
}) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-3xl">
                <DialogHeader>
                    <DialogTitle>Rateio contábil automático</DialogTitle>
                </DialogHeader>
                <div className="border rounded-xl overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Conta</TableHead>
                                <TableHead>Descrição</TableHead>
                                <TableHead className="text-right">Valor</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={3} className="text-center text-sm text-gray-500">Carregando rateio...</TableCell>
                                </TableRow>
                            ) : rows.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={3} className="text-center text-sm text-gray-500">
                                        Rateio ainda não disponível para este evento.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                rows.map((row) => (
                                    <TableRow key={row.gl_account_id}>
                                        <TableCell className="font-medium">{row.code}</TableCell>
                                        <TableCell>{row.name}</TableCell>
                                        <TableCell className="text-right font-semibold">{formatCurrency(row.amount)}</TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
