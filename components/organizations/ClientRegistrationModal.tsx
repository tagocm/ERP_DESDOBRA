
"use client";

import { useState, useEffect } from "react";
import { useCompany } from "@/contexts/CompanyContext";
import { createClient } from "@/lib/supabaseBrowser";
import { createOrganization, setOrganizationRoles, upsertAddress, upsertPerson } from "@/lib/clients-db";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { getPriceTables, getPaymentTerms, getPaymentModes, PriceTable, PaymentTerm, PaymentMode } from "@/lib/clients-db";

import { Card, CardContent } from "@/components/ui/Card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { AddressForm, AddressFormData } from "@/components/forms/AddressForm";
import { ContactsTable, ContactFormData } from "@/components/forms/ContactsTable";
import { extractDigits, validateCNPJ } from "@/lib/cnpj";
import { Loader2, Search, CheckCircle2, Save, Settings } from "lucide-react";
import { cn, toTitleCase, normalizeEmail } from "@/lib/utils"; // Import cn and new helpers

interface ClientRegistrationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export function ClientRegistrationModal({ isOpen, onClose, onSuccess }: ClientRegistrationModalProps) {
    const { selectedCompany } = useCompany();
    const supabase = createClient();





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

    const [billingAddress, setBillingAddress] = useState<AddressFormData & { city_code_ibge?: string }>({
        zip: "", street: "", number: "", complement: "",
        neighborhood: "", city: "", state: "", country: "BR", city_code_ibge: ""
    });

    // Tab 2: Commercial
    const [commercialData, setCommercialData] = useState({
        price_table_id: "",
        default_payment_terms_days: "",
        freight_terms: "",
        sales_rep_user_id: "",
        notes_commercial: "",
        credit_limit: "",
        default_discount: "",
        sales_channel: "",
        payment_mode_id: "",
        payment_terms_id: ""
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleCommercialChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setCommercialData(prev => ({ ...prev, [name]: value }));
    };

    // Tab 3: Fiscal
    const [fiscalData, setFiscalData] = useState({
        is_simple_national: false,
        is_public_agency: false,
        ie_indicator: "contributor" as 'contributor' | 'exempt' | 'non_contributor',
        state_registration: "",
        municipal_registration: "",
        suframa: "",
        email_nfe: "",
        final_consumer: false,
        icms_contributor: true // Default based on contributor
    });

    const [priceTables, setPriceTables] = useState<PriceTable[]>([]);
    const [paymentTerms, setPaymentTerms] = useState<PaymentTerm[]>([]);
    const [paymentModes, setPaymentModes] = useState<PaymentMode[]>([]);

    // Fetch Commercial Data
    useEffect(() => {
        if (isOpen && selectedCompany?.id) {
            Promise.all([
                getPriceTables(supabase, selectedCompany.id),
                getPaymentTerms(supabase, selectedCompany.id),
                getPaymentModes(supabase, selectedCompany.id)
            ]).then(([tables, terms, modes]) => {
                setPriceTables(tables);
                setPaymentTerms(terms);
                setPaymentModes(modes);
            }).catch(console.error);
        }
    }, [isOpen, selectedCompany?.id, supabase]);

    const handleFiscalChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;

        if (type === 'checkbox') {
            const checked = (e.target as HTMLInputElement).checked;
            setFiscalData(prev => ({ ...prev, [name]: checked }));
        } else {
            setFiscalData(prev => {
                const newState = { ...prev, [name]: value };
                // Auto-update ICMS Contributor based on Indicator
                if (name === 'ie_indicator') {
                    newState.icms_contributor = (value === 'contributor');
                    // Logic: PJ Contributor = IE Mandatory. Exempt = IE Disable. Non = IE Disable.
                    if (value === 'exempt' || value === 'non_contributor') {
                        newState.state_registration = "";
                    }
                }
                return newState;
            });
        }
    };

    const [roles, setRoles] = useState({
        prospect: false,
        customer: true,
        supplier: false,
        carrier: false
    });

    const [contacts, setContacts] = useState<ContactFormData[]>([]);

