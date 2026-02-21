
"use client";


import { useState, useEffect } from "react";
import { useCompany } from "@/contexts/CompanyContext";
import { createClient } from "@/lib/supabaseBrowser";
import { Button } from "@/components/ui/Button";
import { Tabs, TabsContent } from "@/components/ui/Tabs";
import { TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Save, Undo } from "lucide-react";
import { CompanySettings } from "@/lib/types/settings-types"; // Type
import {
    getCompanySettingsAction,
    updateCompanySettingsAction,
    updateCompanyNameAction
} from "@/app/actions/settings/company-settings-actions";
import { PageHeader } from "@/components/ui/PageHeader";
import { FormTabsList, FormTabsTrigger } from "@/components/ui/FormTabs";

import { TabIdentification } from "./TabIdentification";
import { TabBranches } from "./TabBranches";
import { TabFiscal } from "./TabFiscal";
import { TabCertificate } from "./TabCertificate";
import { TabFinancial } from "./TabFinancial";
import { ReauthModal } from "./ReauthModal";
import { normalizeOptionalUrl } from "@/lib/normalize-optional-url";

export function CompanySettingsForm() {
    const { selectedCompany, user } = useCompany();
    const supabase = createClient();
    const { toast } = useToast();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [settings, setSettings] = useState<Partial<CompanySettings>>({});
    const [isAdmin, setIsAdmin] = useState(false);
    const [activeTab, setActiveTab] = useState("identification");

    // Reauth State
    const [showReauth, setShowReauth] = useState(false);

    // Fetch Data
    useEffect(() => {
        if (!selectedCompany || !user) {
            return;
        }

        const load = async () => {
            setLoading(true);

            try {
                // Check Role: Use maybeSingle to avoid errors on empty result
                const { data: member, error: roleError } = await supabase
                    .from('company_members')
                    .select('role')
                    .eq('company_id', selectedCompany.id)
                    .eq('auth_user_id', user.id)
                    .maybeSingle();

                if (roleError) console.error("Error fetching role:", roleError);

                const admin = member?.role === 'owner' || member?.role === 'admin';
                setIsAdmin(admin);

                // Load Settings
                const res = await getCompanySettingsAction(selectedCompany.id);
                if (!res.success) throw new Error(res.error);

                const data = res.data;

                setSettings({
                    ...(data || { company_id: selectedCompany.id }),
                    logo_path: normalizeOptionalUrl(data?.logo_path),
                    nfe_series: data?.nfe_series || "1" // Default to 1
                });

            } catch (err: any) {
                console.error("Critical Error in load:", err);
                toast({
                    title: "Erro ao carregar dados",
                    description: "Não foi possível carregar as configurações da empresa.",
                    variant: "destructive"
                });
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [selectedCompany, user]); // Removed unstable dependencies to prevent infinite loop

    const handleChange = (field: keyof CompanySettings, value: any) => {
        setSettings(prev => ({ ...prev, [field]: value }));
    };

    const handleSaveClick = () => {
        if (!isAdmin) return;
        setShowReauth(true);
    };

    const validateSettings = () => {
        if (!settings.cnpj || settings.cnpj.length < 14) {
            setActiveTab("identification");
            return "CNPJ inválido ou incompleto.";
        }
        // Identification
        if (!settings.legal_name) {
            setActiveTab("identification");
            return "Razão Social é obrigatória.";
        }
        if (!settings.trade_name) {
            setActiveTab("identification");
            return "Nome Fantasia é obrigatório.";
        }

        // Fiscal
        if (!settings.tax_regime) {
            setActiveTab("fiscal");
            return "Regime Tributário é obrigatório.";
        }
        if (!settings.nfe_series) {
            setActiveTab("fiscal");
            return "Série da NF-e é obrigatória.";
        }
        if (!settings.city_code_ibge) {
            setActiveTab("identification"); // Actually in Address (Identification/Address are usually same or Address tab?)
            // In CompanySettingsForm, Address is NOT a separate tab in one version? 
            // Wait, let's check tabs list: identification, branches, fiscal, certificate, financial.
            // Address is inside "identification" (judging by TabIdentification content from previous turns).
            // Let's check TabIdentification again. Yes, Address Section is in TabIdentification.
            return "Código IBGE do município é obrigatório (verifique o endereço).";
        }

        // Address (Inside Identification)
        if (!settings.address_zip) { setActiveTab("identification"); return "CEP é obrigatório."; }
        if (!settings.address_street) { setActiveTab("identification"); return "Logradouro é obrigatório."; }
        if (!settings.address_number) { setActiveTab("identification"); return "Número do endereço é obrigatório."; }
        if (!settings.address_neighborhood) { setActiveTab("identification"); return "Bairro é obrigatório."; }
        if (!settings.address_city) { setActiveTab("identification"); return "Cidade é obrigatória."; }
        if (!settings.address_state) { setActiveTab("identification"); return "UF é obrigatória."; }

        return null; // Valid
    };

    const handleConfirmSave = async () => {
        if (!selectedCompany) return;
        setSaving(true);

        try {
            // Validation
            const error = validateSettings();
            if (error) {
                toast({
                    title: "Atenção",
                    description: error,
                    variant: "destructive"
                });
                return; // Return triggers finally -> setLoading(false)
            }

            // Save Settings
            // Map settings to action schema if needed, but action currently matches CompanySettings Partial
            // except we need to be careful with nulls vs undefined if Zod is strict
            // The action takes Partial<CompanySettings>, Zod schema validation happens inside.

            const res = await updateCompanySettingsAction(settings, selectedCompany.id);
            if (!res.success) throw new Error(res.error);

            // Update Company Name (Secondary, non-blocking)
            if (settings.trade_name) {
                try {
                    await updateCompanyNameAction(settings.trade_name, selectedCompany.id);
                } catch (nameErr) {
                    console.warn("Failed to update company name in 'companies' table:", nameErr);
                    // Do not block the user if this fails
                }
            }

            toast({
                title: "Sucesso!",
                description: "Configurações salvas com sucesso.",
            });

        } catch (err: any) {
            console.error("Save Error:", err);
            // Try to extract more info if available
            const errorMessage = err.message || (typeof err === 'object' ? JSON.stringify(err) : String(err));

            toast({
                title: "Erro ao salvar",
                description: errorMessage || "Ocorreu um erro desconhecido ao salvar.",
                variant: "destructive"
            });
            throw err; // Re-throw so ReauthModal knows it failed
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-gray-300" /></div>;
    }

    return (
        <div>
            <PageHeader
                title="Configurações da Empresa"
                subtitle="Gerencie os dados da sua organização."
                actions={
                    <div className="flex gap-2">
                        <Button variant="secondary" disabled={saving || !isAdmin} onClick={() => window.location.reload()}>
                            Cancelar
                        </Button>
                        <Button onClick={handleSaveClick} disabled={saving || !isAdmin}>
                            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                            Salvar
                        </Button>
                    </div>
                }
            >
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <FormTabsList className="px-0 border-b-0">
                        <FormTabsTrigger value="identification">Identificação</FormTabsTrigger>
                        {/* Logo tab removed - integrated into Identification */}
                        <FormTabsTrigger value="branches">Filiais</FormTabsTrigger>
                        <FormTabsTrigger value="fiscal">Fiscal</FormTabsTrigger>
                        <FormTabsTrigger value="certificate">Certificado A1</FormTabsTrigger>
                        <FormTabsTrigger value="financial">Financeiro</FormTabsTrigger>
                    </FormTabsList>
                </Tabs>
            </PageHeader>

            <div className="max-w-screen-2xl mx-auto pb-20 px-6 mt-6">
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsContent value="identification" className="mt-0 focus-visible:outline-none">
                        <TabIdentification data={settings} onChange={handleChange} isAdmin={isAdmin} />
                    </TabsContent>

                    {/* Logo content removed */}

                    <TabsContent value="branches" className="mt-0 focus-visible:outline-none">
                        <TabBranches isAdmin={isAdmin} />
                    </TabsContent>

                    <TabsContent value="fiscal" className="mt-0 focus-visible:outline-none">
                        <TabFiscal data={settings} onChange={handleChange} isAdmin={isAdmin} />
                    </TabsContent>

                    <TabsContent value="certificate" className="mt-0 focus-visible:outline-none">
                        <TabCertificate data={settings} onChange={handleChange} isAdmin={isAdmin} />
                    </TabsContent>

                    <TabsContent value="financial" className="mt-0 focus-visible:outline-none">
                        <TabFinancial data={settings} onChange={handleChange} isAdmin={isAdmin} />
                    </TabsContent>
                </Tabs>
            </div>

            <ReauthModal
                isOpen={showReauth}
                onClose={() => setShowReauth(false)}
                onConfirm={handleConfirmSave}
            />

        </div>
    );
}
