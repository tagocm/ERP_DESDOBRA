"use client";

import { Card, CardContent } from "@/components/ui/Card";
import { CardHeaderStandard } from "@/components/ui/CardHeaderStandard";
import { Alert } from "@/components/ui/Alert";
import { useToast } from "@/components/ui/use-toast";

import { useState, useEffect, useCallback, useRef } from "react";
import { useCompany } from "@/contexts/CompanyContext";
import { PageHeader } from "@/components/ui/PageHeader";
import { createClient } from "@/lib/supabaseBrowser";
import { createOrganization, setOrganizationRoles, upsertAddress, upsertPerson, getPriceTables, getPaymentTerms, getRepresentatives, PriceTable, PaymentTerm } from "@/lib/clients-db";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { DecimalInput } from "@/components/ui/DecimalInput";
import { FormErrorSummary } from "@/components/ui/FormErrorSummary";
import { FieldError } from "@/components/ui/FieldError";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { Tabs, TabsContent } from "@/components/ui/Tabs";
import { FormTabsList, FormTabsTrigger } from "@/components/ui/FormTabs";
import { ContactsTable, ContactFormData } from "@/components/forms/ContactsTable";
import { extractDigits, formatCNPJ, validateCNPJ } from "@/lib/cnpj";
import { Loader2, Search, CheckCircle2, Save, ArrowLeft, ShoppingCart, Package, Truck, FileText, Receipt, Users, MessageSquare } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AddressFormData } from "@/components/forms/AddressForm";
import { toTitleCase, normalizeEmail } from "@/lib/utils";
import { PaymentModeManagerModal } from "@/components/organizations/PaymentModeManagerModal";
import { listPaymentModesAction } from "@/app/actions/payment-mode-actions";
import type { PaymentMode } from "@/lib/data/payment-modes";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { Settings } from "lucide-react";
import { CarrierSelector } from "@/components/app/CarrierSelector";



