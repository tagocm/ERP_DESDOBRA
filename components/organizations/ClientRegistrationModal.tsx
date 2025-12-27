
"use client";

import { useState } from "react";
import { useCompany } from "@/contexts/CompanyContext";
import { createClient } from "@/lib/supabaseBrowser";
import { createOrganization, setOrganizationRoles, upsertAddress, upsertPerson } from "@/lib/clients-db";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Card, CardContent } from "@/components/ui/Card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { AddressForm, AddressFormData } from "@/components/forms/AddressForm";
import { ContactsTable, ContactFormData } from "@/components/forms/ContactsTable";
import { extractDigits, formatCNPJ, validateCNPJ } from "@/lib/cnpj";
import { Loader2, Search, CheckCircle2, Save } from "lucide-react";
import { cn } from "@/lib/utils"; // Import cn

interface ClientRegistrationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export function ClientRegistrationModal({ isOpen, onClose, onSuccess }: ClientRegistrationModalProps) {
    const { selectedCompany } = useCompany();
    const supabase = createClient();

    // ... (keep logic same until return)

    // Text Formatting Helpers and State Logic (omitted for brevity, assume implicit if using replace_file_content well, but I need to be careful with replace chunks)

    // Wait, replace_file_content needs EXACT TargetContent.
    // I can't replace the whole file easily if I don't provide the whole content.
    // I need to use MultiReplace or just replace the import and the return statement.
    // Let's use MultiReplace.


    // Text Formatting Helpers
    const toTitleCase = (str: string) => {
        if (!str) return "";
        return str
            .toLowerCase()
            .split(' ')
            .map(word => {
                // Keep short prepositions lowercase if preferred, but user said "toda a primeira letra" (Every first letter)
                // strict adherence:
                return word.charAt(0).toUpperCase() + word.slice(1);
            })
            .join(' ');
    };

    const toLowerCase = (str: string) => {
        if (!str) return "";
        return str.toLowerCase();
    };

    const sanitizeData = () => {
        // Sanitize FormData
        const sanitizedFormData = {
            ...formData,
            legal_name: toTitleCase(formData.legal_name),
            trade_name: toTitleCase(formData.trade_name),
            email: toLowerCase(formData.email)
        };

        // Sanitize Address
        const sanitizedAddress = {
            ...billingAddress,
            street: toTitleCase(billingAddress.street),
            neighborhood: toTitleCase(billingAddress.neighborhood),
            city: toTitleCase(billingAddress.city),
            complement: toTitleCase(billingAddress.complement),
            state: billingAddress.state.toUpperCase(), // UF always upper
            country: billingAddress.country.toUpperCase()
        };

        // Sanitize Commercial
        // Leaving notes as is, user requirement "todos os campos... primeira letra maiuscula" usually implies names/titles.
        // But for strict compliance with "all fields", let's apply it to "names" mainly.
        // Applying to notes would be destructive.
        // Applying to Payment Terms? It's a number/string.
        const sanitizedCommercial = {
            ...commercialData
        };

        // Sanitize Fiscal
        const sanitizedFiscal = {
            ...fiscalData,
            email_nfe: toLowerCase(fiscalData.email_nfe),
            // Suframa and registrations usually strictly numeric or specific format. Leave as is or uppercase?
            // Registrations often have X. Let's UPPERCASE them just in case.
            state_registration: fiscalData.state_registration.toUpperCase(),
            municipal_registration: fiscalData.municipal_registration.toUpperCase(),
            suframa: fiscalData.suframa.toUpperCase()
        };

        // Sanitize Contacts
        const sanitizedContacts = contacts.map(c => ({
            ...c,
            full_name: toTitleCase(c.full_name),
            email: toLowerCase(c.email || ""),
            // Notes leave as is
        }));

        return { sanitizedFormData, sanitizedAddress, sanitizedCommercial, sanitizedFiscal, sanitizedContacts };
    };