    const handleAddContact = (contact: ContactFormData) => {
        setContacts(prev => [...prev, contact]);
    };

    const handleEditContact = (id: string, contact: ContactFormData) => {
        setContacts(prev => prev.map(c => c.id === id ? contact : c));
    };

    const handleRemoveContact = (id: string) => {
        setContacts(prev => prev.filter(c => c.id !== id));
    };

    const resetForm = () => {
        setActiveTab("dados");
        setFormData({
            document_number: "",
            legal_name: "",
            trade_name: "",
            phone: "",
            email: "",
        });
        setBillingAddress({
            zip: "", street: "", number: "", complement: "",
            neighborhood: "", city: "", state: "", country: "BR", city_code_ibge: ""
        });
        setCommercialData({
            price_table_id: "",
            default_payment_terms_days: "",
            freight_terms: "",
            sales_rep_user_id: "",
            notes_commercial: "",
            credit_limit: "",
            default_discount: "",
            sales_channel: "",
            payment_mode_id: "",
            payment_terms_id: ""
        });
        setFiscalData({
            is_simple_national: false,
            is_public_agency: false,
            ie_indicator: "contributor",
            state_registration: "",
            municipal_registration: "",
            suframa: "",
            email_nfe: "",
            final_consumer: false,
            icms_contributor: true
        });
        setRoles({ prospect: false, customer: true, supplier: false, carrier: false });
        setContacts([]);
        setError(null);
        setSuccess(null);
        setCnpjFetched(false);
    };