export default function NewOrganizationPage() {
    const { selectedCompany } = useCompany();
    const supabase = createClient();

    const router = useRouter();

    const { toast } = useToast();

    // ----------------------------------------------------------------------
    // STATE
    // ----------------------------------------------------------------------
    const [activeTab, setActiveTab] = useState("dados");
    const [isLoading, setIsLoading] = useState(false);
    const [cnpjLoading, setCnpjLoading] = useState(false);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [manageModesOpen, setManageModesOpen] = useState(false);

    // ...

    const [cnpjFetched, setCnpjFetched] = useState(false);

    // Form Data
    const [formData, setFormData] = useState({
        document_number: "",
        legal_name: "",
        trade_name: "",
        phone: "",
        email: "",
    });

    const [billingAddress, setBillingAddress] = useState<AddressFormData>({
        zip: "", street: "", number: "", complement: "",
        neighborhood: "", city: "", state: "", country: "BR", city_code_ibge: ""
    });

    const [commercialData, setCommercialData] = useState({
        price_table_id: "",
        default_payment_terms_days: "", // Deprecated/Fallback
        sales_rep_user_id: "",
        freight_terms: "" as 'cif' | 'fob' | 'retira' | '',
        notes_commercial: "",

        // New Fields
        credit_limit: "",
        default_discount: "",
        sales_channel: "",
        payment_terms_id: "",
        purchase_payment_terms_id: "",
        delivery_terms: "",
        lead_time_days: "",
        minimum_order_value: "",
        preferred_carrier_id: "",
        region_route: "",
        payment_mode_id: ""
    });

    const [fiscalData, setFiscalData] = useState({
        is_simple_national: false,
        is_public_agency: false,
        ie_indicator: "contributor" as 'contributor' | 'exempt' | 'non_contributor',
        state_registration: "",
        municipal_registration: "",
        suframa: "",
        email_nfe: "",

        // New Fiscal Fields
        tax_regime: "",
        icms_contributor: "",
        is_ie_exempt: false,
        is_final_consumer: false,
        public_agency_sphere: "",
        public_agency_code: "",
        notes_fiscal: "",

    });

    // Lists for Selects
    const [priceTables, setPriceTables] = useState<PriceTable[]>([]);
    const [paymentTerms, setPaymentTerms] = useState<PaymentTerm[]>([]);
    const [paymentModes, setPaymentModes] = useState<PaymentMode[]>([]);
    const [representatives, setRepresentatives] = useState<any[]>([]);

    useEffect(() => {
        if (!selectedCompany) return;
        const loadOptions = async () => {
            try {
                const [pts, terms, reps] = await Promise.all([
                    getPriceTables(supabase, selectedCompany.id),
                    getPaymentTerms(supabase, selectedCompany.id),
                    getRepresentatives(supabase, selectedCompany.id)
                ]);
                const modesResult = await listPaymentModesAction();
                const modes = modesResult.ok ? (modesResult.data ?? []) : [];
                setPriceTables(pts);
                setPaymentTerms(terms);
                setPaymentModes(modes);
                setRepresentatives(reps);
            } catch (err: any) {
                console.error("Error loading options (FULL):", err);
                // Fail silently
            }
        };
        loadOptions();
    }, [selectedCompany, supabase]);

    const [contacts, setContacts] = useState<ContactFormData[]>([]);

    const [roles, setRoles] = useState({
        prospect: false,
        customer: true,
        supplier: false,
        carrier: false,
        representative: false
    });

    // Refs for state access in callbacks without re-triggering effects excessively
    const stateRef = useRef({ formData, billingAddress, commercialData, fiscalData, contacts, roles });
    useEffect(() => {
        stateRef.current = { formData, billingAddress, commercialData, fiscalData, contacts, roles };
    }, [formData, billingAddress, commercialData, fiscalData, contacts, roles]);

    // ----------------------------------------------------------------------
    // HANDLERS
    // ----------------------------------------------------------------------

    const sanitizeData = () => {
        const { formData, billingAddress, commercialData, fiscalData, contacts } = stateRef.current;

        const sanitizedFormData = {
            ...formData,
            legal_name: toTitleCase(formData.legal_name) || "",
            trade_name: toTitleCase(formData.trade_name) || "",
            email: normalizeEmail(formData.email) || ""
        };

        const sanitizedAddress = {
            ...billingAddress,
            street: toTitleCase(billingAddress.street) || "",
            neighborhood: toTitleCase(billingAddress.neighborhood) || "",
            city: toTitleCase(billingAddress.city) || "",
            complement: toTitleCase(billingAddress.complement) || "",
            state: billingAddress.state.toUpperCase(),
            country: billingAddress.country.toUpperCase(),
            city_code_ibge: billingAddress.city_code_ibge
        };

        const sanitizedCommercial = { ...commercialData };

        const sanitizedFiscal = {
            ...fiscalData,
            email_nfe: normalizeEmail(fiscalData.email_nfe) || "",
            state_registration: fiscalData.state_registration.toUpperCase(),
            municipal_registration: fiscalData.municipal_registration.toUpperCase(),
            suframa: fiscalData.suframa.toUpperCase(),
            // New Fields Sanitization
            public_agency_code: fiscalData.public_agency_code ? fiscalData.public_agency_code.toUpperCase() : "",
        };

        const sanitizedContacts = contacts.map(c => ({
            ...c,
            full_name: toTitleCase(c.full_name) || "",
            email: normalizeEmail(c.email || "") || "",
        }));

        return { sanitizedFormData, sanitizedAddress, sanitizedCommercial, sanitizedFiscal, sanitizedContacts };
    };

    const handleSubmit = useCallback(async (saveAndNew = false) => {
        if (!selectedCompany) return;

        setIsLoading(true);

        try {
            const { roles } = stateRef.current;
            const { sanitizedFormData, sanitizedAddress, sanitizedCommercial, sanitizedFiscal, sanitizedContacts } = sanitizeData();

            // Validation
            const newErrors: Record<string, string> = {};

            if (!sanitizedFormData.trade_name) {
                newErrors.trade_name = "Nome Fantasia é obrigatório";
            }

            const cleanDoc = extractDigits(sanitizedFormData.document_number);

            // Allow empty document ONLY if Prospect
            const isProspectOnly = roles.prospect && !roles.customer && !roles.supplier && !roles.carrier;

            if (!cleanDoc) {
                // Relax validation if no doc
            } else {
                if (!validateCNPJ(sanitizedFormData.document_number) && cleanDoc.length !== 11) {
                    if (cleanDoc.length === 14) {
                        newErrors.document_number = "CNPJ inválido";
                    }
                }
            }

            if (Object.keys(newErrors).length > 0) {
                setFieldErrors(newErrors);
                setIsLoading(false);
                window.scrollTo({ top: 0, behavior: 'smooth' });
                return;
            }

            // Create Organization
            const newOrg = await createOrganization(supabase, {
                company_id: selectedCompany.id,
                trade_name: sanitizedFormData.trade_name,
                legal_name: sanitizedFormData.legal_name || sanitizedFormData.trade_name,
                document_number: cleanDoc || null,
                document_type: cleanDoc?.length === 11 ? 'cpf' : cleanDoc?.length === 14 ? 'cnpj' : null,
                email: sanitizedFormData.email || null,
                phone: sanitizedFormData.phone || null,

                // Fiscal Verified
                state_registration: sanitizedFiscal.state_registration || null,
                municipal_registration: sanitizedFiscal.municipal_registration || null,
                ie_indicator: sanitizedFiscal.ie_indicator,
                suframa: sanitizedFiscal.suframa || null,
                email_nfe: sanitizedFiscal.email_nfe || null,
                is_simple_national: sanitizedFiscal.is_simple_national, // Mapped from logic above if needed, or straight from state
                is_public_agency: sanitizedFiscal.is_public_agency,
                // icms_contributor: sanitizedFiscal.icms_contributor === 'Contribuinte', // Removed: Not in DB schema

                final_consumer: sanitizedFiscal.is_final_consumer, // Fix: Use correct DB column name

                // Unverified/Missing Types (Commented out to prevent crash)
                // tax_regime: sanitizedFiscal.tax_regime || null,
                // is_ie_exempt: sanitizedFiscal.is_ie_exempt,
                // public_agency_sphere: sanitizedFiscal.is_public_agency ? sanitizedFiscal.public_agency_sphere : null,
                // public_agency_code: sanitizedFiscal.is_public_agency ? sanitizedFiscal.public_agency_code : null,
                // default_operation_nature: sanitizedFiscal.default_operation_nature || null,
                // default_cfop: sanitizedFiscal.default_cfop || null,
                // notes_fiscal: sanitizedFiscal.notes_fiscal || null,

                // Commercial Verified
                default_payment_terms_days: sanitizedCommercial.default_payment_terms_days ? parseInt(sanitizedCommercial.default_payment_terms_days) : null,
                freight_terms: (sanitizedCommercial.freight_terms as any) || null,
                notes_commercial: sanitizedCommercial.notes_commercial || null,
                price_table_id: sanitizedCommercial.price_table_id || null,
                sales_rep_user_id: sanitizedCommercial.sales_rep_user_id || null,

                // Commercial Fields (Extended)
                credit_limit: sanitizedCommercial.credit_limit ? parseFloat(sanitizedCommercial.credit_limit) : null,
                default_discount: sanitizedCommercial.default_discount ? parseFloat(sanitizedCommercial.default_discount) : null,
                sales_channel: sanitizedCommercial.sales_channel || null,
                payment_terms_id: sanitizedCommercial.payment_terms_id || null,
                purchase_payment_terms_id: sanitizedCommercial.purchase_payment_terms_id || null,
                delivery_terms: sanitizedCommercial.delivery_terms || null,
                lead_time_days: sanitizedCommercial.lead_time_days ? parseInt(sanitizedCommercial.lead_time_days) : null,
                minimum_order_value: sanitizedCommercial.minimum_order_value ? parseFloat(sanitizedCommercial.minimum_order_value) : null,
                preferred_carrier_id: sanitizedCommercial.preferred_carrier_id || null,
                region_route: sanitizedCommercial.region_route || null,
                payment_mode_id: sanitizedCommercial.payment_mode_id || null,

                country_code: "BR",
                status: "active",
            });

            // Set Roles
            const selectedRoles = Object.entries(roles)
                .filter(([_, checked]) => checked)
                .map(([role]) => role);

            if (selectedRoles.length > 0) {
                await setOrganizationRoles(supabase, selectedCompany.id, newOrg.id, selectedRoles);
            }

            // Create Address
            if (sanitizedAddress.zip || sanitizedAddress.city) {
                await upsertAddress(supabase, {
                    company_id: selectedCompany.id,
                    organization_id: newOrg.id,
                    type: 'billing',
                    ...sanitizedAddress,
                    is_default: true
                });
            }

            // Create Contacts
            for (const contact of sanitizedContacts) {
                await upsertPerson(supabase, {
                    company_id: selectedCompany.id,
                    organization_id: newOrg.id,
                    full_name: contact.full_name,
                    email: contact.email || null,
                    phone: contact.phone || null,
                    notes: contact.notes || null,
                    departments: contact.departments || null, // New field
                    is_primary: contact.is_primary
                });
            }

            if (saveAndNew) {
                setFormData({ document_number: "", legal_name: "", trade_name: "", phone: "", email: "" });
                setBillingAddress({ zip: "", street: "", number: "", complement: "", neighborhood: "", city: "", state: "", country: "BR", city_code_ibge: "" });
                setCommercialData(prev => ({ ...prev, price_table_id: "", payment_terms_id: "", credit_limit: "", default_discount: "", payment_mode_id: "" })); // Reset key fields
                // Reset other states if needed
                toast({
                    title: "Sucesso",
                    description: "Cadastro salvo com sucesso. Pronto para o próximo.",
                    variant: "default"
                });
                window.scrollTo({ top: 0, behavior: 'smooth' });
            } else {
                router.push("/app/cadastros/pessoas-e-empresas?success=created");
            }

        } catch (err: any) {
            console.error("Full error object:", err);

            let errorMessage = "Erro desconhecido";
            let details = "";

            if (typeof err === "string") {
                errorMessage = err;
            } else if (err instanceof Error) {
                errorMessage = err.message;
            } else if (typeof err === "object" && err !== null) {
                // Try Supabase/Postgres error fields
                errorMessage = err.message || err.error_description || "Erro no servidor";
                details = err.details || err.hint || "";

                // If message is still generic or empty, try stringify but avoid {}
                if (errorMessage === "Erro no servidor" || !errorMessage) {
                    const json = JSON.stringify(err);
                    if (json !== "{}") errorMessage = json;
                }
            }

            toast({
                title: "Erro ao Salvar",
                description: details ? errorMessage + " (" + details + ")" : errorMessage,
                variant: "destructive"
            });
        } finally {
            setIsLoading(false);
        }
    }, [selectedCompany, supabase, router]); // Deps




    // Input Handlers
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        if (name === 'document_number') {
            setFormData(prev => ({ ...prev, [name]: formatCNPJ(value) }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleAddressChange = (field: keyof AddressFormData, value: string) => {
        setBillingAddress(prev => ({ ...prev, [field]: value }));
        if (field === 'zip') {
            const cleanCep = value.replace(/\D/g, "");
            if (cleanCep.length === 8) {
                fetchCepData(cleanCep);
            }
        }
    };

    const handleCommercialChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setCommercialData(prev => ({ ...prev, [name]: value }));
    };

    const fetchCepData = async (cep: string) => {
        const cleanCep = cep.replace(/\D/g, "");
        if (cleanCep.length !== 8) return;

        try {
            const res = await fetch("https://brasilapi.com.br/api/cep/v2/" + cleanCep);
            if (!res.ok) throw new Error("CEP não encontrado");
            const data = await res.json();

            setBillingAddress(prev => ({
                ...prev,
                street: toTitleCase(data.street) || prev.street,
                neighborhood: toTitleCase(data.neighborhood) || prev.neighborhood,
                city: toTitleCase(data.city) || prev.city,
                state: data.state || prev.state,
                city_code_ibge: data.ibge || prev.city_code_ibge // BrasilAPI v2 returns 'ibge'
            }));
        } catch (error) {
            console.error("Erro ao buscar CEP:", error);
        }
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

    const fetchCNPJData = async () => {
        const cnpjDigits = extractDigits(formData.document_number);
        if (cnpjDigits.length !== 14) return;
        setCnpjLoading(true);
        try {
            const res = await fetch("/api/cnpj/" + cnpjDigits);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            setFormData(prev => ({
                ...prev,
                legal_name: prev.legal_name || data.legal_name || "",
                trade_name: prev.trade_name || data.trade_name || "",
                email: prev.email || data.email || "",
                phone: prev.phone || data.phone || "",
            }));
            if (!billingAddress.zip && data.address.zip) {
                setBillingAddress({
                    zip: data.address.zip || "",
                    street: toTitleCase(data.address.street) || "",
                    number: data.address.number || "",
                    complement: toTitleCase(data.address.complement) || "",
                    neighborhood: toTitleCase(data.address.neighborhood) || "",
                    city: toTitleCase(data.address.city) || "",
                    state: data.address.state?.toUpperCase() || "",
                    city_code_ibge: data.address.ibge || "",
                    country: "BR"
                });
            }
            setCnpjFetched(true);
        } catch (err) {
            toast({
                title: "Erro ao buscar CNPJ",
                description: "Não foi possível buscar dados para o CNPJ informado.",
                variant: "destructive",
            });
        } finally {
            setCnpjLoading(false);
        }
    };

    const reloadPaymentModes = async () => {
        if (!selectedCompany) return;
        try {
            const result = await listPaymentModesAction();
            if (result.ok && result.data) setPaymentModes(result.data);
        } catch (e) {
            console.error(e);
        }
    };


    return (
        <div>
            <Dialog open={manageModesOpen} onOpenChange={setManageModesOpen}>
                <PaymentModeManagerModal onChange={reloadPaymentModes} />
            </Dialog>
            {/* Alerts removed in favor of Toasts */}
            <PageHeader
                title="Nova Pessoas & Empresas"
                subtitle="Cadastre clientes, fornecedores e parceiros."
                actions={
                    <div className="flex gap-2">
                        <Button variant="secondary" onClick={() => router.push('/app/cadastros/pessoas-e-empresas')} disabled={isLoading}>
                            Cancelar
                        </Button>
                        <Button variant="secondary" onClick={() => handleSubmit(true)} disabled={isLoading}>
                            Salvar e Novo
                        </Button>
                        <Button onClick={() => handleSubmit(false)} disabled={isLoading}>
                            {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Salvar
                        </Button>
                    </div>
                }
                errorSummary={
                    <FormErrorSummary
                        errors={Object.values(fieldErrors)}
                        visible={Object.keys(fieldErrors).length > 0}
                        onClose={() => setFieldErrors({})}
                    />
                }
            >
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <FormTabsList className="px-0 border-b-0">
                        {["dados:Dados Gerais", "comercial:Comercial", "fiscal:Fiscal", "contatos:Contatos"].map(tab => {
                            const [value, label] = tab.split(':');
                            return (
                                <FormTabsTrigger
                                    key={value}
                                    value={value}
                                >
                                    {label}
                                </FormTabsTrigger>
                            )
                        })}
                    </FormTabsList>
                </Tabs>
            </PageHeader>

            <div className="w-full pb-20 px-6">

                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    {/* TAB DADOS */}
                    <TabsContent value="dados" className="space-y-6 focus-visible:outline-none mt-0">
                        <Card>
                            <CardHeaderStandard
                                icon={<FileText className="w-5 h-5" />}
                                title="Dados Principais"
                            />
                            <CardContent className="space-y-6">
                                <div className="grid grid-cols-12 gap-6">
                                    <div className="col-span-12 md:col-span-4 lg:col-span-3 space-y-1.5">
                                        <label className="text-sm font-medium text-gray-700">CNPJ / CPF</label>
                                        <div className="flex gap-2">
                                            <Input
                                                name="document_number"
                                                value={formData.document_number}
                                                onChange={handleChange}
                                                placeholder="00.000.000/0000-00"
                                                maxLength={18}
                                                error={!!fieldErrors.document_number}
                                            />
                                            <FieldError error={fieldErrors.document_number} />
                                            <Button
                                                type="button"
                                                variant="secondary"
                                                onClick={fetchCNPJData}
                                                className="px-3"
                                                disabled={cnpjLoading || extractDigits(formData.document_number).length !== 14}
                                            >
                                                <Search className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>

                                    <div className="col-span-12 md:col-span-4 lg:col-span-4 space-y-1.5">
                                        <label className="text-sm font-medium text-gray-700">Nome Fantasia *</label>
                                        <Input
                                            name="trade_name"
                                            value={formData.trade_name}
                                            onChange={handleChange}
                                            required
                                            error={!!fieldErrors.trade_name}
                                        />
                                        <FieldError error={fieldErrors.trade_name} />
                                    </div>

                                    <div className="col-span-12 md:col-span-4 lg:col-span-5 space-y-1.5 flex flex-col items-start">
                                        <label className="text-sm font-medium text-gray-700 block">Papéis</label>
                                        <div className="flex flex-wrap items-center justify-start gap-2">
                                            {Object.entries(roles).map(([role, checked]) => (
                                                <label key={role} className="flex items-center gap-2 cursor-pointer bg-gray-50 px-3 py-1.5 rounded border border-gray-100 hover:bg-gray-100 transition-colors">
                                                    <input
                                                        type="checkbox"
                                                        checked={checked}
                                                        onChange={(e) => setRoles(prev => ({ ...prev, [role]: e.target.checked }))}
                                                        className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500"
                                                    />
                                                    <span className="text-sm text-gray-700 font-medium capitalize">
                                                        {role === 'prospect' ? 'Prospect' :
                                                            role === 'customer' ? 'Cliente' :
                                                                role === 'supplier' ? 'Fornecedor' :
                                                                    role === 'carrier' ? 'Transportadora' :
                                                                        role === 'representative' ? 'Representante' : role}
                                                    </span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-12 gap-6">
                                    <div className="col-span-12 md:col-span-8 space-y-1.5">
                                        <label className="text-sm font-medium text-gray-700">Razão Social</label>
                                        <Input
                                            name="legal_name"
                                            value={formData.legal_name}
                                            onChange={handleChange}
                                        />
                                    </div>
                                    <div className="col-span-12 md:col-span-4 space-y-1.5">
                                        <label className="text-sm font-medium text-gray-700">Email</label>
                                        <Input
                                            type="email"
                                            name="email"
                                            value={formData.email}
                                            onChange={handleChange}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-12 gap-6">
                                    <div className="col-span-12 md:col-span-3 space-y-1.5">
                                        <label className="text-sm font-medium text-gray-700">Telefone</label>
                                        <Input name="phone" value={formData.phone} onChange={handleChange} />
                                    </div>
                                    <div className="col-span-12 md:col-span-2 space-y-1.5">
                                        <label className="text-sm font-medium text-gray-700">CEP</label>
                                        <div className="flex gap-2">
                                            <Input
                                                value={billingAddress.zip}
                                                onChange={(e) => handleAddressChange('zip', e.target.value)}
                                                placeholder="00000-000"
                                            />
                                            <Button
                                                type="button"
                                                variant="secondary"
                                                onClick={() => {
                                                    const clean = billingAddress.zip.replace(/\D/g, "");
                                                    if (clean.length === 8) fetchCepData(clean);
                                                }}
                                                className="px-3"
                                                disabled={billingAddress.zip.replace(/\D/g, "").length !== 8}
                                            >
                                                <Search className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                    <div className="col-span-12 md:col-span-5 space-y-1.5">
                                        <label className="text-sm font-medium text-gray-700">Logradouro</label>
                                        <Input value={billingAddress.street} onChange={(e) => handleAddressChange('street', e.target.value)} />
                                    </div>
                                    <div className="col-span-12 md:col-span-2 space-y-1.5">
                                        <label className="text-sm font-medium text-gray-700">Número</label>
                                        <Input value={billingAddress.number} onChange={(e) => handleAddressChange('number', e.target.value)} />
                                    </div>
                                </div>

                                <div className="grid grid-cols-12 gap-6">
                                    <div className="col-span-12 md:col-span-2 space-y-1.5">
                                        <label className="text-sm font-medium text-gray-700">Complemento</label>
                                        <Input value={billingAddress.complement} onChange={(e) => handleAddressChange('complement', e.target.value)} />
                                    </div>
                                    <div className="col-span-12 md:col-span-3 space-y-1.5">
                                        <label className="text-sm font-medium text-gray-700">Bairro</label>
                                        <Input value={billingAddress.neighborhood} onChange={(e) => handleAddressChange('neighborhood', e.target.value)} />
                                    </div>
                                    <div className="col-span-12 md:col-span-3 space-y-1.5">
                                        <label className="text-sm font-medium text-gray-700">Cidade</label>
                                        <Input value={billingAddress.city} onChange={(e) => handleAddressChange('city', e.target.value)} />
                                    </div>
                                    <div className="col-span-12 md:col-span-1 space-y-1.5">
                                        <label className="text-sm font-medium text-gray-700">UF</label>
                                        <Input value={billingAddress.state} onChange={(e) => handleAddressChange('state', e.target.value)} maxLength={2} />
                                    </div>
                                    <div className="col-span-12 md:col-span-3 space-y-1.5">
                                        <label className="text-sm font-medium text-gray-700">Cód. IBGE</label>
                                        <Input
                                            value={billingAddress.city_code_ibge || ""}
                                            readOnly
                                            className="bg-gray-50 text-gray-500 cursor-not-allowed"
                                        />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* TAB COMERCIAL */}
                    <TabsContent value="comercial" className="space-y-6 focus-visible:outline-none mt-0">
                        {/* CARD A - Condições de Venda (Cliente) */}
                        {roles.customer && (
                            <div className="transition-all duration-200">
                                <Card>
                                    <CardHeaderStandard
                                        icon={<ShoppingCart className="w-5 h-5" />}
                                        title="Condições de Venda"
                                    />
                                    <CardContent className="space-y-6">
                                        {/* ROW 1: Tabela | Prazo | Canal */}
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                            <div className="space-y-1.5">
                                                <label className="text-sm font-medium text-gray-700">Tabela de Preço</label>
                                                <Select
                                                    name="price_table_id"
                                                    value={commercialData.price_table_id}
                                                    onValueChange={(val) => setCommercialData(prev => ({ ...prev, price_table_id: val }))}
                                                >
                                                    <SelectTrigger className="w-full">
                                                        <SelectValue placeholder="Selecione..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="standard">Padrão</SelectItem>
                                                        {priceTables.map(pt => (
                                                            <SelectItem key={pt.id} value={pt.id}>{pt.name}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            <div className="space-y-1.5">
                                                <label className="text-sm font-medium text-gray-700">Prazo de Pagamento</label>
                                                <Select
                                                    name="payment_terms_id"
                                                    value={commercialData.payment_terms_id}
                                                    onValueChange={(val) => setCommercialData(prev => ({ ...prev, payment_terms_id: val }))}
                                                >
                                                    <SelectTrigger className="w-full">
                                                        <SelectValue placeholder="Selecione..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {paymentTerms.map(pt => (
                                                            <SelectItem key={pt.id} value={pt.id}>{pt.name}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            <div className="space-y-1.5">
                                                <label className="text-sm font-medium text-gray-700">Canal de Venda</label>
                                                <Select
                                                    name="sales_channel"
                                                    value={commercialData.sales_channel}
                                                    onValueChange={(val) => setCommercialData(prev => ({ ...prev, sales_channel: val }))}
                                                >
                                                    <SelectTrigger className="w-full">
                                                        <SelectValue placeholder="Selecione..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                                                        <SelectItem value="Telefone">Telefone</SelectItem>
                                                        <SelectItem value="Email">Email</SelectItem>
                                                        <SelectItem value="Presencial">Presencial</SelectItem>
                                                        <SelectItem value="E-commerce">E-commerce</SelectItem>
                                                        <SelectItem value="Outro">Outro</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>

                                        {/* ROW 2: [Limite|Desconto] | Modalidade | Representante */}
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                            {/* Col 1: Split Limits */}
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-1.5">
                                                    <label className="text-sm font-medium text-gray-700">Limite de Crédito (R$)</label>
                                                    <DecimalInput
                                                        value={commercialData.credit_limit ? parseFloat(commercialData.credit_limit) : undefined}
                                                        onChange={(val) => setCommercialData(prev => ({ ...prev, credit_limit: val !== null ? String(val) : "" }))}
                                                        className="w-full text-right"
                                                        precision={2}
                                                        placeholder="0,00"
                                                    />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <label className="text-sm font-medium text-gray-700">Desconto Padrão (%)</label>
                                                    <DecimalInput
                                                        value={commercialData.default_discount ? parseFloat(commercialData.default_discount) : undefined}
                                                        onChange={(val) => setCommercialData(prev => ({ ...prev, default_discount: val !== null ? String(val) : "" }))}
                                                        className="w-full text-right"
                                                        precision={2}
                                                        placeholder="0,00"
                                                    />
                                                </div>
                                            </div>

                                            {/* Col 2: Payment Mode */}
                                            <div className="space-y-1.5">
                                                <label className="text-sm font-medium text-gray-700">
                                                    Modalidade de Pagamento
                                                </label>
                                                <div className="flex items-center gap-2">
                                                    <Select
                                                        value={commercialData.payment_mode_id}
                                                        onValueChange={(val) => setCommercialData(prev => ({ ...prev, payment_mode_id: val }))}
                                                    >
                                                        <SelectTrigger className="w-full">
                                                            <SelectValue placeholder="Selecione..." />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {paymentModes.map(m => (
                                                                <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-9 w-9 shrink-0"
                                                        title="Gerenciar Modalidades"
                                                        onClick={() => setManageModesOpen(true)}
                                                    >
                                                        <Settings className="h-4 w-4 text-gray-500" />
                                                    </Button>
                                                </div>
                                            </div>

                                            {/* Col 3: Rep */}
                                            <div className="space-y-1.5">
                                                <label className="text-sm font-medium text-gray-700">Representante</label>
                                                <Select
                                                    name="sales_rep_user_id"
                                                    value={commercialData.sales_rep_user_id}
                                                    onValueChange={(val) => setCommercialData(prev => ({ ...prev, sales_rep_user_id: val }))}
                                                >
                                                    <SelectTrigger className="w-full">
                                                        <SelectValue placeholder="Selecione..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {representatives.map(rep => (
                                                            <SelectItem key={rep.id} value={rep.id}>
                                                                {rep.trade_name}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        )}

                        {/* CARD B - Condições de Compra (Fornecedor) */}
                        {roles.supplier && (
                            <div className="transition-all duration-200">
                                <Card>
                                    <CardHeaderStandard
                                        icon={<Package className="w-5 h-5" />}
                                        title="Condições de Compra"
                                    />
                                    <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                        <div className="space-y-1.5">
                                            <label className="text-sm font-medium text-gray-700">Prazo de Pagamento</label>
                                            <Select
                                                name="purchase_payment_terms_id"
                                                value={commercialData.purchase_payment_terms_id}
                                                onValueChange={(val) => setCommercialData(prev => ({ ...prev, purchase_payment_terms_id: val }))}
                                            >
                                                <SelectTrigger className="w-full">
                                                    <SelectValue placeholder="Selecione..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {paymentTerms.map(pt => (
                                                        <SelectItem key={pt.id} value={pt.id}>{pt.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-sm font-medium text-gray-700">Condição de Entrega</label>
                                            <Select
                                                name="delivery_terms"
                                                value={commercialData.delivery_terms}
                                                onValueChange={(val) => setCommercialData(prev => ({ ...prev, delivery_terms: val }))}
                                            >
                                                <SelectTrigger className="w-full">
                                                    <SelectValue placeholder="Selecione..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="Retira">Retira</SelectItem>
                                                    <SelectItem value="Entrega">Entrega</SelectItem>
                                                    <SelectItem value="Transportadora">Transportadora</SelectItem>
                                                    <SelectItem value="Outro">Outro</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-sm font-medium text-gray-700">Lead Time (dias)</label>
                                            <Input
                                                name="lead_time_days"
                                                value={commercialData.lead_time_days}
                                                onChange={handleCommercialChange}
                                                type="number"
                                                min="0"
                                            />
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-sm font-medium text-gray-700">Pedido Mínimo (R$)</label>
                                            <DecimalInput
                                                value={commercialData.minimum_order_value ? parseFloat(commercialData.minimum_order_value) : undefined}
                                                onChange={(val) => setCommercialData(prev => ({ ...prev, minimum_order_value: val !== null ? String(val) : "" }))}
                                                className="w-full text-right"
                                                precision={2}
                                                placeholder="0,00"
                                            />
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-sm font-medium text-gray-700">
                                                Modalidade de Pagamento
                                            </label>
                                            <div className="flex items-center gap-2">
                                                <Select
                                                    value={commercialData.payment_mode_id}
                                                    onValueChange={(val) => setCommercialData(prev => ({ ...prev, payment_mode_id: val }))}
                                                >
                                                    <SelectTrigger className="w-full">
                                                        <SelectValue placeholder="Selecione..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {paymentModes.map(m => (
                                                            <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-9 w-9 shrink-0"
                                                    title="Gerenciar Modalidades"
                                                    onClick={() => setManageModesOpen(true)}
                                                >
                                                    <Settings className="h-4 w-4 text-gray-500" />
                                                </Button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        )}

                        {/* CARD C - Frete / Logística */}
                        {(roles.customer || roles.supplier) && (
                            <div className="transition-all duration-200">
                                <Card>
                                    <CardHeaderStandard
                                        icon={<Truck className="w-5 h-5" />}
                                        title="Frete / Logística"
                                    />
                                    <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        <div className="space-y-1.5">
                                            <label className="text-sm font-medium text-gray-700">Tipo de Frete Padrão</label>
                                            <Select
                                                name="freight_terms"
                                                value={commercialData.freight_terms}
                                                onValueChange={(val) => setCommercialData(prev => ({ ...prev, freight_terms: val as any }))}
                                            >
                                                <SelectTrigger className="w-full">
                                                    <SelectValue placeholder="Selecione..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="cif">CIF (Pago pelo Remetente)</SelectItem>
                                                    <SelectItem value="fob">FOB (Pago pelo Destinatário)</SelectItem>
                                                    <SelectItem value="retira">Retira (Cliente retira)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        {/* Carrier Selector */}
                                        <div className="space-y-1.5">
                                            <label className="text-sm font-medium text-gray-700">Transportadora Preferencial</label>
                                            <CarrierSelector
                                                value={commercialData.preferred_carrier_id || null}
                                                onChange={(id) => setCommercialData(prev => ({ ...prev, preferred_carrier_id: id || '' }))}
                                                placeholder="Selecione..."
                                            />
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-sm font-medium text-gray-700">Região</label>
                                            <Input
                                                name="region_route"
                                                value={commercialData.region_route}
                                                onChange={handleCommercialChange}
                                            />
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        )}

                        <Card>
                            <CardHeaderStandard
                                icon={<MessageSquare className="w-5 h-5" />}
                                title="Observações Comerciais"
                            />
                            <CardContent>
                                <textarea
                                    name="notes_commercial"
                                    value={commercialData.notes_commercial}
                                    onChange={handleCommercialChange}
                                    rows={4}
                                    className="flex w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                                    placeholder="Informações adicionais sobre negociações..."
                                />
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* TAB FISCAL */}
                    <TabsContent value="fiscal" className="space-y-6 focus-visible:outline-none mt-0">
                        {/* Calculate Person Type (PF/PJ) dynamically */}
                        {(() => {
                            const cleanDoc = extractDigits(formData.document_number);
                            const isPJ = cleanDoc.length === 14;
                            const isPF = !isPJ;

                            return (
                                <>
                                    {/* Card 1: Regime e Perfil Fiscal */}
                                    <Card>
                                        <CardHeaderStandard
                                            icon={<FileText className="w-5 h-5" />}
                                            title="Regime e Perfil Fiscal"
                                        />
                                        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">

                                            {/* Tipo (Read-only) */}
                                            <div className="space-y-1.5">
                                                <label className="text-sm font-medium text-gray-700">Tipo de Pessoa</label>
                                                <Input
                                                    disabled
                                                    value={isPJ ? "Pessoa Jurídica" : "Pessoa Física"}
                                                    className="bg-gray-50"
                                                />
                                            </div>

                                            {/* PF Specific */}
                                            {isPF && (
                                                <div className="space-y-1.5 flex flex-col justify-center">
                                                    <label className="flex items-center gap-2 cursor-pointer mt-6">
                                                        <input
                                                            type="checkbox"
                                                            name="is_final_consumer"
                                                            checked={fiscalData.is_final_consumer}
                                                            onChange={handleFiscalChange}
                                                            className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500"
                                                        />
                                                        <span className="text-sm font-medium text-gray-700">Consumidor Final</span>
                                                    </label>
                                                </div>
                                            )}

                                            {/* PJ Specific Fields */}
                                            {isPJ && (
                                                <>
                                                    <div className="space-y-1.5">
                                                        <label className="text-sm font-medium text-gray-700">Regime Tributário</label>
                                                        <Select
                                                            name="tax_regime"
                                                            value={fiscalData.tax_regime}
                                                            onValueChange={(val) => setFiscalData(prev => ({ ...prev, tax_regime: val }))}
                                                        >
                                                            <SelectTrigger className="w-full">
                                                                <SelectValue placeholder="Selecione..." />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="Simples Nacional">Simples Nacional</SelectItem>
                                                                <SelectItem value="MEI">MEI</SelectItem>
                                                                <SelectItem value="Lucro Presumido">Lucro Presumido</SelectItem>
                                                                <SelectItem value="Lucro Real">Lucro Real</SelectItem>
                                                                <SelectItem value="Isento">Isento / Não se aplica</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>

                                                    <div className="space-y-1.5">
                                                        <label className="text-sm font-medium text-gray-700">Contribuinte ICMS</label>
                                                        <Select
                                                            name="icms_contributor"
                                                            value={fiscalData.icms_contributor}
                                                            onValueChange={(val) => {
                                                                // Auto-logic for IE Indicator
                                                                if (val === 'Isento') {
                                                                    setFiscalData(prev => ({ ...prev, icms_contributor: val, ie_indicator: 'exempt', is_ie_exempt: true, state_registration: "" }));
                                                                } else if (val === 'Não contribuinte') {
                                                                    setFiscalData(prev => ({ ...prev, icms_contributor: val, ie_indicator: 'non_contributor', is_ie_exempt: true, state_registration: "" }));
                                                                } else {
                                                                    setFiscalData(prev => ({ ...prev, icms_contributor: val, ie_indicator: 'contributor', is_ie_exempt: false }));
                                                                }
                                                            }}
                                                        >
                                                            <SelectTrigger className="w-full">
                                                                <SelectValue placeholder="Selecione..." />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="Contribuinte">Contribuinte</SelectItem>
                                                                <SelectItem value="Isento">Isento</SelectItem>
                                                                <SelectItem value="Não contribuinte">Não contribuinte</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>

                                                    <div className="space-y-1.5">
                                                        <label className="text-sm font-medium text-gray-700">Indicador de IE</label>
                                                        <Select
                                                            name="ie_indicator"
                                                            value={fiscalData.ie_indicator}
                                                            onValueChange={(val) => setFiscalData(prev => ({ ...prev, ie_indicator: val as any }))}
                                                            disabled={fiscalData.icms_contributor === 'Isento' || fiscalData.icms_contributor === 'Não contribuinte'}
                                                        >
                                                            <SelectTrigger className="w-full">
                                                                <SelectValue placeholder="Selecione..." />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="contributor">1 - Contribuinte ICMS</SelectItem>
                                                                <SelectItem value="exempt">2 - Contribuinte isento de IE</SelectItem>
                                                                <SelectItem value="non_contributor">9 - Não contribuinte</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>

                                                    <div className="col-span-1 md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                                                        <div className="mt-4">
                                                            <label className="flex items-center gap-2 cursor-pointer">
                                                                <input
                                                                    type="checkbox"
                                                                    name="is_public_agency"
                                                                    checked={fiscalData.is_public_agency}
                                                                    onChange={handleFiscalChange}
                                                                    className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500"
                                                                />
                                                                <span className="text-sm font-medium text-gray-700">Órgão Público</span>
                                                            </label>
                                                        </div>

                                                        <div className="mt-4">
                                                            <label className="flex items-center gap-2 cursor-pointer">
                                                                <input
                                                                    type="checkbox"
                                                                    name="is_final_consumer"
                                                                    checked={fiscalData.is_final_consumer}
                                                                    onChange={handleFiscalChange}
                                                                    className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500"
                                                                />
                                                                <span className="text-sm font-medium text-gray-700">Consumidor Final</span>
                                                            </label>
                                                        </div>
                                                    </div>

                                                    {fiscalData.is_public_agency && (
                                                        <>
                                                            <div className="space-y-1.5">
                                                                <label className="text-sm font-medium text-gray-700">Esfera</label>
                                                                <Select
                                                                    name="public_agency_sphere"
                                                                    value={fiscalData.public_agency_sphere}
                                                                    onValueChange={(val) => setFiscalData(prev => ({ ...prev, public_agency_sphere: val }))}
                                                                >
                                                                    <SelectTrigger className="w-full">
                                                                        <SelectValue placeholder="Selecione..." />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        <SelectItem value="Federal">Federal</SelectItem>
                                                                        <SelectItem value="Estadual">Estadual</SelectItem>
                                                                        <SelectItem value="Municipal">Municipal</SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                            </div>
                                                            <div className="space-y-1.5">
                                                                <label className="text-sm font-medium text-gray-700">Código UASG/UG</label>
                                                                <Input
                                                                    name="public_agency_code"
                                                                    value={fiscalData.public_agency_code}
                                                                    onChange={handleFiscalChange}
                                                                />
                                                            </div>
                                                        </>
                                                    )}
                                                </>
                                            )}
                                        </CardContent>
                                    </Card>

                                    {/* Card 2: Inscrições (PJ ONLY) */}
                                    {isPJ && (
                                        <Card>
                                            <CardHeaderStandard
                                                icon={<Receipt className="w-5 h-5" />}
                                                title="Inscrições"
                                            />
                                            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                                <div className="space-y-1.5">
                                                    <div className="flex justify-between items-center">
                                                        <label className="text-sm font-medium text-gray-700">Inscrição Estadual</label>
                                                        <label className="flex items-center gap-1.5 cursor-pointer">
                                                            <input
                                                                type="checkbox"
                                                                name="is_ie_exempt"
                                                                checked={fiscalData.is_ie_exempt}
                                                                onChange={(e) => {
                                                                    handleFiscalChange(e);
                                                                    if (e.target.checked) {
                                                                        setFiscalData(prev => ({ ...prev, state_registration: "" }));
                                                                    }
                                                                }}
                                                                disabled={fiscalData.icms_contributor === 'Isento' || fiscalData.icms_contributor === 'Não contribuinte'}
                                                                className="w-3 h-3 text-brand-600 rounded focus:ring-brand-500"
                                                            />
                                                            <span className="text-xs text-gray-600">Isento</span>
                                                        </label>
                                                    </div>
                                                    <Input
                                                        name="state_registration"
                                                        value={fiscalData.state_registration}
                                                        onChange={handleFiscalChange}
                                                        disabled={fiscalData.is_ie_exempt}
                                                    />
                                                </div>

                                                <div className="space-y-1.5">
                                                    <label className="text-sm font-medium text-gray-700">Inscrição Municipal</label>
                                                    <Input
                                                        name="municipal_registration"
                                                        value={fiscalData.municipal_registration}
                                                        onChange={handleFiscalChange}
                                                    />
                                                </div>

                                                <div className="space-y-1.5">
                                                    <label className="text-sm font-medium text-gray-700">SUFRAMA</label>
                                                    <Input
                                                        name="suframa"
                                                        value={fiscalData.suframa}
                                                        onChange={handleFiscalChange}
                                                    />
                                                </div>
                                            </CardContent>
                                        </Card>
                                    )}

                                    {/* Card 3: Preferências para NF-e */}
                                    {/* Show if Client, Supplier, Carrier. If Prospect ONLY, still show fields but optional? Logic says: If Prospect role (only): All fields optional. */}
                                    <Card>
                                        <CardHeaderStandard
                                            icon={<FileText className="w-5 h-5" />}
                                            title="Preferências para NF-e"
                                        />
                                        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">

                                            {/* Email: Show for Supplier, Carrier, Customer */}
                                            <div className="space-y-1.5">
                                                <label className="text-sm font-medium text-gray-700">E-mail para XML da NF-e</label>
                                                <Input
                                                    name="email_nfe"
                                                    value={fiscalData.email_nfe}
                                                    onChange={handleFiscalChange}
                                                    type="email"
                                                />
                                            </div>

                                            {/* Sales Only Fields */}


                                            <div className="col-span-1 md:col-span-2 space-y-1.5">
                                                <label className="text-sm font-medium text-gray-700">Observações Fiscais</label>
                                                <textarea
                                                    name="notes_fiscal"
                                                    value={fiscalData.notes_fiscal}
                                                    onChange={handleFiscalChange}
                                                    rows={3}
                                                    className="flex w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                                                />
                                            </div>
                                        </CardContent>
                                    </Card>
                                </>
                            );
                        })()}
                    </TabsContent>

                    {/* TAB CONTATS */}
                    <TabsContent value="contatos" className="space-y-6 focus-visible:outline-none mt-0">
                        <Card>
                            <CardHeaderStandard
                                icon={<Users className="w-5 h-5" />}
                                title="Contatos"
                            />
                            <CardContent>
                                <ContactsTable
                                    contacts={contacts}
                                    onAdd={(c) => setContacts(prev => [...prev, c])}
                                    onEdit={(id, c) => setContacts(prev => prev.map(item => item.id === id ? c : item))}
                                    onRemove={(id) => setContacts(prev => prev.filter(c => c.id !== id))}
                                />
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}
