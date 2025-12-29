"use client";

import { useEffect, useState } from "react";
import { useCompany } from "@/contexts/CompanyContext";
import { createClient } from "@/lib/supabaseBrowser";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { TaxGroup, getTaxGroups } from "@/lib/data/tax-groups";
import { FiscalOperation, createFiscalOperation, updateFiscalOperation, getFiscalOperations } from "@/lib/data/fiscal-operations";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/use-toast";
import { PageHeader } from "@/components/ui/PageHeader";
import { Loader2, Save, ArrowLeft, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { CardHeaderStandard } from "@/components/ui/CardHeaderStandard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { Checkbox } from "@/components/ui/checkbox"; // Assuming you have this
import { Label } from "@/components/ui/Label";
import { DecimalInput } from "@/components/ui/DecimalInput";
import { Switch } from "@/components/ui/Switch";
import { cn } from "@/lib/utils";

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
        }
    }, [selectedCompany]);

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


    const handleChange = (field: keyof FiscalOperation, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleSave = async () => {
        if (!selectedCompany) return;
        setIsLoading(true);

        try {
            // Validations
            if (!formData.tax_group_id) throw new Error("Selecione o Grupo Tributário.");
            if (!formData.destination_state) throw new Error("Selecione a UF de Destino.");
            if (!formData.cfop || formData.cfop.length !== 4) throw new Error("CFOP inválido (deve ter 4 dígitos).");

            // ICMS Validations
            if (!formData.icms_cst && !formData.icms_csosn) throw new Error("Selecione o CST ou CSOSN do ICMS.");
            if ((formData.icms_reduction_bc_percent || 0) > 100) throw new Error("Redução BC ICMS não pode ser maior que 100%.");

            // ST Validations
            if (formData.st_applies) {
                if (formData.st_mva_percent === undefined || formData.st_mva_percent === null) throw new Error("MVA é obrigatório para ST.");
                if (!formData.st_rate_percent) throw new Error("Alíquota ST é obrigatória.");
            }

            const payload = {
                ...formData,
                company_id: selectedCompany.id
            } as any;

            if (initialData?.id && !isDuplicate) {
                await updateFiscalOperation(supabase, initialData.id, payload);
                toast({ title: "Regra atualizada com sucesso!", className: "bg-green-600 text-white" });
            } else {
                await createFiscalOperation(supabase, payload);
                toast({ title: "Regra criada com sucesso!", className: "bg-green-600 text-white" });
            }

            router.push('/app/fiscal/operacoes');
        } catch (error: any) {
            console.error(error);
            toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    // Helper for Numeric Inputs
    const renderDecimal = (label: string, field: keyof FiscalOperation, required = false) => (
        <div>
            <Label className={cn("text-xs text-gray-500 mb-1 block", required && "font-bold text-gray-700")}>{label}</Label>
            <DecimalInput
                value={(formData[field] as number) || 0}
                onChange={(val) => handleChange(field, val)}
                precision={2}
                min={0}
                max={100}
                className="bg-white"
            />
        </div>
    );

    const isSimples = selectedCompany?.tax_regime === 'simples_nacional' || false;
    // Note: We don't have tax_regime in context yet, assuming standard logic or needing fetch.
    // For now we will allow user to pick either CST or CSOSN based on their knowledge, or show both.
    // Ideally we fetch company details. Let's show toggles? No, let's show based on a quick check or just both for flexibility now.

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
                            <CardHeaderStandard title="Status" />
                            <CardContent className="pt-4">
                                <div className="flex items-center gap-2">
                                    <Switch
                                        checked={formData.is_active}
                                        onCheckedChange={(v) => handleChange('is_active', v)}
                                    />
                                    <Label>Regra Ativa</Label>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* RIGHT COLUMN: Taxes */}
                    <div className="col-span-12 lg:col-span-8">
                        <Card className="h-full">
                            <CardHeaderStandard title="CFOP e Impostos" />
                            <CardContent className="pt-4 space-y-6">

                                {/* CFOP Row */}
                                <div className="flex items-end gap-4 p-4 bg-brand-50/50 rounded-xl border border-brand-100">
                                    <div className="w-32">
                                        <Label className="text-brand-900 font-bold">CFOP *</Label>
                                        <Input
                                            value={formData.cfop || ''}
                                            onChange={(e) => {
                                                const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 4);
                                                handleChange('cfop', val);
                                            }}
                                            placeholder="Ex: 5102"
                                            className="mt-1 bg-white font-mono font-bold text-center tracking-wider"
                                        />
                                    </div>
                                    <div className="pb-3 text-xs text-brand-700">
                                        Código Fiscal de Operações e Prestações (4 dígitos)
                                    </div>
                                </div>

                                <Tabs defaultValue="icms" className="w-full">
                                    <TabsList className="w-full justify-start border-b rounded-none px-0 bg-transparent h-auto p-0">
                                        <TabsTrigger value="icms" className="rounded-t-lg data-[state=active]:bg-white data-[state=active]:border-b-white border border-transparent px-6 py-2">ICMS</TabsTrigger>
                                        <TabsTrigger value="st" className="rounded-t-lg data-[state=active]:bg-white data-[state=active]:border-b-white border border-transparent px-6 py-2">ICMS ST</TabsTrigger>
                                        <TabsTrigger value="pis_cofins" className="rounded-t-lg data-[state=active]:bg-white data-[state=active]:border-b-white border border-transparent px-6 py-2">PIS / COFINS</TabsTrigger>
                                        <TabsTrigger value="ipi" className="rounded-t-lg data-[state=active]:bg-white data-[state=active]:border-b-white border border-transparent px-6 py-2">IPI</TabsTrigger>
                                    </TabsList>

                                    <div className="p-6 border border-t-0 rounded-b-xl bg-white/50 space-y-6">

                                        {/* ICMS TAB */}
                                        <TabsContent value="icms" className="m-0 space-y-6">
                                            <div className="grid grid-cols-2 gap-6">
                                                <div className="col-span-2 md:col-span-1">
                                                    <Label>CST (Normal)</Label>
                                                    <Input
                                                        value={formData.icms_cst || ''}
                                                        onChange={(e) => handleChange('icms_cst', e.target.value)}
                                                        placeholder="Ex: 00, 10, 20..."
                                                        className="mt-1"
                                                    />
                                                </div>
                                                <div className="col-span-2 md:col-span-1">
                                                    <Label>CSOSN (Simples)</Label>
                                                    <Input
                                                        value={formData.icms_csosn || ''}
                                                        onChange={(e) => handleChange('icms_csosn', e.target.value)}
                                                        placeholder="Ex: 101, 102..."
                                                        className="mt-1"
                                                    />
                                                </div>

                                                {renderDecimal("Alíquota ICMS (%)", "icms_rate_percent", true)}
                                                {renderDecimal("Redução Base Calc. (%)", "icms_reduction_bc_percent")}

                                                <div className="col-span-2 md:col-span-1">
                                                    <Label>Modalidade Base Calc.</Label>
                                                    <Select
                                                        value={formData.icms_modal_bc}
                                                        onValueChange={(v) => handleChange('icms_modal_bc', v)}
                                                    >
                                                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="3">3 - Valor da Operação</SelectItem>
                                                            <SelectItem value="0">0 - Margem Valor Agregado (%)</SelectItem>
                                                            <SelectItem value="1">1 - Pauta (Valor)</SelectItem>
                                                            <SelectItem value="2">2 - Preço Tabelado Máx.</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>

                                                <div className="col-span-2 flex items-center gap-2 pt-4">
                                                    <Switch
                                                        checked={formData.icms_show_in_xml}
                                                        onCheckedChange={(v) => handleChange('icms_show_in_xml', v)}
                                                    />
                                                    <Label>Destacar valor do ICMS no XML</Label>
                                                </div>

                                            </div>
                                        </TabsContent>

                                        {/* ST TAB */}
                                        <TabsContent value="st" className="m-0 space-y-6">
                                            <div className="flex items-center gap-2 mb-4 bg-amber-50 p-3 rounded-lg border border-amber-100">
                                                <Switch
                                                    checked={formData.st_applies}
                                                    onCheckedChange={(v) => handleChange('st_applies', v)}
                                                    className="data-[state=checked]:bg-amber-500"
                                                />
                                                <Label className="font-bold text-amber-900">Aplicar Substituição Tributária (ST)</Label>
                                            </div>

                                            {formData.st_applies && (
                                                <div className="grid grid-cols-2 gap-6 animate-in fade-in slide-in-from-top-2">
                                                    {renderDecimal("MVA (%)", "st_mva_percent", true)}
                                                    {renderDecimal("Alíquota ST (%)", "st_rate_percent", true)}
                                                    {renderDecimal("Redução Base ST (%)", "st_reduction_bc_percent")}
                                                    {renderDecimal("FCP ST (%)", "st_fcp_percent")}
                                                </div>
                                            )}
                                        </TabsContent>

                                        {/* PIS COFINS TAB */}
                                        <TabsContent value="pis_cofins" className="m-0 space-y-8">

                                            {/* PIS */}
                                            <div className="space-y-4">
                                                <div className="flex items-center justify-between border-b pb-2">
                                                    <Label className="text-base font-bold text-gray-700">PIS</Label>
                                                    <Switch checked={formData.pis_applies} onCheckedChange={(v) => handleChange('pis_applies', v)} />
                                                </div>
                                                {formData.pis_applies && (
                                                    <div className="grid grid-cols-2 gap-6">
                                                        <div>
                                                            <Label>CST PIS</Label>
                                                            <Input
                                                                value={formData.pis_cst || ''}
                                                                onChange={(e) => handleChange('pis_cst', e.target.value)}
                                                                className="mt-1"
                                                                placeholder="Ex: 01"
                                                            />
                                                        </div>
                                                        {renderDecimal("Alíquota PIS (%)", "pis_rate_percent")}
                                                    </div>
                                                )}
                                            </div>

                                            {/* COFINS */}
                                            <div className="space-y-4">
                                                <div className="flex items-center justify-between border-b pb-2">
                                                    <Label className="text-base font-bold text-gray-700">COFINS</Label>
                                                    <Switch checked={formData.cofins_applies} onCheckedChange={(v) => handleChange('cofins_applies', v)} />
                                                </div>
                                                {formData.cofins_applies && (
                                                    <div className="grid grid-cols-2 gap-6">
                                                        <div>
                                                            <Label>CST COFINS</Label>
                                                            <Input
                                                                value={formData.cofins_cst || ''}
                                                                onChange={(e) => handleChange('cofins_cst', e.target.value)}
                                                                className="mt-1"
                                                                placeholder="Ex: 01"
                                                            />
                                                        </div>
                                                        {renderDecimal("Alíquota COFINS (%)", "cofins_rate_percent")}
                                                    </div>
                                                )}
                                            </div>
                                        </TabsContent>

                                        {/* IPI TAB */}
                                        <TabsContent value="ipi" className="m-0 space-y-6">
                                            <div className="flex items-center gap-2 mb-4 bg-gray-50 p-3 rounded-lg border">
                                                <Switch
                                                    checked={formData.ipi_applies}
                                                    onCheckedChange={(v) => handleChange('ipi_applies', v)}
                                                />
                                                <Label>Aplicar IPI</Label>
                                            </div>

                                            {formData.ipi_applies && (
                                                <div className="grid grid-cols-2 gap-6 animate-in fade-in slide-in-from-top-2">
                                                    <div>
                                                        <Label>CST IPI</Label>
                                                        <Input
                                                            value={formData.ipi_cst || ''}
                                                            onChange={(e) => handleChange('ipi_cst', e.target.value)}
                                                            className="mt-1"
                                                        />
                                                    </div>
                                                    {renderDecimal("Alíquota IPI (%)", "ipi_rate_percent")}
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
