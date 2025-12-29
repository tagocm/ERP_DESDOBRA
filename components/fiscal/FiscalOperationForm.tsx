"use client";

import { useEffect, useState, useMemo } from "react";
import { useCompany } from "@/contexts/CompanyContext";
import { createClient } from "@/lib/supabaseBrowser";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/Command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { TaxGroup, getTaxGroups } from "@/lib/data/tax-groups";
import { FiscalOperation, createFiscalOperation, updateFiscalOperation, getFiscalOperations } from "@/lib/data/fiscal-operations";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/use-toast";
import { PageHeader } from "@/components/ui/PageHeader";
import { Loader2, Save, ArrowLeft, AlertTriangle, FileText, Check, ChevronsUpDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { CardHeaderStandard } from "@/components/ui/CardHeaderStandard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { Label } from "@/components/ui/Label";
import { DecimalInput } from "@/components/ui/DecimalInput";
import { Switch } from "@/components/ui/Switch";
import { cn } from "@/lib/utils";
import { ICMS_CST_OPTIONS, ICMS_CSOSN_OPTIONS, PIS_COFINS_CST_OPTIONS, IPI_CST_OPTIONS } from "@/lib/constants/fiscal-codes";
import { getCfops, Cfop } from "@/lib/data/cfops";

// --- Constants ---
const STATES = [
    'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO', 'EX'
];

interface FormProps {
    initialData?: FiscalOperation;
    isDuplicate?: boolean;
}

export function FiscalOperationForm({ initialData, isDuplicate = false }: FormProps) {
    const { selectedCompany } = useCompany();
    const supabase = createClient();
    const router = useRouter();
    const { toast } = useToast();

    const [isLoading, setIsLoading] = useState(false);
    const [taxGroups, setTaxGroups] = useState<TaxGroup[]>([]);
    const [taxRegime, setTaxRegime] = useState<string | null>(null);
    const [cfops, setCfops] = useState<Cfop[]>([]);
    const [cfopOpen, setCfopOpen] = useState(false);

    // Form State
    const [formData, setFormData] = useState<Partial<FiscalOperation>>({
        destination_state: 'SP',
        customer_ie_indicator: 'contributor',
        customer_is_final_consumer: false,
        operation_type: 'sales',

        // Defaults
        icms_modal_bc: '3', // Valor da Operação
        icms_reduction_bc_percent: 0,
        icms_rate_percent: 0,
        icms_show_in_xml: true,

        st_applies: false,
        st_reduction_bc_percent: 0,
        st_rate_percent: 0,
        st_fcp_percent: 0,
        st_mva_percent: 0,

        pis_applies: true,
        pis_rate_percent: 0, // usually 0.65 or 1.65

        cofins_applies: true,
        cofins_rate_percent: 0, // usually 3.00 or 7.60

        ipi_applies: false,
        ipi_rate_percent: 0,

        is_active: true
    });

    useEffect(() => {
        if (selectedCompany) {
            getTaxGroups(supabase, selectedCompany.id).then(setTaxGroups);
            getCfops(supabase).then(setCfops);

            // Fetch Company Settings for Tax Regime
            supabase
                .from('company_settings')
                .select('tax_regime')
                .eq('company_id', selectedCompany.id)
                .single()
                .then(({ data, error }) => {
                    if (data && data.tax_regime) {
                        setTaxRegime(data.tax_regime);
                    } else if (error && error.code !== 'PGRST116') {
                        console.error("Error fetching tax regime:", error);
                    }
                });
        }
    }, [selectedCompany, supabase]);

    useEffect(() => {
        if (initialData) {
            const data = { ...initialData };
            if (isDuplicate) {
                // @ts-ignore
                delete data.id;
                // @ts-ignore
                delete data.created_at;
                // @ts-ignore
                delete data.updated_at;
                // @ts-ignore
                delete data.deleted_at;
            }
            setFormData(data);
        }
    }, [initialData, isDuplicate]);

    // Smart behavior: clear incompatible fields based on tax regime
    useEffect(() => {
        if (!taxRegime) return;

        const isSimples = taxRegime.toLowerCase().includes('simples');

        setFormData(prev => {
            const next = { ...prev };
            let changed = false;

            if (isSimples && next.icms_cst) {
                next.icms_cst = null;
                changed = true;
            }
            if (!isSimples && next.icms_csosn) {
                next.icms_csosn = null;
                changed = true;
            }
            // Clear IPI CST if IPI not applies
            if (!next.ipi_applies && next.ipi_cst) {
                next.ipi_cst = null;
                changed = true;
            }

            return changed ? next : prev;
        });
    }, [taxRegime, formData.ipi_applies]);


    const handleChange = (field: keyof FiscalOperation, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    // Filter CFOPs
    const filteredCfops = useMemo(() => {
        const isSP = formData.destination_state === 'SP';
        return cfops.filter(c => {
            // 1. Must be active
            if (!c.ativo) return false;

            // 2. Operation Type: 'saida'
            if (c.tipo_operacao !== 'saida') return false;

            // 3. Scope based on Destination State
            if (isSP) {
                return c.ambito === 'estadual';
            } else {
                if (formData.destination_state === 'EX') return c.ambito === 'exterior';
                return c.ambito === 'interestadual' || c.ambito === 'exterior'; // Fallback to include exterior if needed for normal exports
            }
        });
    }, [cfops, formData.destination_state]);

    // Derived helpers
    const selectedCfopData = cfops.find(c => c.codigo === formData.cfop);


    const handleSave = async () => {
        if (!selectedCompany) return;
        setIsLoading(true);

        try {
            // Validations
            if (!formData.tax_group_id) throw new Error("Selecione o Grupo Tributário.");
            if (!formData.destination_state) throw new Error("Selecione a UF de Destino.");

            // CFOP Validation
            if (!formData.cfop) throw new Error("Selecione um CFOP válido para a operação.");

            const isValidCfop = filteredCfops.some(c => c.codigo === formData.cfop);
            if (!isValidCfop) {
                // Throw explicit error
                throw new Error("O CFOP selecionado não é válido para a UF de destino informada (Interna/Interestadual).");
            }

            if (formData.cfop.length !== 4) throw new Error("CFOP inválido (deve ter 4 dígitos).");

            // Tax Regime Logic
            const isSimples = taxRegime?.toLowerCase().includes('simples');

            // ICMS Validations
            if (isSimples) {
                if (!formData.icms_csosn) throw new Error("Empresa Simples Nacional: Selecione o CSOSN.");
            } else {
                if (!formData.icms_cst) throw new Error("Empresa Regime Normal: Selecione o CST.");
            }

            if ((formData.icms_reduction_bc_percent || 0) > 100) throw new Error("Redução BC ICMS não pode ser maior que 100%.");

            // ST Validations
            if (formData.st_applies) {
                if (formData.st_mva_percent === undefined || formData.st_mva_percent === null) throw new Error("MVA é obrigatório para ST.");
                if (!formData.st_rate_percent) throw new Error("Alíquota ST é obrigatória.");
            }

            // PIS/COFINS Validations
            if (formData.pis_applies && !formData.pis_cst) throw new Error("PIS Ativo: Selecione o CST do PIS.");
            if (formData.cofins_applies && !formData.cofins_cst) throw new Error("COFINS Ativo: Selecione o CST do COFINS.");

            // IPI Validations
            if (formData.ipi_applies && !formData.ipi_cst) throw new Error("IPI Ativo: Selecione o CST do IPI.");

            const payload = {
                ...formData,
                company_id: selectedCompany.id
            } as any;

            if (initialData?.id && !isDuplicate) {
                await updateFiscalOperation(supabase, initialData.id, payload);
                toast({ title: "Sucesso!", description: "Regra atualizada com sucesso." });
            } else {
                await createFiscalOperation(supabase, payload);
                toast({ title: "Sucesso!", description: "Regra criada com sucesso." });
            }

            router.push('/app/fiscal/operacoes');
        } catch (error: any) {
            console.error(error);
            toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    const getSummary = () => {
        const parts = [];
        parts.push(`Se Cliente ${formData.customer_ie_indicator === 'contributor' ? 'Contribuinte' : (formData.customer_ie_indicator === 'exempt' ? 'Isento' : 'Não Contribuinte')}`);
        parts.push(`de ${formData.destination_state}`);

        const opType = formData.operation_type === 'sales' ? 'Venda' :
            formData.operation_type === 'return' ? 'Devolução' :
                formData.operation_type === 'shipment' ? 'Remessa' : 'Bonificação';

        parts.push(`, então ${opType}`);

        const taxes = [];
        if (formData.cfop) taxes.push(`CFOP ${formData.cfop}`);

        // ICMS
        const icmsRate = formData.icms_rate_percent || 0;
        const icmsRed = formData.icms_reduction_bc_percent || 0;
        if (icmsRate > 0) {
            let text = `ICMS ${icmsRate}%`;
            if (icmsRed > 0) text += ` (Red. ${icmsRed}%)`;
            taxes.push(text);
        }

        // ST
        if (formData.st_applies) {
            taxes.push(`ST (MVA ${formData.st_mva_percent}%)`);
        }

        if (formData.ipi_applies) taxes.push(`IPI ${formData.ipi_rate_percent}%`);

        if (taxes.length > 0) {
            parts.push(` com ${taxes.join(', ')}.`);
        } else {
            parts.push('.');
        }

        return parts.join(' ');
    };

    const isSimples = taxRegime?.toLowerCase().includes('simples');

    // Determine Title
    const pageTitle = initialData?.id && !isDuplicate ? "Editar Regra Fiscal" : (isDuplicate ? "Duplicar Regra Fiscal" : "Nova Regra Fiscal");

    return (
        <div className="pb-20">
            <PageHeader
                title={pageTitle}
                subtitle="Defina os parâmetros para cálculo automático de impostos."
                actions={
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" onClick={() => router.back()}>
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Voltar
                        </Button>
                        <Button onClick={handleSave} disabled={isLoading} className="bg-brand-600 hover:bg-brand-700 text-white">
                            {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                            Salvar Regra
                        </Button>
                    </div>
                }
            />

            <div className="container mx-auto max-w-[1600px] px-6">
                <div className="grid grid-cols-12 gap-6">

                    {/* LEFT COLUMN: Application Rules */}
                    <div className="col-span-12 lg:col-span-4 space-y-4">
                        <Card>
                            <CardHeaderStandard title="Aplicação da Regra" icon={<AlertTriangle className="w-4 h-4 text-brand-600" />} />
                            <CardContent className="space-y-4 pt-4">

                                {/* Tax Group */}
                                <div>
                                    <Label>Grupo Tributário *</Label>
                                    <Select
                                        value={formData.tax_group_id}
                                        onValueChange={(v) => handleChange('tax_group_id', v)}
                                    >
                                        <SelectTrigger className="mt-1">
                                            <SelectValue placeholder="Selecione..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {taxGroups.map(g => (
                                                <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* UF Destination */}
                                <div>
                                    <Label>UF de Destino *</Label>
                                    <Select
                                        value={formData.destination_state}
                                        onValueChange={(v) => handleChange('destination_state', v)}
                                    >
                                        <SelectTrigger className="mt-1">
                                            <SelectValue placeholder="UF" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {STATES.map(s => (
                                                <SelectItem key={s} value={s}>{s}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Customer Profile */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="col-span-2">
                                        <Label>Indicador IE do Cliente</Label>
                                        <Select
                                            value={formData.customer_ie_indicator}
                                            onValueChange={(v) => handleChange('customer_ie_indicator', v)}
                                        >
                                            <SelectTrigger className="mt-1">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="contributor">Contribuinte (Com IE)</SelectItem>
                                                <SelectItem value="exempt">Isento (Com IE)</SelectItem>
                                                <SelectItem value="non_contributor">Não Contribuinte (Sem IE)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="col-span-2 flex items-center gap-2 border p-3 rounded-lg bg-gray-50">
                                        <Switch
                                            checked={formData.customer_is_final_consumer}
                                            onCheckedChange={(v) => handleChange('customer_is_final_consumer', v)}
                                        />
                                        <Label className="cursor-pointer" onClick={() => handleChange('customer_is_final_consumer', !formData.customer_is_final_consumer)}>
                                            Consumidor Final
                                        </Label>
                                    </div>
                                </div>

                                {/* Operation Type */}
                                <div>
                                    <Label>Tipo de Operação</Label>
                                    <Select
                                        value={formData.operation_type}
                                        onValueChange={(v) => handleChange('operation_type', v)}
                                    >
                                        <SelectTrigger className="mt-1">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="sales">Venda</SelectItem>
                                            <SelectItem value="return">Devolução</SelectItem>
                                            <SelectItem value="shipment">Remessa</SelectItem>
                                            <SelectItem value="bonus">Bonificação</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeaderStandard title="Status e Resumo" icon={<FileText className="w-4 h-4 text-gray-500" />} />
                            <CardContent className="space-y-4 pt-4">
                                <div className="flex items-center gap-2 pb-4 border-b border-gray-100">
                                    <Switch
                                        checked={formData.is_active}
                                        onCheckedChange={(v) => handleChange('is_active', v)}
                                    />
                                    <Label>Regra Ativa</Label>
                                </div>

                                <div>
                                    <Label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Resumo da Regra</Label>
                                    <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                                        <p className="text-sm text-gray-700 leading-relaxed font-medium">
                                            {getSummary()}
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* RIGHT COLUMN: Taxes */}
                    <div className="col-span-12 lg:col-span-8">
                        <Card className="h-full">
                            <CardHeaderStandard title="CFOP e Impostos" />
                            <CardContent className="pt-4 space-y-6">

                                {/* CFOP Row - True Gold Combobox */}
                                <div className="flex flex-col gap-2 relative">
                                    <Label className="text-brand-900 font-bold">CFOP *</Label>
                                    <Popover open={cfopOpen} onOpenChange={setCfopOpen}>
                                        <PopoverTrigger asChild>
                                            <div
                                                role="button"
                                                tabIndex={0}
                                                aria-expanded={cfopOpen}
                                                className="flex w-full items-center justify-between rounded-xl border border-brand-200 bg-white px-3 h-12 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                                                onClick={() => setCfopOpen(!cfopOpen)}
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter" || e.key === " ") {
                                                        e.preventDefault();
                                                        setCfopOpen(!cfopOpen);
                                                    }
                                                }}
                                            >
                                                {selectedCfopData ? (
                                                    <div className="flex items-center gap-2 overflow-hidden">
                                                        <span className="font-mono font-bold text-brand-700 text-lg">{selectedCfopData.codigo}</span>
                                                        <span className="text-gray-600 truncate text-sm"> – {selectedCfopData.descricao}</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-gray-400">Selecione um CFOP...</span>
                                                )}
                                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                            </div>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-[600px] p-0 pointer-events-auto" align="start">
                                            <Command>
                                                <CommandInput placeholder="Buscar CFOP (código ou descrição)..." />
                                                <CommandList>
                                                    <CommandEmpty>Nenhum CFOP encontrado.</CommandEmpty>
                                                    <CommandGroup>
                                                        {filteredCfops.map((cfop) => (
                                                            <CommandItem
                                                                key={cfop.codigo}
                                                                value={`${cfop.codigo} ${cfop.descricao}`}
                                                                onSelect={() => {
                                                                    handleChange('cfop', cfop.codigo);
                                                                    setCfopOpen(false);
                                                                }}
                                                                className="cursor-pointer w-full justify-start text-left items-center aria-selected:bg-brand-50 aria-selected:text-brand-900 py-2.5 px-3 mb-1 rounded-lg transition-colors border-transparent border aria-selected:border-brand-100"
                                                            >
                                                                <Check
                                                                    className={cn(
                                                                        "mr-3 h-4 w-4 text-brand-600",
                                                                        formData.cfop === cfop.codigo
                                                                            ? "opacity-100"
                                                                            : "opacity-0"
                                                                    )}
                                                                />
                                                                <span className="font-mono font-bold text-brand-700 mr-2 text-base">{cfop.codigo}</span>
                                                                <span className="text-gray-600 truncate flex-1 block">- {cfop.descricao}</span>
                                                            </CommandItem>
                                                        ))}
                                                    </CommandGroup>
                                                </CommandList>
                                            </Command>
                                        </PopoverContent>
                                    </Popover>
                                    <p className="text-xs text-brand-600/80">
                                        {formData.destination_state === 'SP'
                                            ? 'Exibindo apenas CFOPs Estaduais (SP)'
                                            : 'Exibindo apenas CFOPs Interestaduais/Exterior'
                                        }
                                    </p>
                                </div>


                                <Tabs defaultValue="icms" className="w-full">
                                    <TabsList className="w-full justify-start h-auto p-1 bg-gray-100 rounded-xl mb-6">
                                        <TabsTrigger
                                            value="icms"
                                            className="flex-1 rounded-lg px-4 py-2 text-sm font-medium text-gray-500 data-[state=active]:bg-white data-[state=active]:text-brand-600 data-[state=active]:shadow-sm transition-all"
                                        >
                                            ICMS
                                        </TabsTrigger>
                                        <TabsTrigger
                                            value="st"
                                            className="flex-1 rounded-lg px-4 py-2 text-sm font-medium text-gray-500 data-[state=active]:bg-white data-[state=active]:text-brand-600 data-[state=active]:shadow-sm transition-all"
                                        >
                                            ICMS ST
                                        </TabsTrigger>
                                        <TabsTrigger
                                            value="pis_cofins"
                                            className="flex-1 rounded-lg px-4 py-2 text-sm font-medium text-gray-500 data-[state=active]:bg-white data-[state=active]:text-brand-600 data-[state=active]:shadow-sm transition-all"
                                        >
                                            PIS / COFINS
                                        </TabsTrigger>
                                        <TabsTrigger
                                            value="ipi"
                                            className="flex-1 rounded-lg px-4 py-2 text-sm font-medium text-gray-500 data-[state=active]:bg-white data-[state=active]:text-brand-600 data-[state=active]:shadow-sm transition-all"
                                        >
                                            IPI
                                        </TabsTrigger>
                                    </TabsList>

                                    <div className="space-y-4">

                                        {/* ICMS TAB */}
                                        <TabsContent value="icms" className="m-0 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                            <div className="grid grid-cols-2 gap-4">

                                                {!isSimples && (
                                                    <div className="col-span-2 md:col-span-1">
                                                        <Label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">CST (Normal)</Label>
                                                        <Select
                                                            value={formData.icms_cst || ''}
                                                            onValueChange={(v) => handleChange('icms_cst', v)}
                                                        >
                                                            <SelectTrigger className="h-9 text-sm">
                                                                <SelectValue placeholder="Selecione..." />
                                                            </SelectTrigger>
                                                            <SelectContent className="max-h-[300px]">
                                                                {ICMS_CST_OPTIONS.map(opt => (
                                                                    <SelectItem key={opt.value} value={opt.value}>
                                                                        <span className="font-medium mr-2">{opt.value}</span>
                                                                        <span className="text-gray-500">- {opt.label.split('–')[1]?.trim() || opt.label}</span>
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                )}

                                                {isSimples && (
                                                    <div className="col-span-2 md:col-span-1">
                                                        <Label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">CSOSN (Simples)</Label>
                                                        <Select
                                                            value={formData.icms_csosn || ''}
                                                            onValueChange={(v) => handleChange('icms_csosn', v)}
                                                        >
                                                            <SelectTrigger className="h-9 text-sm">
                                                                <SelectValue placeholder="Selecione..." />
                                                            </SelectTrigger>
                                                            <SelectContent className="max-h-[300px]">
                                                                {ICMS_CSOSN_OPTIONS.map(opt => (
                                                                    <SelectItem key={opt.value} value={opt.value}>
                                                                        <span className="font-medium mr-2">{opt.value}</span>
                                                                        <span className="text-gray-500">- {opt.label.split('–')[1]?.trim() || opt.label}</span>
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                )}

                                                <div className="col-span-2 md:col-span-1">
                                                    <Label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Alíquota ICMS (%)</Label>
                                                    <DecimalInput
                                                        value={formData.icms_rate_percent || 0}
                                                        onChange={(val) => handleChange('icms_rate_percent', val)}
                                                        precision={2}
                                                        min={0}
                                                        max={100}
                                                        className="h-9 bg-white"
                                                    />
                                                </div>

                                                <div className="col-span-2 md:col-span-1">
                                                    <Label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Redução Base Calc. (%)</Label>
                                                    <DecimalInput
                                                        value={formData.icms_reduction_bc_percent || 0}
                                                        onChange={(val) => handleChange('icms_reduction_bc_percent', val)}
                                                        precision={2}
                                                        min={0}
                                                        max={100}
                                                        className="h-9 bg-white"
                                                    />
                                                </div>

                                                <div className="col-span-2 md:col-span-1">
                                                    <Label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Modalidade Base Calc.</Label>
                                                    <Select
                                                        value={formData.icms_modal_bc}
                                                        onValueChange={(v) => handleChange('icms_modal_bc', v)}
                                                    >
                                                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="3">3 - Valor da Operação</SelectItem>
                                                            <SelectItem value="0">0 - Margem Valor Agregado (%)</SelectItem>
                                                            <SelectItem value="1">1 - Pauta (Valor)</SelectItem>
                                                            <SelectItem value="2">2 - Preço Tabelado Máx.</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>

                                                <div className="col-span-2 flex items-center gap-3 pt-1 p-3 bg-blue-50/50 rounded-lg border border-blue-100">
                                                    <Switch
                                                        checked={formData.icms_show_in_xml}
                                                        onCheckedChange={(v) => handleChange('icms_show_in_xml', v)}
                                                        className="data-[state=checked]:bg-blue-600 scale-90"
                                                    />
                                                    <Label className="text-xs font-bold text-blue-900 cursor-pointer uppercase tracking-wide" onClick={() => handleChange('icms_show_in_xml', !formData.icms_show_in_xml)}>
                                                        Destacar valor do ICMS no XML
                                                    </Label>
                                                </div>

                                            </div>
                                        </TabsContent>

                                        {/* ST TAB */}
                                        <TabsContent value="st" className="m-0 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                            <div className="flex items-center gap-3 mb-4 bg-amber-50 p-3 rounded-lg border border-amber-100">
                                                <Switch
                                                    checked={formData.st_applies}
                                                    onCheckedChange={(v) => handleChange('st_applies', v)}
                                                    className="data-[state=checked]:bg-amber-500 scale-90"
                                                />
                                                <div className="flex flex-col">
                                                    <Label className="text-xs font-bold text-amber-900 cursor-pointer uppercase tracking-wide" onClick={() => handleChange('st_applies', !formData.st_applies)}>
                                                        Aplicar Substituição Tributária (ST)
                                                    </Label>
                                                </div>
                                            </div>

                                            {formData.st_applies && (
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="col-span-2 md:col-span-1">
                                                        <Label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block font-bold text-amber-700">MVA (%)</Label>
                                                        <DecimalInput
                                                            value={formData.st_mva_percent || 0}
                                                            onChange={(val) => handleChange('st_mva_percent', val)}
                                                            precision={2}
                                                            className="h-9 bg-white border-amber-200 focus:border-amber-400 focus:ring-amber-200"
                                                        />
                                                    </div>
                                                    <div className="col-span-2 md:col-span-1">
                                                        <Label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block font-bold text-amber-700">Alíquota ST (%)</Label>
                                                        <DecimalInput
                                                            value={formData.st_rate_percent || 0}
                                                            onChange={(val) => handleChange('st_rate_percent', val)}
                                                            precision={2}
                                                            className="h-9 bg-white border-amber-200 focus:border-amber-400 focus:ring-amber-200"
                                                        />
                                                    </div>
                                                    <div className="col-span-2 md:col-span-1">
                                                        <Label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Redução Base ST (%)</Label>
                                                        <DecimalInput
                                                            value={formData.st_reduction_bc_percent || 0}
                                                            onChange={(val) => handleChange('st_reduction_bc_percent', val)}
                                                            precision={2}
                                                            className="h-9 bg-white"
                                                        />
                                                    </div>
                                                    <div className="col-span-2 md:col-span-1">
                                                        <Label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">FCP ST (%)</Label>
                                                        <DecimalInput
                                                            value={formData.st_fcp_percent || 0}
                                                            onChange={(val) => handleChange('st_fcp_percent', val)}
                                                            precision={2}
                                                            className="h-9 bg-white"
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </TabsContent>

                                        {/* PIS COFINS TAB */}
                                        <TabsContent value="pis_cofins" className="m-0 space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">

                                            {/* PIS */}
                                            <div className="space-y-3">
                                                <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                                                    <Label className="text-sm font-bold text-gray-800 uppercase">PIS</Label>
                                                    <Switch checked={formData.pis_applies} onCheckedChange={(v) => handleChange('pis_applies', v)} className="scale-90" />
                                                </div>
                                                {formData.pis_applies && (
                                                    <div className="grid grid-cols-2 gap-4 bg-gray-50/50 p-3 rounded-lg border border-gray-100">
                                                        <div className="col-span-2">
                                                            <Label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">CST PIS</Label>
                                                            <Select
                                                                value={formData.pis_cst || ''}
                                                                onValueChange={(v) => handleChange('pis_cst', v)}
                                                            >
                                                                <SelectTrigger className="h-9 bg-white">
                                                                    <SelectValue placeholder="Selecione..." />
                                                                </SelectTrigger>
                                                                <SelectContent className="max-h-[300px]">
                                                                    {PIS_COFINS_CST_OPTIONS.map(opt => (
                                                                        <SelectItem key={opt.value} value={opt.value}>
                                                                            <span className="font-medium mr-2">{opt.value}</span>
                                                                            <span className="text-gray-500">- {opt.label.split('–')[1]?.trim() || opt.label}</span>
                                                                        </SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                        <div className="col-span-2 md:col-span-1">
                                                            <Label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Alíquota PIS (%)</Label>
                                                            <DecimalInput
                                                                value={formData.pis_rate_percent || 0}
                                                                onChange={(val) => handleChange('pis_rate_percent', val)}
                                                                precision={2}
                                                                className="h-9 bg-white"
                                                            />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* COFINS */}
                                            <div className="space-y-3">
                                                <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                                                    <Label className="text-sm font-bold text-gray-800 uppercase">COFINS</Label>
                                                    <Switch checked={formData.cofins_applies} onCheckedChange={(v) => handleChange('cofins_applies', v)} className="scale-90" />
                                                </div>
                                                {formData.cofins_applies && (
                                                    <div className="grid grid-cols-2 gap-4 bg-gray-50/50 p-3 rounded-lg border border-gray-100">
                                                        <div className="col-span-2">
                                                            <Label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">CST COFINS</Label>
                                                            <Select
                                                                value={formData.cofins_cst || ''}
                                                                onValueChange={(v) => handleChange('cofins_cst', v)}
                                                            >
                                                                <SelectTrigger className="h-9 bg-white">
                                                                    <SelectValue placeholder="Selecione..." />
                                                                </SelectTrigger>
                                                                <SelectContent className="max-h-[300px]">
                                                                    {PIS_COFINS_CST_OPTIONS.map(opt => (
                                                                        <SelectItem key={opt.value} value={opt.value}>
                                                                            <span className="font-medium mr-2">{opt.value}</span>
                                                                            <span className="text-gray-500">- {opt.label.split('–')[1]?.trim() || opt.label}</span>
                                                                        </SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                        <div className="col-span-2 md:col-span-1">
                                                            <Label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Alíquota COFINS (%)</Label>
                                                            <DecimalInput
                                                                value={formData.cofins_rate_percent || 0}
                                                                onChange={(val) => handleChange('cofins_rate_percent', val)}
                                                                precision={2}
                                                                className="h-9 bg-white"
                                                            />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </TabsContent>

                                        {/* IPI TAB */}
                                        <TabsContent value="ipi" className="m-0 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                            <div className="flex items-center gap-3 mb-4 bg-purple-50 p-3 rounded-lg border border-purple-100">
                                                <Switch
                                                    checked={formData.ipi_applies}
                                                    onCheckedChange={(v) => handleChange('ipi_applies', v)}
                                                    className="data-[state=checked]:bg-purple-600 scale-90"
                                                />
                                                <div className="flex flex-col">
                                                    <Label className="text-xs font-bold text-purple-900 cursor-pointer uppercase tracking-wide" onClick={() => handleChange('ipi_applies', !formData.ipi_applies)}>
                                                        Aplicar IPI
                                                    </Label>
                                                </div>
                                            </div>

                                            {formData.ipi_applies && (
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="col-span-2">
                                                        <Label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">CST IPI</Label>
                                                        <Select
                                                            value={formData.ipi_cst || ''}
                                                            onValueChange={(v) => handleChange('ipi_cst', v)}
                                                        >
                                                            <SelectTrigger className="h-9 bg-white">
                                                                <SelectValue placeholder="Selecione..." />
                                                            </SelectTrigger>
                                                            <SelectContent className="max-h-[300px]">
                                                                {IPI_CST_OPTIONS.map(opt => (
                                                                    <SelectItem key={opt.value} value={opt.value}>
                                                                        <span className="font-medium mr-2">{opt.value}</span>
                                                                        <span className="text-gray-500">- {opt.label.split('–')[1]?.trim() || opt.label}</span>
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div className="col-span-2 md:col-span-1">
                                                        <Label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Alíquota IPI (%)</Label>
                                                        <DecimalInput
                                                            value={formData.ipi_rate_percent || 0}
                                                            onChange={(val) => handleChange('ipi_rate_percent', val)}
                                                            precision={2}
                                                            className="h-9 bg-white"
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </TabsContent>

                                    </div>
                                </Tabs>

                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}
