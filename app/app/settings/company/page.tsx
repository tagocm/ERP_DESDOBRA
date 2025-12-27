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
import { cn } from "@/lib/utils";
import { formatCNPJ, validateCNPJ, extractDigits } from "@/lib/cnpj";
import Link from "next/link";
import { Loader2, Search, CreditCard, ArrowRight, Building2 } from "lucide-react";
import { CertificatesSection } from "@/components/settings/CertificatesSection";
import { CompanyLogo } from "@/components/settings/CompanyLogo";

// Tabs Component (Inline for simplicity)
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
    const { selectedCompany, isLoading: isContextLoading } = useCompany();
    const supabase = createClient();

    const searchParams = useSearchParams();
    const isNew = searchParams.get("new") === "true";

    const [activeTab, setActiveTab] = useState("identification");
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'warning' | 'error', text: string } | null>(null);

    const [originalData, setOriginalData] = useState<any>(null); // To track dirty state

    // CNPJ Lookup State
    const [cnpjLoading, setCnpjLoading] = useState(false);

    // Form State (Single object for simplicity)
    const [formData, setFormData] = useState<any>({
        // Identification
        legal_name: "",
        trade_name: "",
        cnpj: "",
        ie: "",
        im: "",
        cnae: "",
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
        // Fiscal
        tax_regime: "",
        // NFe
        nfe_environment: "homologation",
        nfe_series: "",
        nfe_next_number: 1
    });

    // Check if form is dirty
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

                if (error && error.code !== "PGRST116") { // Ignore 'Not found'
                    console.error("Error fetching settings:", error);
                }

                let initialData;
                if (data) {
                    initialData = data;
                } else {
                    // Create defaults
                    initialData = {
                        ...formData, // Keep default structure
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

    const handleSave = async () => {
        setMessage(null);

        if (!selectedCompany) return;

        setIsSaving(true);

        try {
            // Basic validation
            if (formData.cnpj && !validateCNPJ(formData.cnpj)) {
                throw new Error("CNPJ inválido.");
            }

            const dataToSave = {
                company_id: selectedCompany.id,
                ...formData,
                cnpj: extractDigits(formData.cnpj || ""), // Save digits only
                updated_at: new Date().toISOString()
            };

            const { error } = await supabase
                .from("company_settings")
                .upsert(dataToSave);

            if (error) throw error;

            setOriginalData(formData); // Update original data to current
            setMessage({ type: 'success', text: 'Configurações salvas com sucesso!' });

        } catch (err: any) {
            console.error(err);
            setMessage({ type: 'error', text: 'Erro ao salvar: ' + err.message });
        } finally {
            setIsSaving(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;

        if (name === 'cnpj') {
            // Apply mask
            setFormData((prev: any) => ({ ...prev, [name]: formatCNPJ(value) }));
        } else {
            setFormData((prev: any) => ({ ...prev, [name]: value }));
        }
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
                // Warning only, don't block
                setMessage({ type: 'warning', text: `Aviso: não foi possível buscar dados automáticos (${data.error || 'Desconhecido'}).` });
                return;
            }

            // Auto-fill Logic: Only overwrite empty fields
            setFormData((prev: any) => {
                const next = { ...prev };

                if (!next.legal_name) next.legal_name = data.legal_name;
                if (!next.trade_name) next.trade_name = data.trade_name;

                // Contact
                if (!next.email && data.email) next.email = data.email;
                if (!next.phone && data.phone) next.phone = data.phone;

                // Address
                if (!next.address_zip && data.address.zip) next.address_zip = data.address.zip;
                if (!next.address_street && data.address.street) next.address_street = data.address.street;
                if (!next.address_number && data.address.number) next.address_number = data.address.number;
                if (!next.address_complement && data.address.complement) next.address_complement = data.address.complement;
                if (!next.address_neighborhood && data.address.neighborhood) next.address_neighborhood = data.address.neighborhood;
                if (!next.address_city && data.address.city) next.address_city = data.address.city;
                if (!next.address_state && data.address.state) next.address_state = data.address.state;

                // CNAE
                if (!next.cnae && data.cnae) next.cnae = data.cnae;

                return next;
            });

            setMessage({ type: 'success', text: 'Dados preenchidos automaticamente. Revise antes de salvar.' });

        } catch (err) {
            console.error("CNPJ Lookup error:", err);
            // Non-blocking error
        } finally {
            setCnpjLoading(false);
        }
    };


    // Note: handleSave is stable (recreated every render technically if not useCallback-ed, but here it depends on formData, selectedCompany)
    // To be perfectly safe, we'd wrap handleSave in useCallback or accept that header updates on every render (which is fine, React handles it).
    // Actually handleSave dependencies: formData, selectedCompany. So it changes often.
    // That's fine.

    if (isContextLoading) return <div className="p-8">Carregando contexto...</div>;
    if (!selectedCompany) return <div className="p-8">Selecione uma empresa para configurar.</div>;
    if (isLoading) return <div className="p-8">Carregando configurações...</div>;

    return (
        <div className="max-w-6xl mx-auto py-8">
            {message && (
                <div className={cn(
                    "p-4 mb-4 rounded-md",
                    message.type === 'success' && "bg-green-50 text-green-700",
                    message.type === 'error' && "bg-red-50 text-red-700",
                    message.type === 'warning' && "bg-yellow-50 text-yellow-700"
                )}>
                    {message.text}
                </div>
            )}

            <PageHeader
                title="Configurações da Sua Empresa"
                subtitle="Dados da empresa que opera este sistema (tenant)"
                actions={
                    <div className="flex items-center gap-2">
                        {isNew && <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded mr-2">Nova Empresa</span>}

                        <Button
                            onClick={handleSave}
                            disabled={!isDirty || isSaving}
                            variant={isDirty ? "primary" : "secondary"}
                            className={cn(
                                "min-w-[100px] transition-all",
                                !isDirty && "text-gray-500 border-gray-200 bg-gray-50 opacity-100"
                            )}
                        >
                            {isSaving ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Salvando...
                                </>
                            ) : isDirty ? (
                                "Salvar"
                            ) : (
                                "Salvo"
                            )}
                        </Button>
                    </div>
                }
            />

            <Tabs
                activeTab={activeTab}
                onTabChange={setActiveTab}
                tabs={[
                    { id: 'identification', label: 'Identificação' },
                    { id: 'address', label: 'Endereço' },
                    { id: 'fiscal', label: 'Fiscal & NF-e' },
                    { id: 'finance', label: 'Financeiro' },
                    { id: 'certificates', label: 'Certificados' },
                ]}
            />

            <div>
                <Card>
                    <CardHeader>
                        <CardTitle>
                            <div className="flex items-center gap-2">
                                <Building2 className="w-4 h-4 text-gray-500" />
                                {activeTab === 'identification' && "Identificação da Empresa"}
                                {activeTab === 'address' && "Endereço"}
                                {activeTab === 'fiscal' && "Configuração Fiscal (NF-e)"}
                                {activeTab === 'finance' && "Configurações Financeiras"}
                                {activeTab === 'certificates' && "Certificado Digital"}
                            </div>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">

                        {/* IDENTIFICATION TAB */}
                        {activeTab === 'identification' && (
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                {/* Left Column: Fields */}
                                <div className="lg:col-span-2 space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">CNPJ</label>
                                        <div className="flex gap-2">
                                            <Input
                                                name="cnpj"
                                                value={formData.cnpj || ''}
                                                onChange={handleChange}
                                                onBlur={handleCNPJBlur}
                                                placeholder="00.000.000/0000-00"
                                                maxLength={18}
                                            />
                                            <Button
                                                type="button"
                                                variant="secondary"
                                                onClick={fetchCNPJData}
                                                className="px-3"
                                                disabled={cnpjLoading}
                                                title="Buscar dados na Receita"
                                            >
                                                {cnpjLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                                            </Button>
                                        </div>
                                        <p className="text-xs text-gray-500">Digite para buscar os dados automaticamente.</p>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Razão Social</label>
                                            <Input name="legal_name" value={formData.legal_name || ''} onChange={handleChange} placeholder="Razão Social Ltda" />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Nome Fantasia</label>
                                            <Input name="trade_name" value={formData.trade_name || ''} onChange={handleChange} placeholder="Minha Empresa" />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Inscrição Estadual</label>
                                            <Input name="ie" value={formData.ie || ''} onChange={handleChange} />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Inscrição Municipal</label>
                                            <Input name="im" value={formData.im || ''} onChange={handleChange} />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">CNAE Principal</label>
                                        <Input name="cnae" value={formData.cnae || ''} onChange={handleChange} />
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Email Comercial</label>
                                            <Input type="email" name="email" value={formData.email || ''} onChange={handleChange} />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Telefone</label>
                                            <Input name="phone" value={formData.phone || ''} onChange={handleChange} />
                                        </div>
                                    </div>
                                </div>

                                {/* Right Column: Logo */}
                                <div className="lg:col-span-1">
                                    <CompanyLogo
                                        companyId={selectedCompany.id}
                                        onMessage={setMessage}
                                    />
                                </div>
                            </div>
                        )}

                        {/* ADDRESS TAB */}
                        {activeTab === 'address' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">CEP</label>
                                    <Input name="address_zip" value={formData.address_zip || ''} onChange={handleChange} />
                                </div>
                                <div className="space-y-2 md:col-span-2">
                                    <label className="text-sm font-medium">Logradouro</label>
                                    <Input name="address_street" value={formData.address_street || ''} onChange={handleChange} />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Número</label>
                                    <Input name="address_number" value={formData.address_number || ''} onChange={handleChange} />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Complemento</label>
                                    <Input name="address_complement" value={formData.address_complement || ''} onChange={handleChange} />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Bairro</label>
                                    <Input name="address_neighborhood" value={formData.address_neighborhood || ''} onChange={handleChange} />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Cidade</label>
                                    <Input name="address_city" value={formData.address_city || ''} onChange={handleChange} />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Estado (UF)</label>
                                    <Input name="address_state" value={formData.address_state || ''} onChange={handleChange} maxLength={2} />
                                </div>
                            </div>
                        )}

                        {/* FISCAL TAB */}
                        {activeTab === 'fiscal' && (
                            <div className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Regime Tributário</label>
                                        <Select
                                            name="tax_regime"
                                            value={formData.tax_regime || ''}
                                            onChange={handleChange}
                                        >
                                            <option value="">Selecione...</option>
                                            <option value="simples_nacional">Simples Nacional</option>
                                            <option value="lucro_presumido">Lucro Presumido</option>
                                            <option value="lucro_real">Lucro Real</option>
                                        </Select>
                                    </div>
                                </div>

                                <div className="border-t pt-4">
                                    <h3 className="font-semibold mb-4 text-gray-900">Configuração NF-e</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Ambiente</label>
                                            <Select
                                                name="nfe_environment"
                                                value={formData.nfe_environment || 'homologation'}
                                                onChange={handleChange}
                                            >
                                                <option value="homologation">Homologação (Teste)</option>
                                                <option value="production">Produção</option>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Série</label>
                                            <Input name="nfe_series" value={formData.nfe_series || ''} onChange={handleChange} placeholder="1" />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Próximo Número</label>
                                            <Input name="nfe_next_number" type="number" value={formData.nfe_next_number || ''} onChange={handleChange} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* FINANCE TAB */}
                        {activeTab === 'finance' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Link href="/app/settings/company/finance/payment-terms" className="block group">
                                    <div className="border border-gray-100 rounded-xl p-6 shadow-sm hover:border-brand-200 hover:shadow-md transition-all cursor-pointer bg-white relative overflow-hidden">
                                        <div className="flex items-start justify-between mb-4">
                                            <div className="h-10 w-10 flex items-center justify-center rounded-lg bg-brand-50 text-brand-600 group-hover:scale-110 transition-transform duration-300">
                                                <CreditCard className="w-5 h-5" />
                                            </div>
                                            <div className="p-1.5 rounded-full bg-gray-50 text-gray-400 group-hover:bg-brand-500 group-hover:text-white transition-all">
                                                <ArrowRight className="w-4 h-4" />
                                            </div>
                                        </div>
                                        <h3 className="font-semibold text-gray-900 mb-1">Condições de Pagamento</h3>
                                        <p className="text-sm text-gray-500 line-clamp-2">Configure os prazos, parcelamentos e regras de vencimento disponíveis para vendas.</p>
                                    </div>
                                </Link>
                            </div>
                        )}

                        {/* CERTIFICATES TAB */}
                        {activeTab === 'certificates' && selectedCompany && (
                            <CertificatesSection
                                companyId={selectedCompany.id}
                                onMessage={setMessage}
                            />
                        )}

                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
