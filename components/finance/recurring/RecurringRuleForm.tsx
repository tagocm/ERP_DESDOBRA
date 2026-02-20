"use client";

import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
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
import { createRecurringRuleAction, CreateRecurringRuleInput } from "@/app/actions/recurring-rules";
import { OrganizationSelector } from "@/components/app/OrganizationSelector";
import { CurrencyInput } from "@/components/ui/CurrencyInput";
import {
    CalendarClock,
    FileText,
    Settings2,
    Wallet,
    Info,
    CalendarRange,
    Zap,
    Trash2
} from "lucide-react";
import { useCompany } from "@/contexts/CompanyContext";
import { FinancialCategorySelector } from "./FinancialCategorySelector";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

// Validation Schema
const formSchema = z.object({
    name: z.string().min(3, "Nome muito curto"),
    partner_name: z.string().min(3, "Fornecedor obrigatório"),
    partner_id: z.string().optional().nullable(),
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
    const { toast } = useToast();
    const { selectedCompany } = useCompany();

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema) as any,
        defaultValues: {
            generation_mode: 'AUTOMATICO',
            billing_plan_type: 'RECORRENTE',
            valid_from: new Date().toISOString().split('T')[0],
            amount_type: 'FIXO',
            status: 'ATIVO',
            frequency: 'MENSAL',
            category_id: '',
            contract_amount: null,
            manual_installments: []
        }
    });

    const { register, control, handleSubmit, watch, setValue, formState: { errors } } = form;
    const manualInstallmentsFieldArray = useFieldArray({
        control,
        name: "manual_installments",
    });

    // Watchers
    const watchGenMode = watch("generation_mode");
    const watchPlanType = watch("billing_plan_type");
    const watchAmountType = watch("amount_type");
    const watchInstallments = watch("installments_count");
    const watchStart = watch("valid_from");
    const watchValidTo = watch("valid_to");
    const watchFirstDue = watch("first_due_date");
    const watchFrequency = watch("frequency");
    const watchFixedAmount = watch("fixed_amount");
    const watchContractAmount = watch("contract_amount");
    const watchEstimatedAmount = watch("estimated_amount");
    const watchName = watch("name");
    const watchPartnerName = watch("partner_name");
    const watchManualInstallments = watch("manual_installments") || [];
    const selectedFrequency =
        FREQUENCY_OPTIONS.find((opt) => opt.value === watchFrequency) ||
        FREQUENCY_OPTIONS[0];

    const onSubmit = async (data: FormValues) => {
        const result = await createRecurringRuleAction(data as CreateRecurringRuleInput);

        if (result.success) {
            toast({ title: "Sucesso!", description: "Fato gerador cadastrado com sucesso." });
            router.push("/app/financeiro/fatos-geradores");
        } else {
            toast({ title: "Erro ao salvar", description: result.error, variant: "destructive" });
        }
    };

    const previewRows = (() => {
        if (watchGenMode === "MANUAL") {
            const sortedManual = [...watchManualInstallments]
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
                dueDateLabel: formatDatePtBr(dueDate.toISOString().slice(0, 10)),
                amountLabel,
            });

            dueDate = addFrequency(dueDate, selectedFrequency);
            idx += 1;
        }

        return rows;
    })();

    return (
        <form id="recurring-rule-form" onSubmit={handleSubmit(onSubmit)} className="w-full">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                <div className="lg:col-span-2 space-y-5">
                    {/* Card A: Identificação */}
                    <Card className="border-none shadow-card rounded-2xl bg-white overflow-hidden">
                        <CardHeaderStandard
                            title="Identificação"
                            description="Informações básicas do contrato."
                            icon={<FileText className="w-5 h-5 text-brand-500" />}
                        />
                        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div className="md:col-span-2 space-y-2">
                                <Label className="text-sm font-semibold text-gray-700">Nome do Contrato *</Label>
                                <Input
                                    {...register("name")}
                                    placeholder="Ex: Internet Escritório, Aluguel Galpão..."
                                    className="bg-white border-gray-200 focus:border-brand-500 h-11"
                                />
                                {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
                            </div>

                            <div className="space-y-2">
                                <Label className="text-sm font-semibold text-gray-700">Fornecedor *</Label>
                                <OrganizationSelector
                                    value={watch("partner_id") || undefined}
                                    companyId={selectedCompany?.id}
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
                                <Label className="text-sm font-semibold text-gray-700">Categoria *</Label>
                                <FinancialCategorySelector
                                    companyId={selectedCompany?.id || ''}
                                    value={watch("category_id")}
                                    onChange={(val) => setValue("category_id", val || "")}
                                    disabled={!selectedCompany}
                                />
                                {errors.category_id && <p className="text-xs text-red-500">{errors.category_id.message}</p>}
                            </div>

                            <div className="space-y-2">
                                <Label className="text-sm font-semibold text-gray-700">Centro de Custo (Opcional)</Label>
                                <Select onValueChange={(val) => setValue("cost_center_id", val)} value={watch("cost_center_id") || "default"}>
                                    <SelectTrigger className="bg-white h-11">
                                        <SelectValue placeholder="Selecione..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="default">Geral</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="md:col-span-2 space-y-2">
                                <Label className="text-sm font-semibold text-gray-700">Observações</Label>
                                <Textarea
                                    {...register("description")}
                                    placeholder="Detalhes internos relevantes..."
                                    className="resize-none h-20 bg-white border-gray-200"
                                />
                            </div>
                        </div>
                    </Card>

                    {/* Card B: Vigência */}
                    <Card className="border-none shadow-card rounded-2xl bg-white overflow-hidden">
                        <CardHeaderStandard
                            title="Vigência do Contrato"
                            description="Período em que o acordo está em vigor."
                            icon={<CalendarRange className="w-5 h-5 text-blue-500" />}
                        />
                        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div className="space-y-2">
                                <Label className="text-sm font-semibold text-gray-700">Início da Vigência *</Label>
                                <Input type="date" {...register("valid_from")} className="h-11 border-gray-200 focus:ring-blue-500" />
                                {errors.valid_from && <p className="text-xs text-red-500">{errors.valid_from.message}</p>}
                            </div>
                            <div className="space-y-2">
                                <Label className="text-sm font-semibold text-gray-700">Fim da Vigência (Opcional)</Label>
                                <Input type="date" {...register("valid_to")} className="h-11 border-gray-200 focus:ring-blue-500" />
                                <p className="text-[10px] text-gray-400">Deixe vazio para contratos sem data de término definida.</p>
                                {errors.valid_to && <p className="text-xs text-red-500">{errors.valid_to.message}</p>}
                            </div>
                        </div>
                    </Card>

                    {/* Card C: Geração de Lançamentos */}
                    <Card className="border-none shadow-card rounded-2xl bg-white overflow-hidden">
                        <CardHeaderStandard
                            title="Geração de Lançamentos"
                            description="Como o sistema deve criar as previsões financeiras."
                            icon={<Zap className="w-5 h-5 text-amber-500" />}
                        />
                        <div className="p-5 space-y-5">
                            <div className="space-y-4">
                                <Label className="text-sm font-semibold text-gray-700">Modo de Geração *</Label>
                                <RadioGroup
                                    value={watchGenMode}
                                    onValueChange={(val: any) => {
                                        setValue("generation_mode", val);
                                        if (val === 'MANUAL') {
                                            setValue("billing_plan_type", null);
                                            setValue("first_due_date", null);
                                            setValue("installments_count", null);
                                            if ((watchManualInstallments?.length || 0) === 0) {
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
                            </div>

                            {watchGenMode === 'MANUAL' ? (
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
                                            <button
                                                type="button"
                                                className="h-8 px-3 text-xs font-semibold rounded-2xl border border-gray-200 hover:bg-gray-50"
                                                onClick={() => manualInstallmentsFieldArray.append({ installment_number: manualInstallmentsFieldArray.fields.length + 1, due_date: "", amount: 0 })}
                                            >
                                                + Adicionar parcela
                                            </button>
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
                                                                <Input
                                                                    type="number"
                                                                    min={1}
                                                                    {...register(`manual_installments.${index}.installment_number` as const, { valueAsNumber: true })}
                                                                    className="h-9"
                                                                />
                                                                {(errors.manual_installments as any)?.[index]?.installment_number?.message && (
                                                                    <p className="text-xs text-red-500 mt-1">
                                                                        {(errors.manual_installments as any)?.[index]?.installment_number?.message}
                                                                    </p>
                                                                )}
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
                                                                    onChange={(val) => setValue(`manual_installments.${index}.amount`, Number(val || 0), { shouldValidate: true })}
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
                                    </Card>
                                </div>
                            ) : (
                                <div className="space-y-8 animate-in fade-in slide-in-from-top-2">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <Label className="text-sm font-semibold text-gray-700">Tipo de Plano *</Label>
                                            <Select onValueChange={(val: any) => setValue("billing_plan_type", val)} value={watchPlanType || ""}>
                                                <SelectTrigger className="h-11">
                                                    <SelectValue placeholder="Selecione..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="RECORRENTE">Recorrente (Contínuo)</SelectItem>
                                                    <SelectItem value="PARCELADO">Parcelado (N vezes)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

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
                                            <Select value={watchFrequency || "MENSAL"} onValueChange={(val: any) => setValue("frequency", val)}>
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

                <div className="space-y-5">
                    {/* Card D: Tipo e Valores */}
                    <Card className="border-none shadow-card rounded-2xl bg-white overflow-hidden">
                        <CardHeaderStandard
                            title="Valores e Tipo"
                            description="Configuração financeira."
                            icon={<Wallet className="w-5 h-5 text-emerald-500" />}
                        />
                        <div className="p-5 space-y-5">
                            <div className="space-y-3">
                                <Label className="text-sm font-semibold text-gray-700">Tipo de Contrato *</Label>
                                <RadioGroup
                                    value={watchAmountType}
                                    onValueChange={(val: any) => {
                                        setValue("amount_type", val);
                                        if (val === 'VARIAVEL') {
                                            setValue("fixed_amount", null);
                                            setValue("contract_amount", null);
                                        }
                                    }}
                                    className="flex flex-col gap-3"
                                >
                                    <div className={`flex items-center space-x-3 border rounded-2xl p-3 cursor-pointer transition-all ${watchAmountType === 'FIXO' ? 'border-emerald-500 bg-emerald-50/50 ring-1 ring-emerald-500' : 'border-gray-200'}`}>
                                        <RadioGroupItem value="FIXO" id="at-fixo" />
                                        <Label htmlFor="at-fixo" className="flex-1 cursor-pointer font-medium">Valor Fixo</Label>
                                    </div>
                                    <div className={`flex items-center space-x-3 border rounded-2xl p-3 cursor-pointer transition-all ${watchAmountType === 'VARIAVEL' ? 'border-emerald-500 bg-emerald-50/50 ring-1 ring-emerald-500' : 'border-gray-200'}`}>
                                        <RadioGroupItem value="VARIAVEL" id="at-var" />
                                        <Label htmlFor="at-var" className="flex-1 cursor-pointer font-medium">Valor Variável</Label>
                                    </div>
                                </RadioGroup>
                            </div>

                            {watchAmountType === 'FIXO' ? (
                                <div className="space-y-4 animate-in fade-in slide-in-from-top-1">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <div className="space-y-2">
                                            <Label className="text-sm font-semibold text-gray-700">Valor Recorrente (R$)</Label>
                                            <CurrencyInput
                                                value={watch("fixed_amount") || 0}
                                                onChange={(val) => setValue("fixed_amount", val || 0)}
                                                className="h-11 bg-white border-gray-200 focus:border-emerald-500"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-sm font-semibold text-gray-700">Valor do Contrato (R$)</Label>
                                            <CurrencyInput
                                                value={watch("contract_amount") || 0}
                                                onChange={(val) => setValue("contract_amount", val || 0)}
                                                className="h-11 bg-white border-gray-200 focus:border-emerald-500"
                                            />
                                        </div>
                                    </div>
                                    <p className="text-[11px] text-gray-500">Preencha pelo menos um dos campos.</p>
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

                    {/* Card E: Status */}
                    <Card className="border-none shadow-card rounded-2xl bg-white overflow-hidden">
                        <CardHeaderStandard
                            title="Finalização"
                            description="Status e resumo."
                            icon={<Settings2 className="w-5 h-5 text-gray-400" />}
                        />
                        <div className="p-5 space-y-5">
                            <div className="space-y-2">
                                <Label className="text-sm font-semibold text-gray-700">Status Inicial *</Label>
                                <Select onValueChange={(val: any) => setValue("status", val)} value={watch("status")}>
                                    <SelectTrigger className="h-11">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ATIVO">Ativo</SelectItem>
                                        <SelectItem value="RASCUNHO">Rascunho</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="pt-4 border-t border-gray-100">
                                <div className="p-4 bg-gray-900 rounded-2xl text-white text-[13px] font-medium space-y-3">
                                    <div className="flex items-center gap-2 opacity-50 mb-1">
                                        <Info className="w-3.5 h-3.5" />
                                        <span className="text-[10px] uppercase font-bold tracking-widest">RESUMO</span>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex justify-between">
                                            <span className="opacity-60">Contrato:</span>
                                            <span className="truncate max-w-36 text-right">{watchName || "—"}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="opacity-60">Fornecedor:</span>
                                            <span className="truncate max-w-36 text-right">{watchPartnerName || "—"}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="opacity-60">Geração:</span>
                                            <span>{watchGenMode === 'AUTOMATICO' ? (watchPlanType === 'RECORRENTE' ? 'Recorrente' : `Parcelado (${watchInstallments || '0'}x)`) : 'Manual'}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="opacity-60">Cadência:</span>
                                            <span>{selectedFrequency.label}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="opacity-60">Vigência:</span>
                                            <span className="text-right">{watchStart ? formatDatePtBr(watchStart) : '...'}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Card>
                </div>
            </div>
        </form>
    );
}
