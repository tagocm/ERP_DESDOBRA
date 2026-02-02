"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { CardHeaderStandard } from "@/components/ui/CardHeaderStandard";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Button } from "@/components/ui/Button";
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
    Save,
    Loader2,
    CalendarRange,
    Zap
} from "lucide-react";
import Link from "next/link";
import { useCompany } from "@/contexts/CompanyContext";
import { FinancialCategorySelector } from "./FinancialCategorySelector";

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
    estimated_amount: z.number().optional().nullable(),

    status: z.enum(['ATIVO', 'RASCUNHO']),
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
    if (data.amount_type === 'FIXO' && (!data.fixed_amount || data.fixed_amount <= 0)) {
        return false;
    }
    return true;
}, {
    message: "Valor fixo obrigatório para contratos fixos",
    path: ["fixed_amount"]
});

type FormValues = z.infer<typeof formSchema>;

export function RecurringRuleForm() {
    const router = useRouter();
    const { toast } = useToast();
    const { selectedCompany } = useCompany();
    const [loading, setLoading] = useState(false);

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema) as any,
        defaultValues: {
            generation_mode: 'AUTOMATICO',
            billing_plan_type: 'RECORRENTE',
            valid_from: new Date().toISOString().split('T')[0],
            amount_type: 'FIXO',
            status: 'ATIVO',
            frequency: 'MENSAL',
            category_id: ''
        }
    });

    const { register, handleSubmit, watch, setValue, formState: { errors } } = form;

    // Watchers
    const watchGenMode = watch("generation_mode");
    const watchPlanType = watch("billing_plan_type");
    const watchAmountType = watch("amount_type");
    const watchInstallments = watch("installments_count");
    const watchStart = watch("valid_from");
    const watchFirstDue = watch("first_due_date");
    const watchName = watch("name");
    const watchPartnerName = watch("partner_name");

    const onSubmit = async (data: FormValues) => {
        setLoading(true);
        const result = await createRecurringRuleAction(data as CreateRecurringRuleInput);

        if (result.success) {
            toast({ title: "Sucesso!", description: "Fato gerador cadastrado com sucesso." });
            router.push("/app/financeiro/fatos-geradores");
        } else {
            toast({ title: "Erro ao salvar", description: result.error, variant: "destructive" });
        }
        setLoading(false);
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="max-w-5xl mx-auto space-y-8 pb-32">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 py-2 border-b border-gray-100">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Novo Fato Gerador</h1>
                    <p className="text-gray-500 mt-1">Defina as regras de vigência e o plano de cobrança do contrato.</p>
                </div>
                <div className="flex items-center gap-3">
                    <Link href="/app/financeiro/fatos-geradores">
                        <Button variant="ghost" type="button" className="text-gray-500 hover:text-gray-900" disabled={loading}>
                            Cancelar
                        </Button>
                    </Link>
                    <Button type="submit" variant="pill" size="lg" className="bg-brand-600 hover:bg-brand-700 text-white min-w-[140px]" disabled={loading}>
                        {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                        Salvar Contrato
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                    {/* Card A: Identificação */}
                    <Card className="border-none shadow-premium rounded-2xl bg-white overflow-hidden">
                        <CardHeaderStandard
                            title="Identificação"
                            description="Informações básicas do contrato."
                            icon={<FileText className="w-5 h-5 text-brand-500" />}
                        />
                        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
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
                                    onChange={(org) => {
                                        setValue("partner_id", org?.id || null);
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
                                    className="resize-none h-24 bg-white border-gray-200"
                                />
                            </div>
                        </div>
                    </Card>

                    {/* Card B: Vigência */}
                    <Card className="border-none shadow-premium rounded-2xl bg-white overflow-hidden">
                        <CardHeaderStandard
                            title="Vigência do Contrato"
                            description="Período em que o acordo está em vigor."
                            icon={<CalendarRange className="w-5 h-5 text-blue-500" />}
                        />
                        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
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
                    <Card className="border-none shadow-premium rounded-2xl bg-white overflow-hidden">
                        <CardHeaderStandard
                            title="Geração de Lançamentos"
                            description="Como o sistema deve criar as previsões financeiras."
                            icon={<Zap className="w-5 h-5 text-amber-500" />}
                        />
                        <div className="p-6 space-y-8">
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
                                        } else {
                                            setValue("billing_plan_type", 'RECORRENTE');
                                        }
                                    }}
                                    className="grid grid-cols-2 gap-4"
                                >
                                    <div className={`flex items-center space-x-3 border rounded-xl p-4 cursor-pointer transition-all ${watchGenMode === 'MANUAL' ? 'border-brand-500 bg-brand-50/50 ring-1 ring-brand-500' : 'border-gray-200 hover:border-gray-300'}`}>
                                        <RadioGroupItem value="MANUAL" id="gm-manual" />
                                        <Label htmlFor="gm-manual" className="flex-1 cursor-pointer font-medium">Manual</Label>
                                    </div>
                                    <div className={`flex items-center space-x-3 border rounded-xl p-4 cursor-pointer transition-all ${watchGenMode === 'AUTOMATICO' ? 'border-brand-500 bg-brand-50/50 ring-1 ring-brand-500' : 'border-gray-200 hover:border-gray-300'}`}>
                                        <RadioGroupItem value="AUTOMATICO" id="gm-auto" />
                                        <Label htmlFor="gm-auto" className="flex-1 cursor-pointer font-medium">Automático</Label>
                                    </div>
                                </RadioGroup>
                            </div>

                            {watchGenMode === 'MANUAL' ? (
                                <div className="p-5 bg-gray-50 rounded-2xl border border-gray-100 flex gap-4 items-start animate-in fade-in slide-in-from-top-2">
                                    <Info className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-sm text-gray-700 font-medium">Controle Manual Ativado</p>
                                        <p className="text-sm text-gray-500 mt-1">
                                            O sistema não gerará títulos automaticamente. Você será responsável por incluir cada lançamento ou gerar a partir desta regra futuramente.
                                        </p>
                                    </div>
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
                                            <Select disabled defaultValue="MENSAL">
                                                <SelectTrigger className="h-11 bg-gray-50 opacity-80">
                                                    <SelectValue placeholder="Mensal" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="MENSAL">Mensal</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <input type="hidden" {...register("frequency")} value="MENSAL" />
                                        </div>
                                    </div>

                                    {/* Preview Box */}
                                    <div className="p-5 bg-brand-50/30 rounded-2xl border border-brand-100/50">
                                        <div className="flex items-center gap-2 mb-3">
                                            <CalendarClock className="w-4 h-4 text-brand-600" />
                                            <span className="text-xs font-bold text-brand-700 uppercase tracking-wider">Preview da Geração</span>
                                        </div>
                                        <div className="text-sm text-gray-700 space-y-2 font-medium">
                                            {watchPlanType === 'RECORRENTE' ? (
                                                <p>• Títulos gerados mensalmente sem data de término definida.</p>
                                            ) : (
                                                <p>• Serão gerados <strong>{watchInstallments || 'N'} lançamentos</strong> mensais.</p>
                                            )}
                                            <p>• Primeiro vencimento previsto para <strong>{watchFirstDue ? new Date(watchFirstDue).toLocaleDateString('pt-BR') : 'DD/MM/AAAA'}</strong>.</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </Card>
                </div>

                <div className="space-y-8">
                    {/* Card D: Tipo e Valores */}
                    <Card className="border-none shadow-premium rounded-2xl bg-white overflow-hidden">
                        <CardHeaderStandard
                            title="Valores e Tipo"
                            description="Configuração financeira."
                            icon={<Wallet className="w-5 h-5 text-emerald-500" />}
                        />
                        <div className="p-6 space-y-6">
                            <div className="space-y-3">
                                <Label className="text-sm font-semibold text-gray-700">Tipo de Contrato *</Label>
                                <RadioGroup
                                    value={watchAmountType}
                                    onValueChange={(val: any) => {
                                        setValue("amount_type", val);
                                        if (val === 'VARIAVEL') setValue("fixed_amount", null);
                                    }}
                                    className="flex flex-col gap-3"
                                >
                                    <div className={`flex items-center space-x-3 border rounded-xl p-3 cursor-pointer transition-all ${watchAmountType === 'FIXO' ? 'border-emerald-500 bg-emerald-50/50 ring-1 ring-emerald-500' : 'border-gray-200'}`}>
                                        <RadioGroupItem value="FIXO" id="at-fixo" />
                                        <Label htmlFor="at-fixo" className="flex-1 cursor-pointer font-medium">Valor Fixo</Label>
                                    </div>
                                    <div className={`flex items-center space-x-3 border rounded-xl p-3 cursor-pointer transition-all ${watchAmountType === 'VARIAVEL' ? 'border-emerald-500 bg-emerald-50/50 ring-1 ring-emerald-500' : 'border-gray-200'}`}>
                                        <RadioGroupItem value="VARIAVEL" id="at-var" />
                                        <Label htmlFor="at-var" className="flex-1 cursor-pointer font-medium">Valor Variável</Label>
                                    </div>
                                </RadioGroup>
                            </div>

                            {watchAmountType === 'FIXO' ? (
                                <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
                                    <Label className="text-sm font-semibold text-gray-700">Valor Mensal (R$) *</Label>
                                    <CurrencyInput
                                        value={watch("fixed_amount") || 0}
                                        onChange={(val) => setValue("fixed_amount", val || 0)}
                                        className="h-12 text-xl font-bold bg-white border-gray-200 focus:border-emerald-500"
                                    />
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
                    <Card className="border-none shadow-premium rounded-2xl bg-white overflow-hidden">
                        <CardHeaderStandard
                            title="Finalização"
                            description="Status e resumo."
                            icon={<Settings2 className="w-5 h-5 text-gray-400" />}
                        />
                        <div className="p-6 space-y-6">
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
                                            <span className="truncate max-w-[140px] text-right">{watchName || "—"}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="opacity-60">Fornecedor:</span>
                                            <span className="truncate max-w-[140px] text-right">{watchPartnerName || "—"}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="opacity-60">Geração:</span>
                                            <span>{watchGenMode === 'AUTOMATICO' ? (watchPlanType === 'RECORRENTE' ? 'Recorrente' : `Parcelado (${watchInstallments || '0'}x)`) : 'Manual'}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="opacity-60">Cadência:</span>
                                            <span>Mensal</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="opacity-60">Vigência:</span>
                                            <span className="text-right">{watchStart ? new Date(watchStart).toLocaleDateString('pt-BR') : '...'}</span>
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