    const fetchCNPJData = async () => {
        const cleanDoc = extractDigits(formData.document_number);
        if (cleanDoc.length !== 14) return;

        setCnpjLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/cnpj/${cleanDoc}`);
            if (!res.ok) throw new Error("CNPJ não encontrado");
            const data = await res.json();

            setFormData(prev => ({
                ...prev,
                legal_name: toTitleCase(data.legal_name) || "",
                trade_name: toTitleCase(data.trade_name) || "",
                phone: data.phone || "",
                email: normalizeEmail(data.email) || ""
            }));

            setBillingAddress({
                zip: data.address.zip || "",
                street: toTitleCase(data.address.street) || "",
                number: data.address.number || "",
                complement: toTitleCase(data.address.complement) || "",
                neighborhood: toTitleCase(data.address.neighborhood) || "",
                city: toTitleCase(data.address.city) || "",
                state: data.address.state || "",
                country: "BR",
                city_code_ibge: data.address.ibge || "" // Use IBGE from API
            });

            // Note: Simplificated fiscal update as state is limited in this modal
            setFiscalData(prev => ({
                ...prev,
                is_simple_national: data.is_simple_national || false
            }));

            setCnpjFetched(true);
        } catch (err: any) {
            console.error(err);
            setError(err.message);
        } finally {
            setCnpjLoading(false);
        }
    };

    const fetchCepData = async (cep: string) => {
        const cleanCep = cep.replace(/\D/g, '');
        if (cleanCep.length !== 8) return;

        try {
            const res = await fetch(`https://brasilapi.com.br/api/cep/v2/${cleanCep}`);
            if (!res.ok) throw new Error("CEP não encontrado");
            const data = await res.json();

            setBillingAddress(prev => ({
                ...prev,
                street: data.street || prev.street,
                neighborhood: data.neighborhood || prev.neighborhood,
                city: data.city || prev.city,
                state: data.state || prev.state,
                city_code_ibge: data.ibge || ""
            }));
        } catch (error) {
            console.error("Erro CEP:", error);
            // Non-blocking, user can manual entry
        }
    };

    const handleAddressChange = (field: keyof AddressFormData, value: string) => {
        setBillingAddress(prev => ({ ...prev, [field]: value }));
        if (field === 'zip' && value.replace(/\D/g, '').length === 8) {
            fetchCepData(value);
        }
    };

    // ... (fetchCNPJData same, but trigger CEP fetch if needed)

    const sanitizeData = () => {
        // Sanitize FormData
        const sanitizedFormData = {
            ...formData,
            legal_name: toTitleCase(formData.legal_name) || "",
            trade_name: toTitleCase(formData.trade_name) || "",
            email: normalizeEmail(formData.email) || ""
        };

        // Sanitize Address
        const sanitizedAddress = {
            ...billingAddress,
            street: toTitleCase(billingAddress.street) || "",
            neighborhood: toTitleCase(billingAddress.neighborhood) || "",
            city: toTitleCase(billingAddress.city) || "",
            complement: toTitleCase(billingAddress.complement) || "",
            state: billingAddress.state.toUpperCase(),
            country: billingAddress.country.toUpperCase()
        };

        const sanitizedCommercial = { ...commercialData };

        const sanitizedFiscal = {
            ...fiscalData,
            email_nfe: normalizeEmail(fiscalData.email_nfe) || "",
            state_registration: fiscalData.state_registration.toUpperCase(),
            municipal_registration: fiscalData.municipal_registration.toUpperCase(),
            suframa: fiscalData.suframa.toUpperCase()
        };

        // Sanitize Contacts
        const sanitizedContacts = contacts.map(c => ({
            ...c,
            full_name: toTitleCase(c.full_name) || "",
            email: normalizeEmail(c.email) || ""
        }));

        return { sanitizedFormData, sanitizedAddress, sanitizedCommercial, sanitizedFiscal, sanitizedContacts };
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
            if (!sanitizedFormData.trade_name) setActiveTab("dados");
            if (!sanitizedFormData.trade_name) throw new Error("Nome Fantasia é obrigatório");

            const cleanDoc = extractDigits(sanitizedFormData.document_number);
            const isPJ = cleanDoc?.length === 14;
            const isPF = cleanDoc?.length === 11;

            if (cleanDoc && !validateCNPJ(sanitizedFormData.document_number) && !isPF) {
                setActiveTab("dados");
                if (isPJ) throw new Error("CNPJ inválido");
            }

            // IE Validation
            if (isPJ) {
                if (!sanitizedFiscal.ie_indicator) {
                    setActiveTab("fiscal");
                    throw new Error("Indicador de Inscrição Estadual é obrigatório para Pessoa Jurídica.");
                }
                if (sanitizedFiscal.ie_indicator === 'contributor' && !sanitizedFiscal.state_registration) {
                    setActiveTab("fiscal");
                    throw new Error("Inscrição Estadual é obrigatória para Contribuintes.");
                }
            }

            // Address Validation
            if (!sanitizedAddress.zip || !sanitizedAddress.street || !sanitizedAddress.number || !sanitizedAddress.neighborhood || !sanitizedAddress.city || !sanitizedAddress.state) {
                setActiveTab("dados");
                throw new Error("Endereço incompleto. Verifique CEP, Rua, Número, Bairro, Cidade e UF.");
            }
            // IBGE Blocking
            if (!billingAddress.city_code_ibge) {
                setActiveTab("dados");
                throw new Error("Código IBGE do município não identificado. Verifique o CEP.");
            }


            // 1. Create Organization
            const newOrg = await createOrganization(supabase, {
                company_id: selectedCompany.id,
                trade_name: sanitizedFormData.trade_name,
                legal_name: sanitizedFormData.legal_name || sanitizedFormData.trade_name,
                document_number: cleanDoc || null,
                document_type: isPF ? 'cpf' : isPJ ? 'cnpj' : null,
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
                // @ts-ignore
                final_consumer: sanitizedFiscal.final_consumer,
                icms_contributor: sanitizedFiscal.icms_contributor,

                // Commercial
                default_payment_terms_days: sanitizedCommercial.default_payment_terms_days ? parseInt(sanitizedCommercial.default_payment_terms_days) : null,
                freight_terms: (sanitizedCommercial.freight_terms as any) || null,
                notes_commercial: sanitizedCommercial.notes_commercial || null,
                price_table_id: sanitizedCommercial.price_table_id || null,
                sales_rep_user_id: sanitizedCommercial.sales_rep_user_id || null,
                payment_mode_id: sanitizedCommercial.payment_mode_id || null,
                payment_terms_id: sanitizedCommercial.payment_terms_id !== "none" ? sanitizedCommercial.payment_terms_id : null,
                credit_limit: sanitizedCommercial.credit_limit ? parseFloat(sanitizedCommercial.credit_limit) : null,
                default_discount: sanitizedCommercial.default_discount ? parseFloat(sanitizedCommercial.default_discount) : null,
                sales_channel: sanitizedCommercial.sales_channel || null,

                country_code: "BR",
                status: "active",
            });

            // ... (Roles logic same)

            // 3. Create Address (Include IBGE)
            if (sanitizedAddress.zip || sanitizedAddress.city) {
                await upsertAddress(supabase, {
                    company_id: selectedCompany.id,
                    organization_id: newOrg.id,
                    type: 'billing',
                    ...sanitizedAddress,
                    city_code_ibge: billingAddress.city_code_ibge, // Pass IBGE
                    is_default: true
                });
            }

            // ... (Contacts logic same)

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
                                    <div className="col-span-12 md:col-span-2 space-y-1">
                                        <label className="text-xs font-semibold text-gray-700">Complemento</label>
                                        <Input
                                            value={billingAddress.complement}
                                            onChange={(e) => handleAddressChange('complement', e.target.value)}
                                            placeholder="Apto..."
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
                                    <div className="col-span-12 md:col-span-3 space-y-1">
                                        <label className="text-xs font-semibold text-gray-700">Cidade</label>
                                        <Input
                                            value={billingAddress.city}
                                            onChange={(e) => handleAddressChange('city', e.target.value)}
                                            className="h-9 text-sm"
                                        />
                                    </div>
                                    <div className="col-span-12 md:col-span-1 space-y-1">
                                        <label className="text-xs font-semibold text-gray-700">UF</label>
                                        <Input
                                            value={billingAddress.state}
                                            onChange={(e) => handleAddressChange('state', e.target.value)}
                                            maxLength={2}
                                            className="h-9 text-sm px-1 text-center"
                                        />
                                    </div>
                                    <div className="col-span-12 md:col-span-3 space-y-1">
                                        <label className="text-xs font-semibold text-gray-700">Cód. IBGE</label>
                                        <Input
                                            value={billingAddress.city_code_ibge || ""}
                                            readOnly
                                            className="h-9 text-sm bg-gray-100 text-gray-500 cursor-not-allowed"
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

                        <TabsContent value="comercial" className="p-6 focus-visible:outline-none">
                            <div className="space-y-4">
                                <div className="grid grid-cols-12 gap-4">
                                    {/* ROW 1: Tabela (4) | Prazo (4) | Canal (4) */}
                                    <div className="col-span-12 md:col-span-4 space-y-1">
                                        <label className="text-xs font-semibold text-gray-700">Tabela de Preço</label>
                                        <Select
                                            value={commercialData.price_table_id}
                                            onValueChange={(val) => setCommercialData(prev => ({ ...prev, price_table_id: val }))}
                                        >
                                            <SelectTrigger className="h-9">
                                                <SelectValue placeholder="Selecione..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="standard">Padrão</SelectItem>
                                                {priceTables.map(t => (
                                                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="col-span-12 md:col-span-4 space-y-1">
                                        <label className="text-xs font-semibold text-gray-700">Prazo de Pagamento Padrão</label>
                                        <Select
                                            value={commercialData.payment_terms_id}
                                            onValueChange={(val) => setCommercialData(prev => ({ ...prev, payment_terms_id: val }))}
                                        >
                                            <SelectTrigger className="h-9">
                                                <SelectValue placeholder="Selecione..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">Nenhum</SelectItem>
                                                {paymentTerms.map(t => (
                                                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="col-span-12 md:col-span-4 space-y-1">
                                        <label className="text-xs font-semibold text-gray-700">Canal de Venda</label>
                                        <Select
                                            value={commercialData.sales_channel}
                                            onValueChange={(val) => setCommercialData(prev => ({ ...prev, sales_channel: val }))}
                                        >
                                            <SelectTrigger className="h-9">
                                                <SelectValue placeholder="Selecione..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="direct">Venda Direta</SelectItem>
                                                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                                                <SelectItem value="ecommerce">E-commerce</SelectItem>
                                                <SelectItem value="phone">Telefone</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {/* ROW 2: [Limite | Desconto] (4) | Modalidade (4) | Representante (4) */}
                                    <div className="col-span-12 md:col-span-4 grid grid-cols-2 gap-2">
                                        <div className="space-y-1">
                                            <label className="text-xs font-semibold text-gray-700">Limite de Crédito (R$)</label>
                                            <Input
                                                name="credit_limit"
                                                type="number"
                                                value={commercialData.credit_limit}
                                                onChange={handleCommercialChange}
                                                placeholder="0,00"
                                                className="h-9 text-sm"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-semibold text-gray-700">Desconto Padrão (%)</label>
                                            <Input
                                                name="default_discount"
                                                type="number"
                                                value={commercialData.default_discount}
                                                onChange={handleCommercialChange}
                                                placeholder="0.00"
                                                className="h-9 text-sm text-right"
                                            />
                                        </div>
                                    </div>

                                    <div className="col-span-12 md:col-span-4 space-y-1">
                                        <label className="text-xs font-semibold text-gray-700 flex items-center justify-between">
                                            Modalidade de Pagamento
                                            <Button variant="ghost" size="icon" className="h-4 w-4 ml-2" title="Gerenciar Modalidades">
                                                <Settings className="h-3 w-3 text-gray-500" />
                                            </Button>
                                        </label>
                                        <Select
                                            value={commercialData.payment_mode_id}
                                            onValueChange={(val) => setCommercialData(prev => ({ ...prev, payment_mode_id: val }))}
                                        >
                                            <SelectTrigger className="h-9">
                                                <SelectValue placeholder="Selecione a Modalidade..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {/* <SelectItem value="none">Nenhuma</SelectItem> */}
                                                {paymentModes.map(m => (
                                                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="col-span-12 md:col-span-4 space-y-1">
                                        <label className="text-xs font-semibold text-gray-700">Representante</label>
                                        <Select
                                            value={commercialData.sales_rep_user_id}
                                            onValueChange={(val) => setCommercialData(prev => ({ ...prev, sales_rep_user_id: val }))}
                                        >
                                            <SelectTrigger className="h-9">
                                                <SelectValue placeholder="Selecione..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="user-1">Representante Mock</SelectItem>
                                                {/* Dynamic reps here */}
                                            </SelectContent>
                                        </Select>
                                    </div>
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
                                <div className="flex flex-wrap gap-6 p-3 bg-gray-50 border border-gray-100 rounded-lg">
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
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            name="final_consumer"
                                            checked={fiscalData.final_consumer}
                                            onChange={handleFiscalChange}
                                            className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500"
                                        />
                                        <span className="text-sm font-medium">Consumidor Final</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer opacity-75">
                                        <input
                                            type="checkbox"
                                            name="icms_contributor"
                                            checked={fiscalData.icms_contributor}
                                            readOnly
                                            className="w-4 h-4 text-gray-500 rounded focus:ring-gray-400 cursor-not-allowed"
                                        />
                                        <span className="text-sm font-medium text-gray-700">Contribuinte ICMS (Auto)</span>
                                    </label>
                                </div>

                                <div className="grid grid-cols-12 gap-4">
                                    <div className="col-span-12 md:col-span-4 space-y-1">
                                        <label className="text-xs font-semibold text-gray-700">Indicador IE</label>
                                        <select
                                            name="ie_indicator"
                                            value={fiscalData.ie_indicator}
                                            onChange={handleFiscalChange}
                                            className="flex h-9 w-full rounded-md border border-gray-200 bg-white px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-500"
                                        >
                                            <option value="contributor">Contribuinte</option>
                                            <option value="exempt">Isento</option>
                                            <option value="non_contributor">Não Contribuinte</option>
                                        </select>
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
