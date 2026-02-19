"use client";

import { Input } from "@/components/ui/Input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { CardHeaderStandard } from "@/components/ui/CardHeaderStandard";
import { Search, Loader2, Upload, Trash2, MapPin, Phone, Building2, UserCircle, Image as ImageIcon, AlertTriangle, CheckCircle2 } from "lucide-react";
import { CompanySettings } from "@/lib/types/settings-types";
import { extractDigits, formatCNPJ } from "@/lib/cnpj";
import { useEffect, useState, useRef } from "react";
import { validateLogoFile } from "@/lib/upload-helpers";
import { useCompany } from "@/contexts/CompanyContext";
import { cn, toTitleCase } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";

interface TabIdentificationProps {
    data: Partial<CompanySettings>;
    onChange: (field: keyof CompanySettings, value: any) => void;
    isAdmin: boolean;
}

export function TabIdentification({ data, onChange, isAdmin }: TabIdentificationProps) {
    const { selectedCompany } = useCompany();
    const { toast } = useToast();
    const [loadingCnpj, setLoadingCnpj] = useState(false);
    const [loadingCep, setLoadingCep] = useState(false);

    // --- Logo Logic ---
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploadingLogo, setUploadingLogo] = useState(false);
    const [logoError, setLogoError] = useState<string | null>(null);
    const [isDragOver, setIsDragOver] = useState(false);
    const [logoSignedUrl, setLogoSignedUrl] = useState<string | null>(null);

    useEffect(() => {
        if (!selectedCompany || !data.logo_path) {
            setLogoSignedUrl(null);
            return;
        }

        let mounted = true;
        const loadSignedUrl = async () => {
            try {
                const response = await fetch('/api/company/logo/signed-url', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ companyId: selectedCompany.id })
                });
                if (!response.ok) {
                    if (mounted) setLogoSignedUrl(null);
                    return;
                }
                const payload = await response.json();
                if (mounted) setLogoSignedUrl(payload.signedUrl || null);
            } catch {
                if (mounted) setLogoSignedUrl(null);
            }
        };

        if (String(data.logo_path).startsWith('data:')) {
            setLogoSignedUrl(String(data.logo_path));
            return;
        }

        void loadSignedUrl();
        return () => { mounted = false; };
    }, [selectedCompany?.id, data.logo_path]);

    const processLogoUpload = async (file: File) => {
        if (!selectedCompany) return;

        const validation = validateLogoFile(file);
        if (!validation.valid) {
            setLogoError(validation.error || "Arquivo inválido");
            return;
        }

        setLogoError(null);
        setUploadingLogo(true);

        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('companyId', selectedCompany.id);

            const response = await fetch('/api/company/logo/upload', {
                method: 'POST',
                body: formData
            });

            const payload = await response.json();
            if (!response.ok) {
                throw new Error(payload.error || 'Erro ao enviar logo');
            }

            onChange('logo_path', payload.logoPath || null);
            setLogoSignedUrl(null);

        } catch (err: any) {
            setLogoError("Erro ao enviar logo: " + err.message);
        } finally {
            setUploadingLogo(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) await processLogoUpload(file);
    };

    const handleDragOver = (e: React.DragEvent) => {
        if (!isAdmin) return;
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        if (!isAdmin) return;
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
    };

    const handleDrop = async (e: React.DragEvent) => {
        if (!isAdmin) return;
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);

        const file = e.dataTransfer.files?.[0];
        if (file) await processLogoUpload(file);
    };

    const handleDeleteLogo = async () => {
        if (!selectedCompany) return;
        try {
            const response = await fetch('/api/company/logo/delete', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ companyId: selectedCompany.id })
            });
            const payload = await response.json();
            if (!response.ok) {
                throw new Error(payload.error || 'Erro ao remover logo');
            }
            onChange('logo_path', null);
            setLogoSignedUrl(null);
            setLogoError(null);
        } catch (err: any) {
            setLogoError("Erro ao remover logo: " + err.message);
        }
    };

    // --- Identification Logic ---
    const handleCnpjChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = formatCNPJ(e.target.value);
        onChange('cnpj', val);
    };

    const fetchCnpj = async () => {
        if (!data.cnpj) return;
        const digits = extractDigits(data.cnpj);
        if (digits.length !== 14) return;

        setLoadingCnpj(true);
        try {
            const res = await fetch(`/api/cnpj/${digits}`);
            if (!res.ok) throw new Error("Erro ao buscar CNPJ");
            const info = await res.json();

            // Auto-fill Identification (with Title Case)
            onChange('legal_name', toTitleCase(info.legal_name || data.legal_name));
            onChange('trade_name', toTitleCase(info.trade_name || data.trade_name));

            // Map Split CNAE
            onChange('cnae_code', info.cnae_code || data.cnae_code);
            onChange('cnae_description', toTitleCase(info.cnae_description || data.cnae_description));

            // Auto-fill Address (with Title Case)
            if (info.address) {
                // Populate ZIP field
                if (info.address.zip) {
                    const zipDigits = info.address.zip.toString().replace(/\D/g, '');
                    const formattedZip = zipDigits.length === 8
                        ? `${zipDigits.substring(0, 5)}-${zipDigits.substring(5, 8)}`
                        : zipDigits;
                    onChange('address_zip', formattedZip);

                    // Fetch details to get IBGE code
                    await fetchCep(zipDigits);
                }

                // Overwrite with CNPJ data if specific fields are present (CNPJ data usually more accurate for legal address than generic CEP)
                // However, fetchCep already sets street, neighborhood, city, state, ibge.
                // We just need to ensure Number and Complement are set from CNPJ info
                onChange('address_number', info.address.number);
                onChange('address_complement', toTitleCase(info.address.complement));

                // Fallbacks if fetchCep failed or if CNPJ has specific data we want to respect??
                // Actually, let's trust CNPJ data for basics, but fetchCep is CRITICAL for IBGE.
                // fetchCep sets: street, neighborhood, city, state, ibge.
                // So calling it first is good. Then we overlay number/complement.
            }

            // Auto-fill Contacts (if available)
            if (info.email) onChange('email', info.email);
            if (info.phone) onChange('phone', info.phone);

        } catch (e: any) {
            console.warn("CNPJ Fetch Warning:", e); // warn doesn't trigger overlay
            toast({
                title: "Erro ao buscar CNPJ",
                description: e.message || "Não foi possível buscar os dados.",
                variant: "destructive"
            });
        } finally {
            setLoadingCnpj(false);
        }
    };

    // --- Address Logic ---
    const handleZipChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        // Simple mask 00000-000
        let val = e.target.value.replace(/\D/g, '');
        if (val.length > 5) {
            val = val.substring(0, 5) + '-' + val.substring(5, 8);
        }
        onChange('address_zip', val);

        // Auto fetch if complete
        if (val.length === 9) {
            // We can optionally auto-fetch here, but sticking to button UX is safer if user prefers manual
        }
    };

    const fetchCep = async (zip: string) => {
        const cleanZip = zip.replace(/\D/g, '');

        if (cleanZip.length !== 8) {
            toast({
                title: "CEP Inválido",
                description: "O CEP deve conter 8 números.",
                variant: "destructive"
            });
            return;
        }

        setLoadingCep(true);
        try {
            const res = await fetch(`https://viacep.com.br/ws/${cleanZip}/json/`);
            if (!res.ok) throw new Error("Erro ao buscar CEP");
            const info = await res.json();

            if (info.erro) {
                toast({
                    title: "CEP não encontrado",
                    description: "Verifique o CEP digitado.",
                    variant: "destructive"
                });
                return;
            }

            onChange('address_street', toTitleCase(info.logradouro));
            onChange('address_neighborhood', toTitleCase(info.bairro));
            onChange('address_city', toTitleCase(info.localidade));
            onChange('address_state', info.uf?.toUpperCase());
            onChange('city_code_ibge', info.ibge);

            toast({
                title: "Endereço encontrado",
                description: "Os campos foram preenchidos.",
            });

        } catch (e: any) {
            console.error(e);
            toast({
                title: "Erro na busca",
                description: e.message || "Não foi possível buscar o CEP.",
                variant: "destructive"
            });
        } finally {
            setLoadingCep(false);
        }
    };

    return (
        <div className="space-y-6">

            {/* Identification Section */}
            <Card>
                <CardHeaderStandard
                    icon={<Building2 className="w-5 h-5" />}
                    title="Identificação da Empresa"
                />

                <CardContent>
                    <div className="flex flex-col lg:flex-row gap-8">
                        {/* Left Column: Logo */}
                        <div className="w-full lg:w-auto flex flex-col items-center lg:items-start gap-4">
                            <span className="text-sm font-medium text-gray-700 lg:hidden">Logo da Empresa</span>

                            <div
                                className={cn(
                                    "relative w-40 h-40 flex items-center justify-center bg-white rounded-2xl border-2 border-dashed overflow-hidden shrink-0 group transition-all",
                                    isDragOver
                                        ? "border-brand-500 bg-brand-50/50 scale-[1.02]"
                                        : "border-gray-300 hover:border-brand-500"
                                )}
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                            >
                                {data.logo_path ? (
                                    <>
                                        <img
                                            src={logoSignedUrl || ''}
                                            alt="Logo"
                                            className="absolute inset-0 w-full h-full object-contain p-2"
                                        />
                                        {isAdmin && (
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                <Button
                                                    variant="danger"
                                                    size="sm"
                                                    onClick={handleDeleteLogo}
                                                    className="h-9 w-9 p-0 rounded-2xl"
                                                >
                                                    <Trash2 className="w-5 h-5" />
                                                </Button>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="text-gray-300 flex flex-col items-center gap-2">
                                        <ImageIcon className="w-10 h-10" />
                                        <span className="text-xs text-gray-400 font-medium">Sem logo</span>
                                    </div>
                                )}
                            </div>

                            {isAdmin && (
                                <div className="w-full max-w-40 flex flex-col gap-2">
                                    <input
                                        type="file"
                                        accept="image/png, image/jpeg, image/svg+xml"
                                        className="hidden"
                                        ref={fileInputRef}
                                        onChange={handleLogoChange}
                                    />
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={uploadingLogo}
                                        className="w-full"
                                    >
                                        {uploadingLogo ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                                        {uploadingLogo ? "Enviando..." : "Carregar Logo"}
                                    </Button>
                                    <p className="text-[10px] text-gray-500 text-center leading-tight">
                                        PNG, JPG ou SVG até 2MB.
                                    </p>
                                    {logoError && (
                                        <p className="text-[10px] text-red-600 bg-red-50 p-1.5 rounded border border-red-100 leading-tight">
                                            {logoError}
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Right Column: Fields */}
                        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-6 content-start">
                            {/* Row 1 */}
                            <div className="md:col-span-4 space-y-1.5">
                                <label className="text-sm font-medium text-gray-700">CNPJ <span className="text-red-500">*</span></label>
                                <div className="flex gap-2">
                                    <Input
                                        value={data.cnpj || ''}
                                        onChange={handleCnpjChange}
                                        onBlur={fetchCnpj}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                fetchCnpj();
                                            }
                                        }}
                                        placeholder="00.000.000/0000-00"
                                        disabled={!isAdmin}
                                        maxLength={18}
                                    />
                                    {isAdmin && (
                                        <Button
                                            variant="secondary"
                                            onClick={fetchCnpj}
                                            className="px-3 shrink-0"
                                            disabled={loadingCnpj || extractDigits(data.cnpj || '').length !== 14}
                                            title="Buscar dados do CNPJ"
                                        >
                                            {loadingCnpj ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                                        </Button>
                                    )}
                                </div>
                            </div>

                            <div className="md:col-span-4 space-y-1.5">
                                <label className="text-sm font-medium text-gray-700">Inscrição Estadual</label>
                                <div className="flex gap-2 items-center">
                                    <Input
                                        value={data.ie || ''}
                                        onChange={e => onChange('ie', e.target.value)}
                                        disabled={!isAdmin || data.ie === 'ISENTO'}
                                        className="flex-1"
                                    />
                                    <div className="flex items-center space-x-2 shrink-0">
                                        <input
                                            type="checkbox"
                                            id="ie_isento"
                                            checked={data.ie === 'ISENTO'}
                                            onChange={(e) => {
                                                if (e.target.checked) onChange('ie', 'ISENTO');
                                                else onChange('ie', '');
                                            }}
                                            disabled={!isAdmin}
                                            className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                                        />
                                        <label htmlFor="ie_isento" className="text-sm font-medium text-gray-700 select-none cursor-pointer">Isento</label>
                                    </div>
                                </div>
                            </div>

                            <div className="md:col-span-4 space-y-1.5">
                                <label className="text-sm font-medium text-gray-700">Regime Tributário <span className="text-red-500">*</span></label>
                                <Select
                                    value={data.tax_regime || ''}
                                    onValueChange={v => onChange('tax_regime', v)}
                                    disabled={!isAdmin}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecione..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="simples_nacional">Simples Nacional</SelectItem>
                                        <SelectItem value="lucro_presumido">Lucro Presumido</SelectItem>
                                        <SelectItem value="lucro_real">Lucro Real</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Row 2 */}
                            <div className="md:col-span-6 space-y-1.5">
                                <label className="text-sm font-medium text-gray-700">Razão Social <span className="text-red-500">*</span></label>
                                <Input
                                    value={data.legal_name || ''}
                                    onChange={e => onChange('legal_name', toTitleCase(e.target.value))}
                                    disabled={!isAdmin}
                                />
                            </div>

                            <div className="md:col-span-6 space-y-1.5">
                                <label className="text-sm font-medium text-gray-700">Nome Fantasia <span className="text-red-500">*</span></label>
                                <Input
                                    value={data.trade_name || ''}
                                    onChange={e => onChange('trade_name', toTitleCase(e.target.value))}
                                    disabled={!isAdmin}
                                />
                            </div>

                            <div className="md:col-span-2 space-y-1.5">
                                <label className="text-sm font-medium text-gray-700">CNAE Principal</label>
                                <Input
                                    value={data.cnae_code || ''}
                                    onChange={e => onChange('cnae_code', e.target.value)}
                                    disabled={!isAdmin}
                                    placeholder="0000-0/00"
                                    title="Código CNAE"
                                />
                            </div>
                            <div className="md:col-span-6 space-y-1.5">
                                <label className="text-sm font-medium text-gray-700">Descrição CNAE</label>
                                <Input
                                    value={data.cnae_description || ''}
                                    onChange={e => onChange('cnae_description', toTitleCase(e.target.value))}
                                    disabled={!isAdmin}
                                    placeholder="Descrição da atividade"
                                />
                            </div>

                            <div className="md:col-span-4 space-y-1.5">
                                <label className="text-sm font-medium text-gray-700">Inscrição Municipal</label>
                                <Input
                                    value={data.im || ''}
                                    onChange={e => onChange('im', e.target.value)}
                                    disabled={!isAdmin}
                                />
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Address Section */}
            <Card>
                <CardHeaderStandard
                    icon={<MapPin className="w-5 h-5" />}
                    title="Endereço Fiscal (Matriz)"
                />

                <CardContent className="grid grid-cols-1 md:grid-cols-12 gap-6">
                    <div className="md:col-span-12 mb-2">
                        <div className={cn("rounded-2xl border p-4 flex items-start gap-3", data.city_code_ibge ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200")}>
                            {data.city_code_ibge ? <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" /> : <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />}
                            <div>
                                <h4 className={cn("text-sm font-semibold", data.city_code_ibge ? "text-green-800" : "text-red-800")}>
                                    {data.city_code_ibge ? "Endereço Válido para NF-e" : "Atenção: Endereço Incompleto"}
                                </h4>
                                <p className={cn("text-xs mt-1", data.city_code_ibge ? "text-green-700" : "text-red-700")}>
                                    {data.city_code_ibge
                                        ? `Código IBGE ${data.city_code_ibge} identificado com sucesso.`
                                        : "Não foi possível identificar o código IBGE. Verifique o CEP e a Cidade."}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="md:col-span-3 space-y-1.5">
                        <label className="text-sm font-medium text-gray-700">CEP <span className="text-red-500">*</span></label>
                        <div className="flex gap-2">
                            <Input
                                value={data.address_zip || ''}
                                onChange={handleZipChange}
                                placeholder="00000-000"
                                maxLength={9}
                                disabled={!isAdmin}
                            />
                            {isAdmin && (
                                <Button
                                    type="button"
                                    variant="secondary"
                                    onClick={() => fetchCep(data.address_zip || '')}
                                    disabled={loadingCep}
                                    className="px-3 shrink-0"
                                >
                                    {loadingCep ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                                </Button>
                            )}
                        </div>
                    </div>
                    <div className="md:col-span-6 space-y-1.5">
                        <label className="text-sm font-medium text-gray-700">Logradouro <span className="text-red-500">*</span></label>
                        <Input
                            value={data.address_street || ''}
                            onChange={e => onChange('address_street', toTitleCase(e.target.value))}
                            disabled={!isAdmin}
                        />
                    </div>
                    <div className="md:col-span-3 space-y-1.5">
                        <label className="text-sm font-medium text-gray-700">Número <span className="text-red-500">*</span></label>
                        <Input
                            value={data.address_number || ''}
                            onChange={e => onChange('address_number', e.target.value)}
                            disabled={!isAdmin}
                        />
                    </div>

                    <div className="md:col-span-4 space-y-1.5">
                        <label className="text-sm font-medium text-gray-700">Complemento</label>
                        <Input
                            value={data.address_complement || ''}
                            onChange={e => onChange('address_complement', toTitleCase(e.target.value))}
                            disabled={!isAdmin}
                        />
                    </div>
                    <div className="md:col-span-3 space-y-1.5">
                        <label className="text-sm font-medium text-gray-700">Bairro <span className="text-red-500">*</span></label>
                        <Input
                            value={data.address_neighborhood || ''}
                            onChange={e => onChange('address_neighborhood', toTitleCase(e.target.value))}
                            disabled={!isAdmin}
                        />
                    </div>
                    <div className="md:col-span-3 space-y-1.5">
                        <label className="text-sm font-medium text-gray-700">Cidade <span className="text-red-500">*</span></label>
                        <Input
                            value={data.address_city || ''}
                            onChange={e => onChange('address_city', toTitleCase(e.target.value))}
                            disabled={!isAdmin}
                        />
                    </div>
                    <div className="md:col-span-2 space-y-1.5">
                        <label className="text-sm font-medium text-gray-700">UF <span className="text-red-500">*</span></label>
                        <Input
                            value={data.address_state || ''}
                            onChange={e => onChange('address_state', e.target.value.toUpperCase())}
                            disabled={!isAdmin}
                            maxLength={2}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Contacts Section */}
            <Card>
                <CardHeaderStandard
                    icon={<UserCircle className="w-5 h-5" />}
                    title="Contatos"
                />
                <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-gray-700">Telefone</label>
                        <Input
                            value={data.phone || ''}
                            onChange={e => onChange('phone', e.target.value)}
                            disabled={!isAdmin}
                            placeholder="(00) 0000-0000"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-gray-700">WhatsApp</label>
                        <Input
                            value={data.whatsapp || ''}
                            onChange={e => onChange('whatsapp', e.target.value)}
                            disabled={!isAdmin}
                            placeholder="(00) 00000-0000"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-gray-700">E-mail</label>
                        <Input
                            type="email"
                            value={data.email || ''}
                            onChange={e => onChange('email', e.target.value)}
                            disabled={!isAdmin}
                            placeholder="contato@empresa.com.br"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-gray-700">Site</label>
                        <Input
                            value={data.website || ''}
                            onChange={e => onChange('website', e.target.value)}
                            disabled={!isAdmin}
                            placeholder="www.empresa.com.br"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-gray-700">Instagram</label>
                        <Input
                            value={data.instagram || ''}
                            onChange={e => onChange('instagram', e.target.value)}
                            disabled={!isAdmin}
                            placeholder="@empresa"
                        />
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
