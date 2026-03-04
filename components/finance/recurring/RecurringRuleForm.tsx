"use client";

import { useEffect, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter, useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { CardHeaderStandard } from "@/components/ui/CardHeaderStandard";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/components/ui/use-toast";
import {
    createRecurringRuleAction,
    updateRecurringRuleAction,
    getRecurringRuleByIdAction,
    CreateRecurringRuleInput
} from "@/app/actions/recurring-rules";
import { listPaymentModesAction } from "@/app/actions/payment-mode-actions";
import { RecurringRuleDTO } from "@/lib/types/recurring-dto";
import { OrganizationSelector } from "@/components/app/OrganizationSelector";
import { CurrencyInput } from "@/components/ui/CurrencyInput";
import {
    CalendarClock,
    FileText,
    Wallet,
    Info,
    CalendarRange,
    Zap,
    Trash2
} from "lucide-react";
import { useCompany } from "@/contexts/CompanyContext";
import { FinancialCategorySelector } from "./FinancialCategorySelector";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/Button";
import { todayInBrasilia, toDateInputValue } from "@/lib/utils";

// Validation Schema
const formSchema = z.object({
    name: z.string().min(3, "Nome muito curto"),
    partner_name: z.string().min(3, "Fornecedor obrigatório"),
    partner_id: z.string().optional().nullable(),
    payment_mode_id: z.string().optional().nullable(),
    category_id: z.string().min(1, "Categoria obrigatória"),
    cost_center_id: z.string().optional().nullable(),
    description: z.string().optional().nullable(),

    // Validity
    valid_from: z.string().min(1, "Início da vigência obrigatório"),
    valid_to: z.string().optional().nullable().or(z.literal('')),

    // Billing
    generation_mode: z.enum(['AUTOMATICO', 'MANUAL']),
    billing_plan_type: z.enum(['RECORRENTE', 'PARCELADO']).optional().nullable(),
    first_due_date: z.string().optional().nullable().or(z.literal('')),
    installments_count: z.coerce.number().optional().nullable(),
    frequency: z.string().default('MENSAL'),

    // Values
    amount_type: z.enum(['FIXO', 'VARIAVEL']),
    fixed_amount: z.number().optional().nullable(),
    contract_amount: z.number().optional().nullable(),
    estimated_amount: z.number().optional().nullable(),

    status: z.enum(['ATIVO', 'RASCUNHO']),
    manual_installments: z.array(
        z.object({
            installment_number: z.coerce.number().int().positive("Número da parcela deve ser maior que zero"),
            due_date: z.string().min(1, "Data da parcela obrigatória"),
            amount: z.number().positive("Valor da parcela deve ser maior que zero"),
        })
    ).optional().default([]),
}).refine(data => {
    if (data.valid_to && data.valid_from && data.valid_to < data.valid_from) return false;
    return true;
}, {
    message: "Fim da vigência deve ser posterior ao início",
    path: ["valid_to"]
}).refine(data => {
    if (data.generation_mode === 'AUTOMATICO') {
        return !!data.billing_plan_type && !!data.first_due_date;
    }
    return true;
}, {
    message: "Para modo automático, plano e data do 1º vencimento são obrigatórios",
    path: ["generation_mode"]
}).refine(data => {
    if (data.billing_plan_type === 'PARCELADO' && (!data.installments_count || data.installments_count <= 0)) {
        return false;
    }
    return true;
}, {
    message: "Quantidade de lançamentos deve ser maior que zero",
    path: ["installments_count"]
}).refine(data => {
    if (data.generation_mode === 'AUTOMATICO' && data.amount_type === 'FIXO') {
        const recurring = Number(data.fixed_amount || 0);
        const contract = Number(data.contract_amount || 0);
        if (recurring > 0 || contract > 0) return true;
        return false;
    }
    return true;
}, {
    message: "No modo automático, preencha o Valor Recorrente ou o Valor do Contrato",
    path: ["fixed_amount"]
}).refine(data => {
    if (data.generation_mode === 'MANUAL') {
        return (data.manual_installments?.length || 0) > 0;
    }
    return true;
}, {
    message: "Adicione ao menos uma parcela no modo manual",
    path: ["manual_installments"]
});

type FormValues = z.infer<typeof formSchema>;

const FREQUENCY_OPTIONS = [
    { value: "MENSAL", label: "Mensal", previewAdverb: "mensalmente", previewPlural: "mensais", stepUnit: "months", stepValue: 1 },
    { value: "QUINZENAL", label: "Quinzenal", previewAdverb: "quinzenalmente", previewPlural: "quinzenais", stepUnit: "days", stepValue: 15 },
    { value: "SEMANAL", label: "Semanal", previewAdverb: "semanalmente", previewPlural: "semanais", stepUnit: "days", stepValue: 7 },
    { value: "DIARIO", label: "Diária", previewAdverb: "diariamente", previewPlural: "diários", stepUnit: "days", stepValue: 1 },
    { value: "BIMESTRAL", label: "Bimestral", previewAdverb: "bimestralmente", previewPlural: "bimestrais", stepUnit: "months", stepValue: 2 },
    { value: "TRIMESTRAL", label: "Trimestral", previewAdverb: "trimestralmente", previewPlural: "trimestrais", stepUnit: "months", stepValue: 3 },
    { value: "SEMESTRAL", label: "Semestral", previewAdverb: "semestralmente", previewPlural: "semestrais", stepUnit: "months", stepValue: 6 },
    { value: "ANUAL", label: "Anual", previewAdverb: "anualmente", previewPlural: "anuais", stepUnit: "years", stepValue: 1 },
] as const;

function formatDatePtBr(dateValue?: string | null): string {
    if (!dateValue) return "DD/MM/AAAA";
    const parts = String(dateValue).split("-");
    if (parts.length !== 3) return "DD/MM/AAAA";
    const [year, month, day] = parts;
    if (!year || !month || !day) return "DD/MM/AAAA";
    return `${day}/${month}/${year}`;
}

function parseIsoDate(dateValue?: string | null): Date | null {
    if (!dateValue) return null;
    const parts = String(dateValue).split("-");
    if (parts.length !== 3) return null;
    const [year, month, day] = parts.map((v) => Number(v));
    if (!year || !month || !day) return null;
    return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function addFrequency(baseDate: Date, frequency: typeof FREQUENCY_OPTIONS[number]): Date {
    const next = new Date(baseDate);
    if (frequency.stepUnit === "days") {
        next.setDate(next.getDate() + frequency.stepValue);
    } else if (frequency.stepUnit === "months") {
        next.setMonth(next.getMonth() + frequency.stepValue);
    } else {
        next.setFullYear(next.getFullYear() + frequency.stepValue);
    }
    return next;
}

function formatCurrencyPtBr(value: number): string {
    return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
    }).format(value);
}

