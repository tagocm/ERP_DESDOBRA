
"use client";

import { useState, useEffect } from "react";
import { useCompany } from "@/contexts/CompanyContext";
import { createClient } from "@/lib/supabaseBrowser";
import { Button } from "@/components/ui/Button";
import { Tabs, TabsContent } from "@/components/ui/Tabs";
import { TabsList, TabsTrigger } from "@/components/ui/Tabs"; // Fallback if FormTabs not found or prefer keeping basic Tabs with custom style
import { Alert } from "@/components/ui/Alert";
import { Loader2, Save, Undo } from "lucide-react";
import { CompanySettings, getCompanySettings, updateCompanySettings, updateCompanyName } from "@/lib/data/company-settings";
import { PageHeader } from "@/components/ui/PageHeader";
import { FormTabsList, FormTabsTrigger } from "@/components/ui/FormTabs";

import { TabIdentification } from "./TabIdentification";
import { TabBranches } from "./TabBranches";
import { TabFiscal } from "./TabFiscal";
import { TabCertificate } from "./TabCertificate";
import { TabFinancial } from "./TabFinancial";
// TabLogo removed
import { ReauthModal } from "./ReauthModal";

export function CompanySettingsForm() {
    const { selectedCompany, user } = useCompany();
    const supabase = createClient();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [settings, setSettings] = useState<Partial<CompanySettings>>({});
    const [isAdmin, setIsAdmin] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState("identification");

    // Reauth State
    const [showReauth, setShowReauth] = useState(false);

    // Fetch Data
    useEffect(() => {
        if (!selectedCompany || !user) return;

        const load = async () => {
            setLoading(true);
            try {
                // Check Role
                const { data: member } = await supabase
                    .from('company_members')
                    .select('role')
                    .eq('company_id', selectedCompany.id)
                    .eq('auth_user_id', user.id)
                    .single();

                const admin = member?.role === 'owner' || member?.role === 'admin';
                setIsAdmin(admin);

                // Load Settings
                const data = await getCompanySettings(supabase, selectedCompany.id);
                setSettings(data || { company_id: selectedCompany.id });

            } catch (err: any) {
                console.error(err);
                setError("Erro ao carregar configurações.");
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [selectedCompany, user]);

    const handleChange = (field: keyof CompanySettings, value: any) => {
        setSettings(prev => ({ ...prev, [field]: value }));
    };

    const handleSaveClick = () => {
        if (!isAdmin) return;
        setShowReauth(true);
    };

    const handleConfirmSave = async () => {
        if (!selectedCompany) return;
        setSaving(true);
        setError(null);
        setSuccess(null);

        try {
            // Validation
            if (!settings.cnpj) throw new Error("CNPJ é obrigatório.");
            if (!settings.trade_name) throw new Error("Nome Fantasia é obrigatório.");
            // Address validation
            if (!settings.address_zip || !settings.address_street || !settings.address_number || !settings.address_neighborhood || !settings.address_city || !settings.address_state) {
                throw new Error("Endereço Fiscal completo é obrigatório.");
            }

            // Save Settings
            await updateCompanySettings(supabase, selectedCompany.id, settings);

            // Update Company Name in parent table if trade_name changed
            if (settings.trade_name) {
                await updateCompanyName(supabase, selectedCompany.id, settings.trade_name);
            }

            setSuccess("Configurações salvas com sucesso!");
            setTimeout(() => setSuccess(null), 3000);

        } catch (err: any) {
            console.error(err);
            setError(err.message || "Erro ao salvar alterações.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-gray-300" /></div>;
    }

    return (
        <div>
            {error && <Alert variant="destructive" className="mb-4">{error}</Alert>}
            {success && <Alert variant="success" className="mb-4">{success}</Alert>}

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

            <div className="max-w-[1600px] mx-auto pb-20 px-6 mt-6">
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
