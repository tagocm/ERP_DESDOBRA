"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCompany } from "@/contexts/CompanyContext";
import { PageHeader } from "@/components/ui/PageHeader";
import { createClient } from "@/lib/supabaseBrowser";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { cn, toTitleCase } from "@/lib/utils";
import { formatCNPJ, validateCNPJ, extractDigits } from "@/lib/cnpj";
import Link from "next/link";
import { Loader2, Search, CreditCard, ArrowRight, Building2, AlertTriangle, CheckCircle2, ShieldCheck, History } from "lucide-react";
import { CertificatesSection } from "@/components/settings/CertificatesSection";
import { CompanyLogo } from "@/components/settings/CompanyLogo";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { NumberingAdjustmentModal } from "@/components/settings/NumberingAdjustmentModal";

// Tabs Component
function Tabs({ tabs, activeTab, onTabChange }: { tabs: { id: string, label: string }[], activeTab: string, onTabChange: (id: string) => void }) {
    return (
        <div className="flex border-b border-gray-200 mb-6 overflow-x-auto">
            {tabs.map((tab) => (
                <button
                    key={tab.id}
                    onClick={() => onTabChange(tab.id)}
                    className={cn(
                        "px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors",
                        activeTab === tab.id
                            ? "border-blue-600 text-blue-600"
                            : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                    )}
                >
                    {tab.label}
                </button>
            ))}
        </div>
    );
}