    const [activeTab, setActiveTab] = useState("dados");
    const [isLoading, setIsLoading] = useState(false);
    const [cnpjLoading, setCnpjLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [cnpjFetched, setCnpjFetched] = useState(false);

    // Tab 1: Dados
    const [formData, setFormData] = useState({
        document_number: "",
        legal_name: "",
        trade_name: "",
        phone: "",
        email: "",
    });

    const [billingAddress, setBillingAddress] = useState<AddressFormData>({
        zip: "", street: "", number: "", complement: "",
        neighborhood: "", city: "", state: "", country: "BR"
    });

    // Tab 2: Comercial
    const [commercialData, setCommercialData] = useState({
        price_table_id: "",
        default_payment_terms_days: "",
        sales_rep_user_id: "",
        freight_terms: "" as '' | 'cif' | 'fob' | 'retira' | 'combinar',
        notes_commercial: ""
    });

    // Tab 3: Fiscal
    const [fiscalData, setFiscalData] = useState({
        is_simple_national: false,
        is_public_agency: false,
        ie_indicator: "contributor" as 'contributor' | 'exempt' | 'non_contributor',
        state_registration: "",
        municipal_registration: "",
        suframa: "",
        email_nfe: "",
    });

    // Tab 4: Contatos
    const [contacts, setContacts] = useState<ContactFormData[]>([]);

    // Roles
    const [roles, setRoles] = useState({
        prospect: false,
        customer: true,
        supplier: false,
        carrier: false
    });

    const resetForm = () => {
        setFormData({ document_number: "", legal_name: "", trade_name: "", phone: "", email: "" });
        setCommercialData({ price_table_id: "", default_payment_terms_days: "", sales_rep_user_id: "", freight_terms: "", notes_commercial: "" });
        setFiscalData({ is_simple_national: false, is_public_agency: false, ie_indicator: "contributor", state_registration: "", municipal_registration: "", suframa: "", email_nfe: "" });
        setBillingAddress({ zip: "", street: "", number: "", complement: "", neighborhood: "", city: "", state: "", country: "BR" });
        setContacts([]);
        setRoles({ prospect: false, customer: true, supplier: false, carrier: false });
        setCnpjFetched(false);
        setActiveTab("dados");
        setError(null);
        setSuccess(null);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;

        if (name === 'document_number') {
            setFormData(prev => ({ ...prev, [name]: formatCNPJ(value) }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleCommercialChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setCommercialData(prev => ({ ...prev, [name]: value }));
    };

    const handleFiscalChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;

        if (type === 'checkbox') {
            const checked = (e.target as HTMLInputElement).checked;
            setFiscalData(prev => ({ ...prev, [name]: checked }));
        } else {
            setFiscalData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleAddressChange = (field: keyof AddressFormData, value: string) => {
        setBillingAddress(prev => ({ ...prev, [field]: value }));
    };

    const fetchCNPJData = async () => {
        const cnpjDigits = extractDigits(formData.document_number);
        if (cnpjDigits.length !== 14) return;

        setCnpjLoading(true);
        setError(null);
        setSuccess(null);

        try {
            const res = await fetch(`/api/cnpj/${cnpjDigits}`);
            const data = await res.json();

            if (!res.ok) {
                setError(`Não foi possível buscar dados: ${data.error || 'Erro desconhecido'}`);
                return;
            }

            // Auto-fill only empty fields
            setFormData(prev => ({
                ...prev,
                legal_name: prev.legal_name || data.legal_name || "",
                trade_name: prev.trade_name || data.trade_name || "",
                email: prev.email || data.email || "",
                phone: prev.phone || data.phone || "",
            }));

            setFiscalData(prev => ({
                ...prev,
                email_nfe: prev.email_nfe || data.email || "",
            }));

            // Fill billing address
            if (!billingAddress.zip && data.address.zip) {
                setBillingAddress({
                    zip: data.address.zip || "",
                    street: data.address.street || "",
                    number: data.address.number || "",
                    complement: data.address.complement || "",
                    neighborhood: data.address.neighborhood || "",
                    city: data.address.city || "",
                    state: data.address.state || "",
                    country: "BR"
                });
            }

            setCnpjFetched(true);
            setSuccess("Dados preenchidos automaticamente. Revise antes de salvar.");

        } catch (err) {
            console.error("CNPJ Lookup error:", err);
            setError("Erro ao buscar dados do CNPJ.");
        } finally {
            setCnpjLoading(false);
        }
    };

    const handleAddContact = (contact: ContactFormData) => {
        // If setting as primary, remove primary from others
        if (contact.is_primary) {
            setContacts(prev => prev.map(c => ({ ...c, is_primary: false })));
        }
        setContacts(prev => [...prev, contact]);
    };

    const handleEditContact = (id: string, contact: ContactFormData) => {
        // If setting as primary, remove primary from others
        if (contact.is_primary) {
            setContacts(prev => prev.map(c => c.id === id ? contact : { ...c, is_primary: false }));
        } else {
            setContacts(prev => prev.map(c => c.id === id ? contact : c));
        }
    };

    const handleRemoveContact = (id: string) => {
        setContacts(prev => prev.filter(c => c.id !== id));
    };

    const handleSubmit = async (saveAndNew = false) => {
        if (!selectedCompany) return;

        // Sanitize all data before validating or saving
        const { sanitizedFormData, sanitizedAddress, sanitizedCommercial, sanitizedFiscal, sanitizedContacts } = sanitizeData();

        setIsLoading(true);
        setError(null);
        setSuccess(null);

        try {
            // Validate using sanitized data
            if (!sanitizedFormData.trade_name) {
                throw new Error("Nome Fantasia é obrigatório");
            }

            const cleanDoc = extractDigits(sanitizedFormData.document_number);
            if (cleanDoc && !validateCNPJ(sanitizedFormData.document_number) && cleanDoc.length !== 11) {
                if (cleanDoc.length === 14) {
                    throw new Error("CNPJ inválido");
                }
            }

            if (sanitizedFiscal.ie_indicator === 'contributor' && !sanitizedFiscal.state_registration) {
                throw new Error("Inscrição Estadual é obrigatória para contribuintes");
            }

            // 1. Create Organization
            const newOrg = await createOrganization(supabase, {
                company_id: selectedCompany.id,
                trade_name: sanitizedFormData.trade_name,
                legal_name: sanitizedFormData.legal_name || sanitizedFormData.trade_name,
                document_number: cleanDoc || null,
                document_type: cleanDoc?.length === 11 ? 'cpf' : cleanDoc?.length === 14 ? 'cnpj' : null,
                email: sanitizedFormData.email || null,
                phone: sanitizedFormData.phone || null,

                // Fiscal
                state_registration: sanitizedFiscal.state_registration || null,
                municipal_registration: sanitizedFiscal.municipal_registration || null,
                ie_indicator: sanitizedFiscal.ie_indicator,
                suframa: sanitizedFiscal.suframa || null,
                email_nfe: sanitizedFiscal.email_nfe || null,
                is_simple_national: sanitizedFiscal.is_simple_national,
                is_public_agency: sanitizedFiscal.is_public_agency,

                // Commercial
                default_payment_terms_days: sanitizedCommercial.default_payment_terms_days ? parseInt(sanitizedCommercial.default_payment_terms_days) : null,
                freight_terms: sanitizedCommercial.freight_terms || null,
                notes_commercial: sanitizedCommercial.notes_commercial || null,
                price_table_id: sanitizedCommercial.price_table_id || null,
                sales_rep_user_id: sanitizedCommercial.sales_rep_user_id || null,

                country_code: "BR",
                status: "active",
            });

            // 2. Set Roles
            const selectedRoles = Object.entries(roles)
                .filter(([_, checked]) => checked)
                .map(([role]) => role);

            if (selectedRoles.length > 0) {
                await setOrganizationRoles(supabase, selectedCompany.id, newOrg.id, selectedRoles);
            }

            // 3. Create Address
            if (sanitizedAddress.zip || sanitizedAddress.city) {
                await upsertAddress(supabase, {
                    company_id: selectedCompany.id,
                    organization_id: newOrg.id,
                    type: 'billing',
                    ...sanitizedAddress,
                    is_default: true
                });
            }

            // 4. Create Contacts
            for (const contact of sanitizedContacts) {
                await upsertPerson(supabase, {
                    company_id: selectedCompany.id,
                    organization_id: newOrg.id,
                    full_name: contact.full_name,
                    email: contact.email || null,
                    phone: contact.phone || null,
                    notes: contact.notes || null,
                    is_primary: contact.is_primary
                });
            }

            if (saveAndNew) {
                resetForm();
                setSuccess("Cadastro criado com sucesso!");
            } else {
                onSuccess();
                onClose();
            }
        } catch (err: any) {
            console.error(err);
            setError(err.message || "Erro ao criar cadastro.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleClose = () => {
        resetForm();
        onClose();
    };

    // Header action buttons
    const headerActions = (
        <div className="flex items-center gap-2">
            <Button
                type="button"
                variant="secondary"
                onClick={() => handleSubmit(true)}
                disabled={isLoading}
                className="rounded-full px-5 h-8 text-sm"
            >
                {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Salvar e Novo
            </Button>
            <Button
                type="button"
                onClick={() => handleSubmit(false)}
                disabled={isLoading}
                className="rounded-full px-5 h-8 text-sm"
            >
                {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                <Save className="w-4 h-4 mr-2" />
                Salvar
            </Button>
        </div>
    );

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
            <DialogContent className="max-w-[90vw] w-full h-[90vh] p-0 flex flex-col gap-0 bg-white border-none sm:rounded-xl">
                <DialogHeader className="px-6 py-4 border-b flex-shrink-0 bg-gray-50 flex flex-row items-center justify-between space-y-0">
                    <DialogTitle className="text-xl font-bold text-gray-900">Novo Cadastro</DialogTitle>
                    <div className="flex items-center gap-2">
                        {headerActions}
                    </div>
                </DialogHeader>
                <div className="flex-1 overflow-y-auto p-0">
                    {error && (
                        <div className="mx-6 mt-4 p-3 bg-red-50 text-red-700 rounded-lg border border-red-200 text-sm">
                            {error}
                        </div>
                    )}

                    {success && (
                        <div className="mx-6 mt-4 p-3 bg-green-50 text-green-700 rounded-lg border border-green-200 flex items-center gap-2 text-sm">
                            <CheckCircle2 className="w-4 h-4" />
                            {success}
                        </div>
                    )}

                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                        <div className="px-6 border-b">
                            <TabsList className="h-10 mt-2 bg-transparent">
                                <TabsTrigger value="dados" className="data-[state=active]:border-b-2 data-[state=active]:border-brand-600 rounded-none bg-transparent">Dados Gerais</TabsTrigger>
                                <TabsTrigger value="comercial" className="data-[state=active]:border-b-2 data-[state=active]:border-brand-600 rounded-none bg-transparent">Comercial</TabsTrigger>
                                <TabsTrigger value="fiscal" className="data-[state=active]:border-b-2 data-[state=active]:border-brand-600 rounded-none bg-transparent">Fiscal</TabsTrigger>
                                <TabsTrigger value="contatos" className="data-[state=active]:border-b-2 data-[state=active]:border-brand-600 rounded-none bg-transparent">Contatos</TabsTrigger>
                            </TabsList>
                        </div>

                        {/* TAB 1: DADOS */}
                        <TabsContent value="dados" className="p-6 focus-visible:outline-none">
                            <div className="space-y-4">
                                {/* Row 1: CNPJ + Roles */}
                                <div className="grid grid-cols-12 gap-4">
                                    {/* CNPJ (3 cols) */}
                                    <div className="col-span-12 md:col-span-4 lg:col-span-3 space-y-1">
                                        <label className="text-xs font-semibold text-gray-700">CNPJ / CPF *</label>
                                        <div className="flex gap-2">
                                            <Input
                                                name="document_number"
                                                value={formData.document_number}
                                                onChange={handleChange}
                                                placeholder="00.000.000/0000-00"
                                                maxLength={18}
                                                className="h-9 text-sm"
                                            />
                                            <Button
                                                type="button"
                                                variant="secondary"
                                                onClick={fetchCNPJData}
                                                className="px-2 shrink-0 h-9"
                                                disabled={cnpjLoading || extractDigits(formData.document_number).length !== 14}
                                                title="Buscar CNPJ"
                                            >
                                                {cnpjLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Roles (9 cols) */}
                                    <div className="col-span-12 md:col-span-8 lg:col-span-9 space-y-1">
                                        <label className="text-xs font-semibold text-gray-700">Papéis</label>
                                        <div className="flex flex-wrap gap-2">
                                            {Object.entries(roles).map(([role, checked]) => (
                                                <label key={role} className="flex items-center gap-1.5 cursor-pointer bg-gray-50 px-2 py-1 rounded border border-gray-100 hover:bg-gray-100 transition-colors">
                                                    <input
                                                        type="checkbox"
                                                        checked={checked}
                                                        onChange={(e) => setRoles(prev => ({ ...prev, [role]: e.target.checked }))}
                                                        className="w-3.5 h-3.5 text-brand-600 rounded focus:ring-brand-500"
                                                    />
                                                    <span className="text-xs text-gray-700">{
                                                        role === 'prospect' ? 'Prospect' :
                                                            role === 'customer' ? 'Cliente' :
                                                                role === 'supplier' ? 'Fornecedor' :
                                                                    'Transportadora'
                                                    }</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Row 2: Identity + Email */}
                                <div className="grid grid-cols-12 gap-4">
                                    <div className="col-span-12 md:col-span-4 space-y-1">
                                        <label className="text-xs font-semibold text-gray-700">Nome Fantasia *</label>
                                        <Input
                                            name="trade_name"
                                            value={formData.trade_name}
                                            onChange={handleChange}
                                            required
                                            placeholder="Ex: Loja do João"
                                            className="h-9 text-sm"
                                        />
                                    </div>
                                    <div className="col-span-12 md:col-span-4 space-y-1">
                                        <label className="text-xs font-semibold text-gray-700">Razão Social</label>
                                        <Input
                                            name="legal_name"
                                            value={formData.legal_name}
                                            onChange={handleChange}
                                            placeholder="Ex: João Silva ME"
                                            className="h-9 text-sm"
                                        />
                                    </div>
                                    <div className="col-span-12 md:col-span-4 space-y-1">
                                        <label className="text-xs font-semibold text-gray-700">Email</label>
                                        <Input
                                            type="email"
                                            name="email"
                                            value={formData.email}
                                            onChange={handleChange}
                                            placeholder="contato@empresa.com.br"
                                            className="h-9 text-sm"
                                        />
                                    </div>
                                </div>

                                {/* Row 3: Phone + Address Line 1 */}
                                <div className="grid grid-cols-12 gap-4">
                                    <div className="col-span-12 md:col-span-3 space-y-1">
                                        <label className="text-xs font-semibold text-gray-700">Telefone</label>
                                        <Input
                                            name="phone"
                                            value={formData.phone}
                                            onChange={handleChange}
                                            placeholder="(00) 00000-0000"
                                            className="h-9 text-sm"
                                        />
                                    </div>
                                    <div className="col-span-12 md:col-span-2 space-y-1">
                                        <label className="text-xs font-semibold text-gray-700">CEP</label>
                                        <Input
                                            value={billingAddress.zip}
                                            onChange={(e) => handleAddressChange('zip', e.target.value)}
                                            placeholder="00000-000"
                                            className="h-9 text-sm"
                                        />
                                    </div>
                                    <div className="col-span-12 md:col-span-5 space-y-1">
                                        <label className="text-xs font-semibold text-gray-700">Logradouro</label>
                                        <Input
                                            value={billingAddress.street}
                                            onChange={(e) => handleAddressChange('street', e.target.value)}
                                            placeholder="Rua, Av..."
                                            className="h-9 text-sm"
                                        />
                                    </div>
                                    <div className="col-span-12 md:col-span-2 space-y-1">
                                        <label className="text-xs font-semibold text-gray-700">Número</label>
                                        <Input
                                            value={billingAddress.number}
                                            onChange={(e) => handleAddressChange('number', e.target.value)}
                                            className="h-9 text-sm"
                                        />
                                    </div>
                                </div>

                                {/* Row 4: Address Line 2 */}
                                <div className="grid grid-cols-12 gap-4">
                                    <div className="col-span-12 md:col-span-3 space-y-1">
                                        <label className="text-xs font-semibold text-gray-700">Complemento</label>
                                        <Input
                                            value={billingAddress.complement}
                                            onChange={(e) => handleAddressChange('complement', e.target.value)}
                                            placeholder="Apto, Sala..."
                                            className="h-9 text-sm"
                                        />
                                    </div>
                                    <div className="col-span-12 md:col-span-3 space-y-1">
                                        <label className="text-xs font-semibold text-gray-700">Bairro</label>
                                        <Input
                                            value={billingAddress.neighborhood}
                                            onChange={(e) => handleAddressChange('neighborhood', e.target.value)}
                                            className="h-9 text-sm"
                                        />
                                    </div>
                                    <div className="col-span-12 md:col-span-4 space-y-1">
                                        <label className="text-xs font-semibold text-gray-700">Cidade</label>
                                        <Input
                                            value={billingAddress.city}
                                            onChange={(e) => handleAddressChange('city', e.target.value)}
                                            className="h-9 text-sm"
                                        />
                                    </div>
                                    <div className="col-span-12 md:col-span-2 space-y-1">
                                        <label className="text-xs font-semibold text-gray-700">UF</label>
                                        <Input
                                            value={billingAddress.state}
                                            onChange={(e) => handleAddressChange('state', e.target.value)}
                                            maxLength={2}
                                            className="h-9 text-sm"
                                        />
                                    </div>
                                </div>

                                {cnpjFetched && (
                                    <div className="flex items-center gap-2 text-xs text-blue-600 bg-blue-50 p-2 rounded border border-blue-100">
                                        <CheckCircle2 className="w-3 h-3" />
                                        <span>Dados importados automaticamente da Receita Federal.</span>
                                    </div>
                                )}
                            </div>
                        </TabsContent>

                        {/* TAB 2: COMERCIAL - Compacted */}
                        <TabsContent value="comercial" className="p-6 focus-visible:outline-none">
                            <div className="space-y-4">
                                <div className="grid grid-cols-12 gap-4">
                                    <div className="col-span-12 md:col-span-4 space-y-1">
                                        <label className="text-xs font-semibold text-gray-700">Tabela de Preço</label>
                                        <Select
                                            name="price_table_id"
                                            value={commercialData.price_table_id}
                                            onChange={handleCommercialChange}
                                            className="h-9 text-sm"
                                        >
                                            <option value="">Padrão</option>
                                        </Select>
                                    </div>

                                    <div className="col-span-12 md:col-span-4 space-y-1">
                                        <label className="text-xs font-semibold text-gray-700">Prazo Padrão (dias)</label>
                                        <Input
                                            name="default_payment_terms_days"
                                            type="number"
                                            value={commercialData.default_payment_terms_days}
                                            onChange={handleCommercialChange}
                                            placeholder="Ex: 30"
                                            className="h-9 text-sm"
                                        />
                                    </div>

                                    <div className="col-span-12 md:col-span-4 space-y-1">
                                        <label className="text-xs font-semibold text-gray-700">Frete</label>
                                        <Select
                                            name="freight_terms"
                                            value={commercialData.freight_terms}
                                            onChange={handleCommercialChange}
                                            className="h-9 text-sm"
                                        >
                                            <option value="">Selecione...</option>
                                            <option value="cif">CIF (vendedor paga)</option>
                                            <option value="fob">FOB (comprador paga)</option>
                                            <option value="retira">Retira</option>
                                            <option value="combinar">A Combinar</option>
                                        </Select>
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-gray-700">Representante</label>
                                    <Select
                                        name="sales_rep_user_id"
                                        value={commercialData.sales_rep_user_id}
                                        onChange={handleCommercialChange}
                                        className="h-9 text-sm"
                                    >
                                        <option value="">Selecione um representante...</option>
                                    </Select>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-gray-700">Observações Comerciais</label>
                                    <textarea
                                        name="notes_commercial"
                                        value={commercialData.notes_commercial}
                                        onChange={handleCommercialChange}
                                        rows={3}
                                        className="flex w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm ring-offset-background placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 transition-all shadow-sm"
                                        placeholder="Condições especiais, descontos, etc."
                                    />
                                </div>
                            </div>
                        </TabsContent>

                        {/* TAB 3: FISCAL - Compacted */}
                        <TabsContent value="fiscal" className="p-6 focus-visible:outline-none">
                            <div className="space-y-4">
                                <div className="flex gap-6 p-3 bg-gray-50 border border-gray-100 rounded-lg">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            name="is_simple_national"
                                            checked={fiscalData.is_simple_national}
                                            onChange={handleFiscalChange}
                                            className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500"
                                        />
                                        <span className="text-sm font-medium">Simples Nacional</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            name="is_public_agency"
                                            checked={fiscalData.is_public_agency}
                                            onChange={handleFiscalChange}
                                            className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500"
                                        />
                                        <span className="text-sm font-medium">Órgão Público</span>
                                    </label>
                                </div>

                                <div className="grid grid-cols-12 gap-4">
                                    <div className="col-span-12 md:col-span-4 space-y-1">
                                        <label className="text-xs font-semibold text-gray-700">Indicador IE</label>
                                        <Select
                                            name="ie_indicator"
                                            value={fiscalData.ie_indicator}
                                            onChange={handleFiscalChange}
                                            className="h-9 text-sm"
                                        >
                                            <option value="contributor">Contribuinte</option>
                                            <option value="exempt">Isento</option>
                                            <option value="non_contributor">Não contribuinte</option>
                                        </Select>
                                    </div>
                                    <div className="col-span-12 md:col-span-4 space-y-1">
                                        <label className="text-xs font-semibold text-gray-700">Inscrição Estadual</label>
                                        <Input
                                            name="state_registration"
                                            value={fiscalData.state_registration}
                                            onChange={handleFiscalChange}
                                            disabled={fiscalData.ie_indicator === 'non_contributor'}
                                            className="h-9 text-sm"
                                        />
                                    </div>
                                    <div className="col-span-12 md:col-span-4 space-y-1">
                                        <label className="text-xs font-semibold text-gray-700">Inscrição Municipal</label>
                                        <Input
                                            name="municipal_registration"
                                            value={fiscalData.municipal_registration}
                                            onChange={handleFiscalChange}
                                            className="h-9 text-sm"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-12 gap-4">
                                    <div className="col-span-12 md:col-span-4 space-y-1">
                                        <label className="text-xs font-semibold text-gray-700">SUFRAMA</label>
                                        <Input
                                            name="suframa"
                                            value={fiscalData.suframa}
                                            onChange={handleFiscalChange}
                                            className="h-9 text-sm"
                                        />
                                    </div>
                                    <div className="col-span-12 md:col-span-8 space-y-1">
                                        <label className="text-xs font-semibold text-gray-700">Email NF-e</label>
                                        <Input
                                            type="email"
                                            name="email_nfe"
                                            value={fiscalData.email_nfe}
                                            onChange={handleFiscalChange}
                                            placeholder="email@financas.com"
                                            className="h-9 text-sm"
                                        />
                                    </div>
                                </div>
                            </div>
                        </TabsContent>

                        {/* TAB 4: CONTATOS */}
                        <TabsContent value="contatos" className="p-6 focus-visible:outline-none">
                            <ContactsTable
                                contacts={contacts}
                                onAdd={handleAddContact}
                                onEdit={handleEditContact}
                                onRemove={handleRemoveContact}
                            />
                        </TabsContent>
                    </Tabs>
                </div>
            </DialogContent>
        </Dialog>
    );
}