export function RecurringRuleForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { toast } = useToast();
    const { selectedCompany } = useCompany();
    const recurringRuleId = searchParams.get("id");
    const [isLoadingRule, setIsLoadingRule] = useState(false);
    const [paymentModes, setPaymentModes] = useState<Array<{ id: string; name: string }>>([]);

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema) as any,
        defaultValues: {
            generation_mode: 'AUTOMATICO',
            billing_plan_type: 'RECORRENTE',
            valid_from: todayInBrasilia(),
            amount_type: 'FIXO',
            status: 'ATIVO',
            frequency: 'MENSAL',
            payment_mode_id: null,
            category_id: '',
            contract_amount: null,
            manual_installments: []
        }
    });

    const { register, control, handleSubmit, watch, setValue, getValues, formState: { errors } } = form;
    const manualInstallmentsFieldArray = useFieldArray({
        control,
        name: "manual_installments",
    });

    // Watchers
    const watchGenMode = watch("generation_mode");
    const watchPlanType = watch("billing_plan_type");
    const watchAmountType = watch("amount_type");
    const watchInstallments = watch("installments_count");
    const watchValidTo = watch("valid_to");
    const watchFirstDue = watch("first_due_date");
    const watchFrequency = watch("frequency");
    const watchFixedAmount = watch("fixed_amount");
    const watchContractAmount = watch("contract_amount");
    const watchEstimatedAmount = watch("estimated_amount");
    const watchPaymentModeId = watch("payment_mode_id");
    const watchManualInstallments = watch("manual_installments");
    const watchManualInstallmentsLength = watchManualInstallments?.length ?? 0;
    const [activeFixedValueField, setActiveFixedValueField] = useState<"RECORRENTE" | "CONTRATO">("RECORRENTE");
    const [hasManualInstallmentAmountOverride, setHasManualInstallmentAmountOverride] = useState(false);
    const forceAutomaticGeneration = watchAmountType === "VARIAVEL" || (watchAmountType === "FIXO" && activeFixedValueField === "RECORRENTE");
    const forceManualGeneration = watchAmountType === "FIXO" && activeFixedValueField === "CONTRATO";
    const effectiveGenerationMode = forceAutomaticGeneration
        ? "AUTOMATICO"
        : forceManualGeneration
            ? "MANUAL"
            : watchGenMode;
    const contractAmountValue = Number(watchContractAmount || 0);
    const manualInstallmentsTotal = (watchManualInstallments || []).reduce(
        (acc, item) => acc + Number(item?.amount || 0),
        0
    );
    const isContractManualMismatch = forceManualGeneration
        && contractAmountValue > 0
        && Math.round(manualInstallmentsTotal * 100) !== Math.round(contractAmountValue * 100);
    const selectedFrequency =
        FREQUENCY_OPTIONS.find((opt) => opt.value === watchFrequency) ||
        FREQUENCY_OPTIONS[0];

    useEffect(() => {
        const loadPaymentModes = async () => {
            const result = await listPaymentModesAction();
            if (!result.ok) {
                toast({
                    title: "Erro ao carregar formas de pagamento",
                    description: result.error?.message || "Não foi possível carregar as formas de pagamento.",
                    variant: "destructive",
                });
                return;
            }
            setPaymentModes((result.data || []).filter((mode) => mode.is_active).map((mode) => ({ id: mode.id, name: mode.name })));
        };

        if (selectedCompany?.id) {
            loadPaymentModes();
        } else {
            setPaymentModes([]);
        }
    }, [selectedCompany?.id, toast]);

    useEffect(() => {
        let active = true;
        const loadRule = async () => {
            if (!recurringRuleId) return;
            setIsLoadingRule(true);
            const result = await getRecurringRuleByIdAction(recurringRuleId);
            if (!active) return;

            if (!result.success || !result.data) {
                toast({
                    title: "Erro ao carregar",
                    description: result.error || "Fato gerador não encontrado.",
                    variant: "destructive",
                });
                router.push("/app/financeiro/fatos-geradores");
                return;
            }

            const rule = result.data as RecurringRuleDTO;
            setValue("name", rule.name || "");
            setValue("partner_name", rule.partner_name || "");
            setValue("partner_id", rule.partner_id || null);
            setValue("payment_mode_id", rule.payment_mode_id || null);
            setValue("category_id", rule.category_id || "");
            setValue("cost_center_id", rule.cost_center_id || null);
            setValue("description", rule.description || "");
            setValue("valid_from", rule.valid_from || "");
            setValue("valid_to", rule.valid_to || null);
            setValue("generation_mode", rule.generation_mode || "AUTOMATICO");
            setValue("billing_plan_type", rule.billing_plan_type || null);
            setValue("first_due_date", rule.first_due_date || null);
            setValue("installments_count", rule.installments_count || null);
            setValue("frequency", rule.frequency || "MENSAL");
            setValue("amount_type", rule.amount_type || "FIXO");
            setValue("fixed_amount", rule.fixed_amount || null);
            setValue("contract_amount", rule.contract_amount || null);
            setValue("estimated_amount", rule.estimated_amount || null);
            setValue("manual_installments", (rule.manual_installments || []).map((item, index) => ({
                installment_number: Number(item.installment_number || index + 1),
                due_date: item.due_date || "",
                amount: Number(item.amount || 0),
            })));

            if (rule.amount_type === "FIXO") {
                if (Number(rule.contract_amount || 0) > 0 && Number(rule.fixed_amount || 0) <= 0) {
                    setActiveFixedValueField("CONTRATO");
                } else {
                    setActiveFixedValueField("RECORRENTE");
                }
            }
            setIsLoadingRule(false);
        };

        loadRule();
        return () => {
            active = false;
        };
    }, [recurringRuleId, router, setValue, toast]);

    useEffect(() => {
        const recurringValue = Number(watchFixedAmount || 0);
        const contractValue = Number(watchContractAmount || 0);

        if (recurringValue > 0 && contractValue <= 0) {
            setActiveFixedValueField("RECORRENTE");
            return;
        }

        if (contractValue > 0 && recurringValue <= 0) {
            setActiveFixedValueField("CONTRATO");
        }
    }, [watchFixedAmount, watchContractAmount]);

    useEffect(() => {
        if (!forceAutomaticGeneration) return;
        if (watchGenMode !== "AUTOMATICO") {
            setValue("generation_mode", "AUTOMATICO");
        }
        if (watchPlanType !== "RECORRENTE") {
            setValue("billing_plan_type", "RECORRENTE");
        }
        if (watchManualInstallmentsLength > 0) {
            setValue("manual_installments", []);
        }
        if (watchInstallments) {
            setValue("installments_count", null);
        }
    }, [forceAutomaticGeneration, setValue, watchGenMode, watchInstallments, watchManualInstallmentsLength, watchPlanType]);

    useEffect(() => {
        if (!forceManualGeneration) return;
        if (watchGenMode !== "MANUAL") {
            setValue("generation_mode", "MANUAL");
        }
        if (watchPlanType) {
            setValue("billing_plan_type", null);
        }
        if (watchFirstDue) {
            setValue("first_due_date", null);
        }
        if (watchInstallments) {
            setValue("installments_count", null);
        }
        if (watchManualInstallmentsLength === 0) {
            setValue("manual_installments", [{ installment_number: 1, due_date: "", amount: 0 }], { shouldValidate: true });
        }
    }, [forceManualGeneration, setValue, watchFirstDue, watchGenMode, watchInstallments, watchManualInstallmentsLength, watchPlanType]);

    useEffect(() => {
        if (!forceManualGeneration) return;
        if (hasManualInstallmentAmountOverride) return;
        if (watchManualInstallmentsLength <= 0) return;

        const totalCents = Math.round(contractAmountValue * 100);
        const baseCents = Math.floor(totalCents / watchManualInstallmentsLength);
        const remainder = totalCents - (baseCents * watchManualInstallmentsLength);
        const currentInstallments = watchManualInstallments || [];

        const distributed = currentInstallments.map((item, index) => {
            const cents = baseCents + (index < remainder ? 1 : 0);
            return {
                installment_number: Number(item?.installment_number || index + 1),
                due_date: item?.due_date || "",
                amount: cents / 100,
            };
        });

        const hasChanges = distributed.some((item, index) => {
            const current = currentInstallments[index];
            return (
                Number(current?.installment_number || 0) !== item.installment_number
                || String(current?.due_date || "") !== item.due_date
                || Math.round(Number(current?.amount || 0) * 100) !== Math.round(item.amount * 100)
            );
        });

        if (!hasChanges) return;

        setValue("manual_installments", distributed, { shouldValidate: true });
    }, [
        contractAmountValue,
        forceManualGeneration,
        hasManualInstallmentAmountOverride,
        setValue,
        watchManualInstallments,
        watchManualInstallmentsLength,
    ]);

    useEffect(() => {
        if (watchManualInstallmentsLength <= 0) return;
        const currentInstallments = getValues("manual_installments") || [];
        const needsRenumber = currentInstallments.some((item, index) => Number(item?.installment_number || 0) !== index + 1);
        if (!needsRenumber) return;

        const renumberedInstallments = currentInstallments.map((item, index) => ({
            ...item,
            installment_number: index + 1,
        }));

        setValue("manual_installments", renumberedInstallments, { shouldValidate: true });
    }, [getValues, setValue, watchManualInstallments, watchManualInstallmentsLength]);

    const onSubmit = async (data: FormValues) => {
        const payload: CreateRecurringRuleInput = {
            ...data,
            cost_center_id: data.cost_center_id && data.cost_center_id !== "default" ? data.cost_center_id : null,
            status: "ATIVO",
        };
        const result = recurringRuleId
            ? await updateRecurringRuleAction(recurringRuleId, payload)
            : await createRecurringRuleAction(payload);

        if (result.success) {
            toast({
                title: "Sucesso!",
                description: recurringRuleId ? "Fato gerador atualizado com sucesso." : "Fato gerador cadastrado com sucesso."
            });
            router.push("/app/financeiro/fatos-geradores");
        } else {
            toast({ title: "Erro ao salvar", description: result.error, variant: "destructive" });
        }
    };

    const previewRows = (() => {
        if (effectiveGenerationMode === "MANUAL") {
            const sortedManual = [...(watchManualInstallments || [])]
                .filter((item) => item?.due_date)
                .sort((a, b) => {
                    const aNum = Number(a?.installment_number || 0);
                    const bNum = Number(b?.installment_number || 0);
                    if (aNum !== bNum) return aNum - bNum;
                    return String(a?.due_date || "").localeCompare(String(b?.due_date || ""));
                });

            return sortedManual.map((item, idx) => ({
                installmentLabel: `${Number(item.installment_number || (idx + 1))}/${sortedManual.length}`,
                dueDateLabel: formatDatePtBr(item.due_date),
                amountLabel: formatCurrencyPtBr(Number(item.amount || 0)),
            }));
        }

        const firstDue = parseIsoDate(watchFirstDue);
        if (!firstDue) return [] as Array<{ installmentLabel: string; dueDateLabel: string; amountLabel: string }>;

        const validTo = parseIsoDate(watchValidTo);
        const isParcelado = watchPlanType === "PARCELADO";
        const targetCount = isParcelado
            ? Math.max(0, Number(watchInstallments || 0))
            : 24; // Recorrente sem fim: mostrar janela de previsão

        const rows: Array<{ installmentLabel: string; dueDateLabel: string; amountLabel: string }> = [];
        let dueDate = firstDue;
        let idx = 1;

        while (rows.length < targetCount) {
            if (validTo && dueDate > validTo) break;

            const amountLabel = watchAmountType === "FIXO"
                ? (() => {
                    const recurringAmount = Number(watchFixedAmount || 0);
                    const contractAmount = Number(watchContractAmount || 0);
                    if (recurringAmount > 0) return formatCurrencyPtBr(recurringAmount);
                    if (contractAmount > 0 && isParcelado && targetCount > 0) {
                        return formatCurrencyPtBr(contractAmount / targetCount);
                    }
                    if (contractAmount > 0) return formatCurrencyPtBr(contractAmount);
                    return formatCurrencyPtBr(0);
                })()
                : watchEstimatedAmount && Number(watchEstimatedAmount) > 0
                    ? `${formatCurrencyPtBr(Number(watchEstimatedAmount))} (estimado)`
                    : "Variável";

            rows.push({
                installmentLabel: isParcelado ? `${idx}/${targetCount}` : `${idx}`,
                dueDateLabel: formatDatePtBr(toDateInputValue(dueDate)),
                amountLabel,
            });

            dueDate = addFrequency(dueDate, selectedFrequency);
            idx += 1;
        }

        return rows;
    })();

    if (isLoadingRule) {
        return (
            <div className="h-52 flex items-center justify-center text-gray-500 text-sm font-medium">
                Carregando fato gerador...
            </div>
        );
    }

    return (
        <form id="recurring-rule-form" onSubmit={handleSubmit(onSubmit)} className="w-full">
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-3 lg:items-stretch">
                <div className="lg:col-span-2">
                    {/* Card A: Identificação */}
                    <Card className="border-none shadow-card rounded-2xl bg-white overflow-hidden">
                        <CardHeaderStandard
                            title="Identificação"
                            description="Informações básicas do fato gerador."
                            icon={<FileText className="w-5 h-5 text-brand-500" />}
                            className="p-4 pb-2"
                        />
                        <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2">
                            <div className="md:col-span-2 space-y-2">
                                <Label className="text-sm font-semibold text-gray-700">Nome do Fato Gerador *</Label>
                                <Input
                                    {...register("name")}
                                    placeholder="Ex: Internet do escritório, Aluguel do galpão..."
                                    className="bg-white border-gray-200 focus:border-brand-500 h-11"
                                />
                                {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
                            </div>

                            <div className="space-y-2">
                                <Label className="text-sm font-semibold text-gray-700">Fornecedor *</Label>
                                <OrganizationSelector
                                    value={watch("partner_id") || undefined}
                                    companyId={selectedCompany?.id}
                                    showDefaultOptionsOnFocus
                                    onChange={(partnerId, org) => {
                                        setValue("partner_id", partnerId || null);
                                        setValue("partner_name", org?.trade_name || "");
                                    }}
                                    type="supplier"
                                />
                                <input type="hidden" {...register("partner_name")} />
                                {errors.partner_name && <p className="text-xs text-red-500">{errors.partner_name.message}</p>}
                            </div>

                            <div className="space-y-2">
                                <Label className="text-sm font-semibold text-gray-700">Forma de Pagamento</Label>
                                <Select
                                    onValueChange={(val) => setValue("payment_mode_id", val === "none" ? null : val)}
                                    value={watchPaymentModeId || "none"}
                                    disabled={!selectedCompany}
                                >
                                    <SelectTrigger className="bg-white h-11">
                                        <SelectValue placeholder="Selecione..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">Não definido</SelectItem>
                                        {paymentModes.map((mode) => (
                                            <SelectItem key={mode.id} value={mode.id}>
                                                {mode.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {errors.payment_mode_id && <p className="text-xs text-red-500">{errors.payment_mode_id.message}</p>}
                            </div>

                            <div className="space-y-2">
                                <Label className="text-sm font-semibold text-gray-700">Centro de Custo (Opcional)</Label>
                                <Select
                                    onValueChange={(val) => setValue("cost_center_id", val === "default" ? null : val)}
                                    value={watch("cost_center_id") || "default"}
                                >
                                    <SelectTrigger className="bg-white h-11">
                                        <SelectValue placeholder="Selecione..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="default">Geral</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-sm font-semibold text-gray-700">Categoria *</Label>
                                <FinancialCategorySelector
                                    companyId={selectedCompany?.id || ''}
                                    value={watch("category_id")}
                                    onChange={(val) => setValue("category_id", val || "")}
                                    disabled={!selectedCompany}
                                />
                                {errors.category_id && <p className="text-xs text-red-500">{errors.category_id.message}</p>}
                            </div>

                            <div className="md:col-span-2 space-y-2">
                                <Label className="text-sm font-semibold text-gray-700">Observações</Label>
                                <Textarea
                                    {...register("description")}
                                    placeholder="Detalhes internos relevantes..."
                                    className="h-16 resize-none bg-white border-gray-200"
                                />
                            </div>
                        </div>
                    </Card>

                </div>

                <div className="h-full">
                    <div className="flex h-full flex-col justify-between gap-5">
                        {/* Card D: Tipo e Valores */}
                        <Card className="border-none shadow-card rounded-2xl bg-white overflow-hidden">
                            <CardHeaderStandard
                                title="Valores e Tipo"
                                description="Configuração financeira."
                                icon={<Wallet className="w-5 h-5 text-emerald-500" />}
                                className="p-4 pb-2"
                            />
                            <div className="space-y-4 p-4">
                                <div className="space-y-2">
                                    <Label className="text-sm font-semibold text-gray-700">Tipo de Valor *</Label>
                                    <RadioGroup
                                        value={watchAmountType}
                                        onValueChange={(val: any) => {
                                            setValue("amount_type", val);
                                            if (val === 'VARIAVEL') {
                                                setValue("fixed_amount", null);
                                                setValue("contract_amount", null);
                                            }
                                        }}
                                        className="grid grid-cols-2 gap-2"
                                    >
                                        <div className={`flex items-center space-x-2 border rounded-2xl p-2.5 cursor-pointer transition-all ${watchAmountType === 'FIXO' ? 'border-emerald-500 bg-emerald-50/50 ring-1 ring-emerald-500' : 'border-gray-200'}`}>
                                            <RadioGroupItem value="FIXO" id="at-fixo" />
                                            <Label htmlFor="at-fixo" className="flex-1 cursor-pointer font-medium">Valor Fixo</Label>
                                        </div>
                                        <div className={`flex items-center space-x-2 border rounded-2xl p-2.5 cursor-pointer transition-all ${watchAmountType === 'VARIAVEL' ? 'border-emerald-500 bg-emerald-50/50 ring-1 ring-emerald-500' : 'border-gray-200'}`}>
                                            <RadioGroupItem value="VARIAVEL" id="at-var" />
                                            <Label htmlFor="at-var" className="flex-1 cursor-pointer font-medium">Valor Variável</Label>
                                        </div>
                                    </RadioGroup>
                                </div>

                                {watchAmountType === 'FIXO' ? (
                                    <div className="space-y-3 animate-in fade-in slide-in-from-top-1">
                                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setActiveFixedValueField("RECORRENTE");
                                                    setHasManualInstallmentAmountOverride(false);
                                                    setValue("contract_amount", 0);
                                                }}
                                                className={`space-y-2 rounded-2xl border p-2 text-left transition-colors ${activeFixedValueField === "RECORRENTE" ? "border-emerald-300 bg-emerald-50/40" : "border-gray-200 bg-white"}`}
                                            >
                                                <Label className="text-sm font-semibold text-gray-700">Valor Recorrente (R$)</Label>
                                                <CurrencyInput
                                                    value={watch("fixed_amount") || 0}
                                                    onChange={(val) => {
                                                        setActiveFixedValueField("RECORRENTE");
                                                        setHasManualInstallmentAmountOverride(false);
                                                        setValue("fixed_amount", val || 0);
                                                        setValue("contract_amount", 0);
                                                    }}
                                                    disabled={activeFixedValueField !== "RECORRENTE"}
                                                    className="h-11 bg-white border-gray-200 focus:border-emerald-500"
                                                />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setActiveFixedValueField("CONTRATO");
                                                    setHasManualInstallmentAmountOverride(false);
                                                    setValue("fixed_amount", 0);
                                                }}
                                                className={`space-y-2 rounded-2xl border p-2 text-left transition-colors ${activeFixedValueField === "CONTRATO" ? "border-emerald-300 bg-emerald-50/40" : "border-gray-200 bg-white"}`}
                                            >
                                                <Label className="text-sm font-semibold text-gray-700">Valor do Contrato (R$)</Label>
                                                <CurrencyInput
                                                    value={watch("contract_amount") || 0}
                                                    onChange={(val) => {
                                                        setActiveFixedValueField("CONTRATO");
                                                        setHasManualInstallmentAmountOverride(false);
                                                        setValue("contract_amount", val || 0);
                                                        setValue("fixed_amount", 0);
                                                    }}
                                                    disabled={activeFixedValueField !== "CONTRATO"}
                                                    className="h-11 bg-white border-gray-200 focus:border-emerald-500"
                                                />
                                            </button>
                                        </div>
                                        {errors.fixed_amount && <p className="text-xs text-red-500 mt-1">{errors.fixed_amount.message}</p>}
                                    </div>
                                ) : (
                                    <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
                                        <Label className="text-sm font-semibold text-gray-700">Valor Estimado (R$)</Label>
                                        <CurrencyInput
                                            value={watch("estimated_amount") || 0}
                                            onChange={(val) => setValue("estimated_amount", val || 0)}
                                            className="h-11 bg-white"
                                        />
                                        <p className="text-[10px] text-gray-400">Usado apenas para previsão orçamentária.</p>
                                    </div>
                                )}
                            </div>
                        </Card>

                        {/* Card B: Vigência */}
                        <Card className="border-none shadow-card rounded-2xl bg-white overflow-hidden">
                            <CardHeaderStandard
                                title="Vigência"
                                description="Período em que o acordo está em vigor."
                                icon={<CalendarRange className="w-5 h-5 text-blue-500" />}
                                className="p-4 pb-2"
                            />
                            <div className="p-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <Label className="text-sm font-semibold text-gray-700">Início da Vigência *</Label>
                                        <Input type="date" {...register("valid_from")} className="h-11 border-gray-200 focus:ring-blue-500" />
                                        {errors.valid_from && <p className="text-xs text-red-500">{errors.valid_from.message}</p>}
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-sm font-semibold text-gray-700">Fim da Vigência (Opcional)</Label>
                                        <Input type="date" {...register("valid_to")} className="h-11 border-gray-200 focus:ring-blue-500" />
                                        {errors.valid_to && <p className="text-xs text-red-500">{errors.valid_to.message}</p>}
                                    </div>
                                </div>
                            </div>
                        </Card>
                    </div>
                </div>
            </div>

            <div className="mt-5">
                {/* Card C: Geração de Lançamentos */}
                <Card className={`rounded-2xl overflow-hidden ${isContractManualMismatch ? "border border-red-300 bg-red-50/30 shadow-none" : "border-none shadow-card bg-white"}`}>
                        <CardHeaderStandard
                            title="Geração de Lançamentos"
                            description="Como o sistema deve criar as previsões financeiras."
                            icon={<Zap className="w-5 h-5 text-amber-500" />}
                        />
                        <div className="p-5 space-y-5">
                            <div className="space-y-4">
                                <Label className="text-sm font-semibold text-gray-700">Modo de Geração *</Label>
                                {forceAutomaticGeneration ? (
                                    <div className="flex items-center space-x-3 rounded-2xl border border-brand-500 bg-brand-50/50 p-4 ring-1 ring-brand-500">
                                        <span className="relative inline-flex h-5 w-5 items-center justify-center rounded-full border border-brand-500 bg-white">
                                            <span className="h-2.5 w-2.5 rounded-full bg-brand-600" />
                                        </span>
                                        <span className="flex-1 font-medium text-gray-900">Automático</span>
                                    </div>
                                ) : forceManualGeneration ? (
                                    <div className={`flex items-center space-x-3 rounded-2xl p-4 ring-1 ${isContractManualMismatch ? "border border-red-400 bg-red-50 ring-red-300" : "border border-brand-500 bg-brand-50/50 ring-brand-500"}`}>
                                        <span className={`relative inline-flex h-5 w-5 items-center justify-center rounded-full bg-white ${isContractManualMismatch ? "border border-red-500" : "border border-brand-500"}`}>
                                            <span className={`h-2.5 w-2.5 rounded-full ${isContractManualMismatch ? "bg-red-600" : "bg-brand-600"}`} />
                                        </span>
                                        <span className={`flex-1 font-medium ${isContractManualMismatch ? "text-red-900" : "text-gray-900"}`}>Manual</span>
                                    </div>
                                ) : (
                                    <RadioGroup
                                        value={watchGenMode}
                                        onValueChange={(val: "AUTOMATICO" | "MANUAL") => {
                                            setValue("generation_mode", val);
                                            if (val === 'MANUAL') {
                                                setValue("billing_plan_type", null);
                                                setValue("first_due_date", null);
                                                setValue("installments_count", null);
                                                if (watchManualInstallmentsLength === 0) {
                                                    setValue("manual_installments", [{ installment_number: 1, due_date: "", amount: 0 }], { shouldValidate: true });
                                                }
                                            } else {
                                                setValue("billing_plan_type", 'RECORRENTE');
                                                setValue("manual_installments", []);
                                            }
                                        }}
                                        className="grid grid-cols-2 gap-4"
                                    >
                                        <div className={`flex items-center space-x-3 border rounded-2xl p-4 cursor-pointer transition-all ${watchGenMode === 'MANUAL' ? 'border-brand-500 bg-brand-50/50 ring-1 ring-brand-500' : 'border-gray-200 hover:border-gray-300'}`}>
                                            <RadioGroupItem value="MANUAL" id="gm-manual" />
                                            <Label htmlFor="gm-manual" className="flex-1 cursor-pointer font-medium">Manual</Label>
                                        </div>
                                        <div className={`flex items-center space-x-3 border rounded-2xl p-4 cursor-pointer transition-all ${watchGenMode === 'AUTOMATICO' ? 'border-brand-500 bg-brand-50/50 ring-1 ring-brand-500' : 'border-gray-200 hover:border-gray-300'}`}>
                                            <RadioGroupItem value="AUTOMATICO" id="gm-auto" />
                                            <Label htmlFor="gm-auto" className="flex-1 cursor-pointer font-medium">Automático</Label>
                                        </div>
                                    </RadioGroup>
                                )}
                            </div>

                            {effectiveGenerationMode === 'MANUAL' ? (
                                <div className="space-y-6 animate-in fade-in slide-in-from-top-2">
                                    <div className="p-5 bg-gray-50 rounded-2xl border border-gray-100 flex gap-4 items-start">
                                        <Info className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" />
                                        <div>
                                            <p className="text-sm text-gray-700 font-medium">Controle Manual Ativado</p>
                                            <p className="text-sm text-gray-500 mt-1">
                                                Monte as parcelas livremente. Você define datas e valores de cada lançamento.
                                            </p>
                                        </div>
                                    </div>

                                    <Card className="rounded-2xl border border-gray-200 overflow-hidden bg-white">
                                        <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <CalendarClock className="w-4 h-4 text-brand-600" />
                                                <span className="text-xs font-bold text-brand-700 uppercase tracking-wider">Pré-visualização dos Lançamentos</span>
                                            </div>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                className="rounded-2xl"
                                                onClick={() => manualInstallmentsFieldArray.append({ installment_number: manualInstallmentsFieldArray.fields.length + 1, due_date: "", amount: 0 })}
                                            >
                                                + Adicionar parcela
                                            </Button>
                                        </div>

                                        {manualInstallmentsFieldArray.fields.length === 0 ? (
                                            <div className="px-4 py-6 text-sm text-gray-500">
                                                Adicione parcelas com data e valor para visualizar a listagem.
                                            </div>
                                        ) : (
                                            <Table>
                                                <TableHeader className="bg-gray-50/50 border-b border-gray-100">
                                                    <TableRow className="hover:bg-transparent border-gray-100">
                                                        <TableHead className="h-10 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider w-28">Lançamento</TableHead>
                                                        <TableHead className="h-10 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Vencimento</TableHead>
                                                        <TableHead className="h-10 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Valor</TableHead>
                                                        <TableHead className="h-10 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right w-20">Ações</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {manualInstallmentsFieldArray.fields.map((field, index) => (
                                                        <TableRow key={field.id} className="group border-gray-50 hover:bg-gray-50/50 transition-colors">
                                                            <TableCell className="px-4 py-2.5 align-top">
                                                                <div className="flex h-9 items-center rounded-2xl border border-gray-200 bg-gray-50 px-3 text-sm font-medium text-gray-700">
                                                                    {index + 1}
                                                                </div>
                                                                <input
                                                                    type="hidden"
                                                                    {...register(`manual_installments.${index}.installment_number` as const, { valueAsNumber: true })}
                                                                />
                                                            </TableCell>
                                                            <TableCell className="px-4 py-2.5 align-top">
                                                                <Input
                                                                    type="date"
                                                                    {...register(`manual_installments.${index}.due_date` as const)}
                                                                    className="h-9"
                                                                />
                                                                {(errors.manual_installments as any)?.[index]?.due_date?.message && (
                                                                    <p className="text-xs text-red-500 mt-1">
                                                                        {(errors.manual_installments as any)?.[index]?.due_date?.message}
                                                                    </p>
                                                                )}
                                                            </TableCell>
                                                            <TableCell className="px-4 py-2.5 align-top">
                                                                <CurrencyInput
                                                                    value={Number(watchManualInstallments[index]?.amount || 0)}
                                                                    onChange={(val) => {
                                                                        setHasManualInstallmentAmountOverride(true);
                                                                        setValue(`manual_installments.${index}.amount`, Number(val || 0), { shouldValidate: true });
                                                                    }}
                                                                    className="h-9"
                                                                />
                                                                {(errors.manual_installments as any)?.[index]?.amount?.message && (
                                                                    <p className="text-xs text-red-500 mt-1">
                                                                        {(errors.manual_installments as any)?.[index]?.amount?.message}
                                                                    </p>
                                                                )}
                                                            </TableCell>
                                                            <TableCell className="px-4 py-2.5 text-right align-top">
                                                                <button
                                                                    type="button"
                                                                    className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-gray-200 text-gray-500 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"
                                                                    onClick={() => manualInstallmentsFieldArray.remove(index)}
                                                                    aria-label="Remover parcela"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        )}
                                        {errors.manual_installments?.message && (
                                            <p className="px-4 pb-3 text-xs text-red-500">{errors.manual_installments.message}</p>
                                        )}
                                        {isContractManualMismatch && (
                                            <p className="px-4 pb-3 text-xs font-medium text-red-600">
                                                A soma das parcelas deve ser igual ao Valor do Contrato.
                                            </p>
                                        )}
                                    </Card>
                                </div>
                            ) : (
                                <div className="space-y-8 animate-in fade-in slide-in-from-top-2">
                                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                                        {!forceAutomaticGeneration && !forceManualGeneration && (
                                            <div className="space-y-2">
                                                <Label className="text-sm font-semibold text-gray-700">Tipo de Plano *</Label>
                                                <Select onValueChange={(val: "RECORRENTE" | "PARCELADO") => setValue("billing_plan_type", val)} value={watchPlanType || ""}>
                                                    <SelectTrigger className="h-11">
                                                        <SelectValue placeholder="Selecione..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="RECORRENTE">Recorrente (Contínuo)</SelectItem>
                                                        <SelectItem value="PARCELADO">Parcelado (N vezes)</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        )}

                                        <div className="space-y-2">
                                            <Label className="text-sm font-semibold text-gray-700">Data do 1º Vencimento *</Label>
                                            <Input type="date" {...register("first_due_date")} className="h-11 bg-white" />
                                            {errors.first_due_date && <p className="text-xs text-red-500">{errors.first_due_date.message}</p>}
                                        </div>

                                        {watchPlanType === 'PARCELADO' && (
                                            <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
                                                <Label className="text-sm font-semibold text-gray-700">Quantidade de Lançamentos (Parcelas) *</Label>
                                                <Input type="number" min={1} {...register("installments_count")} className="h-11" placeholder="Ex: 12" />
                                                {errors.installments_count && <p className="text-xs text-red-500">{errors.installments_count.message}</p>}
                                            </div>
                                        )}

                                        <div className="space-y-2">
                                            <Label className="text-sm font-semibold text-gray-700">Periodicidade</Label>
                                            <Select value={watchFrequency || "MENSAL"} onValueChange={(val: string) => setValue("frequency", val)}>
                                                <SelectTrigger className="h-11 bg-white">
                                                    <SelectValue placeholder="Mensal" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="MENSAL">Mensal</SelectItem>
                                                    <SelectItem value="QUINZENAL">Quinzenal</SelectItem>
                                                    <SelectItem value="SEMANAL">Semanal</SelectItem>
                                                    <SelectItem value="DIARIO">Diária</SelectItem>
                                                    <SelectItem value="BIMESTRAL">Bimestral</SelectItem>
                                                    <SelectItem value="TRIMESTRAL">Trimestral</SelectItem>
                                                    <SelectItem value="SEMESTRAL">Semestral</SelectItem>
                                                    <SelectItem value="ANUAL">Anual</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    <div className="rounded-2xl border border-gray-200 overflow-hidden">
                                        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <CalendarClock className="w-4 h-4 text-brand-600" />
                                                <span className="text-xs font-bold text-brand-700 uppercase tracking-wider">Pré-visualização dos Lançamentos</span>
                                            </div>
                                            {watchPlanType === 'RECORRENTE' && !watchValidTo && (
                                                <span className="text-[11px] text-gray-500">Mostrando próximos 24 lançamentos</span>
                                            )}
                                        </div>

                                        {previewRows.length === 0 ? (
                                            <div className="px-4 py-4 text-xs text-gray-500 bg-gray-50/30">
                                                Preencha a data do 1º vencimento para visualizar os lançamentos.
                                            </div>
                                        ) : (
                                            <div>
                                                <div className="grid grid-cols-3 gap-4 px-4 py-2 text-[11px] font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100">
                                                    <span>Lançamento</span>
                                                    <span>Vencimento</span>
                                                    <span className="text-right">Valor</span>
                                                </div>
                                                <div className="max-h-64 overflow-y-auto">
                                                    {previewRows.map((row) => (
                                                        <div key={`${row.installmentLabel}-${row.dueDateLabel}`} className="grid grid-cols-3 gap-4 px-4 py-2.5 text-sm border-b border-gray-100 last:border-b-0">
                                                            <span className="text-gray-700 font-medium">{row.installmentLabel}</span>
                                                            <span className="text-gray-700">{row.dueDateLabel}</span>
                                                            <span className="text-right text-gray-900 font-medium">{row.amountLabel}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </Card>
                </div>
        </form>
    );
}