export default function CompanySettingsPage() {
    const { selectedCompany, isLoading: isContextLoading, user } = useCompany(); // Assuming User is available in context or needs to be fetched
    const supabase = createClient();

    const searchParams = useSearchParams();
    const isNew = searchParams.get("new") === "true";

    const [activeTab, setActiveTab] = useState("identification");
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'warning' | 'error', text: string } | null>(null);

    const [originalData, setOriginalData] = useState<any>(null);

    // Modal State
    const [isNumberingModalOpen, setIsNumberingModalOpen] = useState(false);

    // CNPJ Lookup State
    const [cnpjLoading, setCnpjLoading] = useState(false);

    // Form State
    const [formData, setFormData] = useState<any>({
        // Identification
        legal_name: "",
        trade_name: "",
        cnpj: "",
        ie: "",
        ie_isento: false,
        im: "",
        cnae_code: "", // Split
        cnae_description: "", // Split
        crt: null,
        // Contact
        phone: "",
        email: "",
        website: "",
        // Address
        address_zip: "",
        address_street: "",
        address_number: "",
        address_complement: "",
        address_neighborhood: "",
        address_city: "",
        address_state: "",
        address_ibge_code: "",
        // Fiscal
        tax_regime: "",
        // NFe
        nfe_model: 55, // Fixed
        nfe_environment: "homologation",
        nfe_series: "", // String 1-3 digits
        nfe_next_number: 1
    });

    const isDirty = originalData && JSON.stringify(formData) !== JSON.stringify(originalData);

    useEffect(() => {
        if (!selectedCompany) return;

        async function fetchSettings() {
            setIsLoading(true);
            try {
                const { data, error } = await supabase
                    .from("company_settings")
                    .select("*")
                    .eq("company_id", selectedCompany?.id)
                    .single();

                if (error && error.code !== "PGRST116") {
                    console.error("Error fetching settings:", error);
                }

                let initialData;
                if (data) {
                    initialData = {
                        ...data,
                        nfe_model: data.nfe_model || 55, // Default if null
                        nfe_next_number: data.nfe_next_number || 1
                    };
                } else {
                    initialData = {
                        ...formData,
                        trade_name: selectedCompany?.name || ''
                    };
                }
                setFormData(initialData);
                setOriginalData(initialData);

            } finally {
                setIsLoading(false);
            }
        }

        fetchSettings();
    }, [selectedCompany, supabase]);

    // Audit Log Helper
    const logAudit = async (action: string, entity: string, entityId: string, details: any) => {
        try {
            // Safe fetch user if not in context
            const { data: { user: currentUser } } = await supabase.auth.getUser();

            await supabase.from("audit_logs").insert({
                company_id: selectedCompany?.id,
                user_id: currentUser?.id,
                action,
                entity,
                entity_id: entityId,
                details
            });
        } catch (e) {
            console.error("Audit Log Error", e);
        }
    };

    const getCRT = (regime: string) => {
        if (regime === 'simples_nacional') return 1;
        if (regime === 'lucro_presumido' || regime === 'lucro_real') return 3;
        return 3;
    }

    const handleSave = async () => {
        setMessage(null);
        if (!selectedCompany) return;
        setIsSaving(true);

        try {
            // 1. Validations
            if (formData.cnpj && !validateCNPJ(formData.cnpj)) throw new Error("CNPJ inválido.");
            if (!formData.tax_regime) {
                if (activeTab !== 'fiscal') setActiveTab('fiscal');
                throw new Error("O Regime Tributário é obrigatório.");
            }
            if (!formData.ie_isento && !formData.ie) throw new Error("A Inscrição Estadual é obrigatória (ou marque Isento).");

            // Address & IBGE
            if (!formData.address_ibge_code) {
                if (activeTab !== 'address') setActiveTab('address');
                throw new Error("O Código IBGE do município é obrigatório (verifique o endereço).");
            }

            // Series Validation
            if (!formData.nfe_series || !/^\d{1,3}$/.test(formData.nfe_series)) {
                if (activeTab !== 'fiscal') setActiveTab('fiscal');
                throw new Error("Série inválida. Deve conter 1 a 3 dígitos.");
            }

            // Audit Environment Change
            if (originalData && formData.nfe_environment !== originalData.nfe_environment) {
                await logAudit("CHANGE_ENVIRONMENT", "company_settings", selectedCompany.id, {
                    old: originalData.nfe_environment,
                    new: formData.nfe_environment
                });
            }

            // 2. Normalization
            const normalizedData = {
                ...formData,
                legal_name: toTitleCase(formData.legal_name),
                trade_name: toTitleCase(formData.trade_name),
                address_street: toTitleCase(formData.address_street),
                address_neighborhood: toTitleCase(formData.address_neighborhood),
                address_city: toTitleCase(formData.address_city),
                address_complement: toTitleCase(formData.address_complement),
                cnae_description: toTitleCase(formData.cnae_description),
                cnae: `${formData.cnae_code || ''} - ${toTitleCase(formData.cnae_description || '')}`, // Legacy field sync
                address_state: formData.address_state?.toUpperCase(),
                ie: formData.ie_isento ? "" : formData.ie,
                crt: getCRT(formData.tax_regime),
                cnpj: extractDigits(formData.cnpj || ""),
                updated_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                company_id: selectedCompany.id
            };

            // Remove sensitive/backend-only fields that might cause schema cache errors if passed from client
            delete (normalizedData as any).cert_password_encrypted;
            delete (normalizedData as any).cert_a1_password_secret_id;

            const { error } = await supabase.from("company_settings").upsert(normalizedData);
            if (error) throw error;

            setFormData(normalizedData);
            setOriginalData(normalizedData);
            setMessage({ type: 'success', text: 'Dados fiscais e cadastrais atualizados com sucesso.' });

        } catch (err: any) {
            console.error(err);
            setMessage({ type: 'error', text: err.message });
        } finally {
            setIsSaving(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        if (name === 'cnpj') {
            setFormData((prev: any) => ({ ...prev, [name]: formatCNPJ(value) }));
        } else if (name === 'ie_isento') {
            const checked = (e.target as HTMLInputElement).checked;
            setFormData((prev: any) => ({ ...prev, ie_isento: checked, ie: checked ? '' : prev.ie }));
        } else {
            setFormData((prev: any) => ({ ...prev, [name]: value }));
        }
    };

    const handleNumberAdjustment = async (newNumber: number, motive: string) => {
        if (!selectedCompany) return;

        const oldNumber = formData.nfe_next_number;

        // Audited update via RPC or direct update if permitted
        // Direct update:
        const { error } = await supabase.from("company_settings").update({
            nfe_next_number: newNumber
        }).eq("company_id", selectedCompany.id);

        if (error) throw error;

        // Log
        await logAudit("ADJUST_NUMBERING", "company_settings", selectedCompany.id, {
            old_number: oldNumber,
            new_number: newNumber,
            motive
        });

        setFormData((prev: any) => ({ ...prev, nfe_next_number: newNumber }));
        setOriginalData((prev: any) => ({ ...prev, nfe_next_number: newNumber })); // Prevent dirty flag on this specific change
        setMessage({ type: 'success', text: 'Numeração ajustada e auditoria registrada.' });
    };

    const handleCNPJBlur = () => {
        if (formData.cnpj && extractDigits(formData.cnpj).length === 14) {
            fetchCNPJData();
        }
    };

    const fetchCNPJData = async () => {
        const cnpjDigits = extractDigits(formData.cnpj || "");
        if (cnpjDigits.length !== 14) return;
        setCnpjLoading(true);
        setMessage(null);

        try {
            const res = await fetch(`/api/cnpj/${cnpjDigits}`);
            const data = await res.json();
            if (!res.ok) {
                setMessage({ type: 'warning', text: `Aviso: busca automática falhou (${data.error}). Preencha manualmente.` });
                return;
            }

            setFormData((prev: any) => {
                const next = { ...prev };
                if (!next.legal_name) next.legal_name = toTitleCase(data.legal_name);
                if (!next.trade_name) next.trade_name = toTitleCase(data.trade_name || data.legal_name);

                // Address
                if (!next.address_zip && data.address.zip) next.address_zip = data.address.zip;
                if (!next.address_street && data.address.street) next.address_street = toTitleCase(data.address.street);
                if (!next.address_number && data.address.number) next.address_number = data.address.number;
                if (!next.address_neighborhood && data.address.neighborhood) next.address_neighborhood = toTitleCase(data.address.neighborhood);
                if (!next.address_city && data.address.city) next.address_city = toTitleCase(data.address.city);
                if (!next.address_state && data.address.state) next.address_state = data.address.state;
                if (!next.address_ibge_code && data.address.ibge) next.address_ibge_code = data.address.ibge;

                // CNAE Split
                if (data.cnae_code) {
                    next.cnae_code = data.cnae_code;
                    next.cnae_description = toTitleCase(data.cnae_description);
                }
                return next;
            });
            setMessage({ type: 'success', text: 'Dados preenchidos automaticamente.' });
        } catch (err) {
            setMessage({ type: 'warning', text: 'Erro ao buscar CNPJ.' });
        } finally {
            setCnpjLoading(false);
        }
    };

    if (isContextLoading) return <div className="p-8">Carregando...</div>;
    if (!selectedCompany) return <div className="p-8">Selecione uma empresa.</div>;
    if (isLoading) return <div className="p-8 h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;

    const isIbgeOk = !!formData.address_ibge_code;

    return (
        <div className="max-w-6xl mx-auto py-8">
            {message && (
                <Alert variant={message.type === 'error' ? 'destructive' : message.type === 'success' ? 'success' : 'default'} className="mb-4">
                    {message.text}
                </Alert>
            )}

            <PageHeader
                title="Configurações da Empresa"
                subtitle="Dados Cadastrais e Fiscais (NF-e)"
                actions={
                    <div className="flex items-center gap-2">
                        {isNumberingModalOpen && (
                            <NumberingAdjustmentModal
                                isOpen={isNumberingModalOpen}
                                onClose={() => setIsNumberingModalOpen(false)}
                                currentNumber={formData.nfe_next_number}
                                onConfirm={handleNumberAdjustment}
                            />
                        )}

                        <Button
                            onClick={handleSave}
                            disabled={!isDirty || isSaving}
                            variant={isDirty ? "primary" : "secondary"}
                            className={cn("min-w-[120px]", !isDirty && "opacity-80")}
                        >
                            {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                            {isSaving ? "Salvando..." : isDirty ? "Salvar Alterações" : "Salvo"}
                        </Button>
                    </div>
                }
            />

            <Tabs
                activeTab={activeTab}
                onTabChange={setActiveTab}
                tabs={[
                    { id: 'identification', label: 'Identificação' },
                    { id: 'address', label: 'Endereço & IBGE' },
                    { id: 'fiscal', label: 'Fiscal & NF-e' },
                    { id: 'finance', label: 'Financeiro' },
                    { id: 'certificates', label: 'Certificados' },
                ]}
            />

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Building2 className="w-5 h-5 text-gray-500" />
                        {activeTab === 'identification' && "Identificação da Empresa"}
                        {activeTab === 'address' && "Localização e Código IBGE"}
                        {activeTab === 'fiscal' && "Parâmetros Fiscais e Numeração"}
                        {activeTab === 'finance' && "Dados Financeiros"}
                        {activeTab === 'certificates' && "Certificado Digital A1"}
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">

                    {/* IDENTIFICATION TAB */}
                    {activeTab === 'identification' && (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            <div className="lg:col-span-2 space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">CNPJ <span className="text-red-500">*</span></label>
                                        <div className="flex gap-2">
                                            <Input
                                                name="cnpj"
                                                value={formData.cnpj || ''}
                                                onChange={handleChange}
                                                onBlur={handleCNPJBlur}
                                                maxLength={18}
                                                className="font-mono"
                                            />
                                            <Button type="button" variant="secondary" onClick={fetchCNPJData} disabled={cnpjLoading}>
                                                {cnpjLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                                            </Button>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Inscrição Estadual</label>
                                        <div className="flex gap-2 items-center">
                                            <Input
                                                name="ie"
                                                value={formData.ie || ''}
                                                onChange={handleChange}
                                                disabled={formData.ie_isento}
                                                placeholder={formData.ie_isento ? "ISENTO" : ""}
                                            />
                                            <div className="flex items-center gap-1.5 min-w-[70px]">
                                                <input
                                                    type="checkbox"
                                                    checked={formData.ie_isento || false}
                                                    onChange={(e) => handleChange({ target: { name: 'ie_isento', checked: e.target.checked } } as any)}
                                                    className="w-4 h-4"
                                                />
                                                <span className="text-xs font-medium">Isento</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Razão Social</label>
                                    <Input name="legal_name" value={formData.legal_name || ''} onChange={handleChange} />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Nome Fantasia</label>
                                    <Input name="trade_name" value={formData.trade_name || ''} onChange={handleChange} />
                                </div>

                                <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                                    <h4 className="text-xs font-bold text-gray-500 uppercase mb-3">Atividade Econômica (CNAE)</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-xs font-medium">Código</label>
                                            <Input name="cnae_code" value={formData.cnae_code || ''} onChange={handleChange} placeholder="0000-0/00" className="font-mono" />
                                        </div>
                                        <div className="md:col-span-2 space-y-2">
                                            <label className="text-xs font-medium">Descrição da Atividade</label>
                                            <Input name="cnae_description" value={formData.cnae_description || ''} onChange={handleChange} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="lg:col-span-1">
                                <CompanyLogo companyId={selectedCompany.id} onMessage={setMessage} />
                            </div>
                        </div>
                    )}

                    {/* ADDRESS TAB */}
                    {activeTab === 'address' && (
                        <div className="space-y-6">
                            <Alert className={cn("border", isIbgeOk ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200")}>
                                {isIbgeOk ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <AlertTriangle className="w-4 h-4 text-red-600" />}
                                <div className="ml-2">
                                    <div className={cn("text-sm font-semibold", isIbgeOk ? "text-green-800" : "text-red-800")}>
                                        {isIbgeOk ? "Endereço Válido para NF-e" : "Atenção: Endereço Incompleto"}
                                    </div>
                                    <div className="text-xs mt-1 text-gray-600">
                                        {isIbgeOk ? `Código IBGE ${formData.address_ibge_code} identificado com sucesso.` : "Não foi possível identificar o código IBGE. Verifique o CEP e a Cidade."}
                                    </div>
                                </div>
                            </Alert>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">CEP</label>
                                    <div className="flex gap-2">
                                        <Input name="address_zip" value={formData.address_zip || ''} onChange={handleChange} maxLength={9} />
                                        <Button size="icon" variant="outline"><Search className="w-4 h-4" /></Button>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Estado (UF)</label>
                                    <Input name="address_state" value={formData.address_state || ''} onChange={handleChange} maxLength={2} className="uppercase" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Cidade</label>
                                    <Input name="address_city" value={formData.address_city || ''} onChange={handleChange} />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Logradouro</label>
                                    <Input name="address_street" value={formData.address_street || ''} onChange={handleChange} />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Bairro</label>
                                    <Input name="address_neighborhood" value={formData.address_neighborhood || ''} onChange={handleChange} />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Número</label>
                                    <Input name="address_number" value={formData.address_number || ''} onChange={handleChange} />
                                </div>
                                <div className="md:col-span-2 space-y-2">
                                    <label className="text-sm font-medium">Complemento</label>
                                    <Input name="address_complement" value={formData.address_complement || ''} onChange={handleChange} />
                                </div>
                            </div>

                            <div className="border-t pt-4 mt-2">
                                <div className="flex items-center gap-2 mb-2">
                                    <ShieldCheck className="w-4 h-4 text-gray-500" />
                                    <h4 className="font-semibold text-gray-700">Validação Fiscal</h4>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-xs font-medium text-gray-500">Código Município (IBGE)</label>
                                        <Input
                                            name="address_ibge_code"
                                            value={formData.address_ibge_code || ''}
                                            onChange={handleChange} // Allow manual override if API fails
                                            className={cn("font-mono", !formData.address_ibge_code && "border-red-300 bg-red-50")}
                                        />
                                        <p className="text-[10px] text-gray-400">Preencha manualmente se a busca falhar.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* FISCAL TAB */}
                    {activeTab === 'fiscal' && (
                        <div className="space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Regime Tributário</label>
                                    <Select name="tax_regime" value={formData.tax_regime || ''} onChange={handleChange}>
                                        <option value="">Selecione...</option>
                                        <option value="simples_nacional">Simples Nacional</option>
                                        <option value="lucro_presumido">Lucro Presumido</option>
                                        <option value="lucro_real">Lucro Real</option>
                                    </Select>
                                    <div className="mt-1">
                                        {formData.crt && <Badge variant="outline" className="text-xs">CRT: {formData.crt}</Badge>}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Ambiente de Emissão</label>
                                    <div className="flex items-center gap-2">
                                        <Select name="nfe_environment" value={formData.nfe_environment || 'homologation'} onChange={handleChange}>
                                            <option value="homologation">HOMOLOGAÇÃO (Testes)</option>
                                            <option value="production">PRODUÇÃO (Validade Jurídica)</option>
                                        </Select>
                                        {formData.nfe_environment === 'production' && (
                                            <Badge variant="destructive" className="whitespace-nowrap">PRODUÇÃO</Badge>
                                        )}
                                        {formData.nfe_environment === 'homologation' && (
                                            <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 whitespace-nowrap">TESTES</Badge>
                                        )}
                                    </div>
                                    <p className="text-xs text-gray-500">Mudar de ambiente gera log de auditoria.</p>
                                </div>
                            </div>

                            <div className="rounded-lg border border-gray-200 overflow-hidden">
                                <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex justify-between items-center">
                                    <h3 className="font-semibold text-gray-700 flex items-center gap-2">
                                        <History className="w-4 h-4" /> Controle de Numeração (NF-e)
                                    </h3>
                                    <Badge variant="outline" className="bg-white">Modelo 55</Badge>
                                </div>
                                <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Série</label>
                                        <Input
                                            name="nfe_series"
                                            value={formData.nfe_series || ''}
                                            onChange={handleChange}
                                            placeholder="1"
                                            maxLength={3}
                                            className="font-mono text-center"
                                        />
                                        <p className="text-[10px] text-gray-400">Ex: 1 ou 101</p>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Próximo Número</label>
                                        <div className="text-2xl font-mono font-bold text-gray-900 bg-gray-100 p-2 rounded border border-gray-200 text-center">
                                            {formData.nfe_next_number}
                                        </div>
                                    </div>

                                    <div>
                                        <Button
                                            variant="outline"
                                            className="w-full text-blue-700 hover:text-blue-800 hover:bg-blue-50 border-blue-200"
                                            onClick={() => setIsNumberingModalOpen(true)}
                                        >
                                            Ajustar Numeração
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* FINANCE & CERTIFICATES (Unchanged Logic, just simplified render) */}
                    {activeTab === 'finance' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Link href="/app/settings/company/finance/payment-terms" className="block group">
                                <div className="border border-gray-100 rounded-xl p-6 shadow-sm hover:border-brand-200 hover:shadow-md transition-all">
                                    <h3 className="font-semibold text-gray-900">Condições de Pagamento</h3>
                                    <p className="text-sm text-gray-500">Configurar prazos e regras.</p>
                                </div>
                            </Link>
                        </div>
                    )}

                    {activeTab === 'certificates' && selectedCompany && (
                        <CertificatesSection companyId={selectedCompany.id} onMessage={setMessage} />
                    )}

                </CardContent>
            </Card>
        </div>
    );
}
