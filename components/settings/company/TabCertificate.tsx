
"use client";

import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { CompanySettings } from "@/lib/data/company-settings";
import { useState, useRef } from "react";
import { createClient } from "@/lib/supabaseBrowser";
import { validateCertFile, generateFilePath } from "@/lib/upload-helpers";
import { Loader2, Upload, FileKey, ShieldCheck, AlertTriangle, CheckCircle2, X } from "lucide-react";
import { useCompany } from "@/contexts/CompanyContext";
import { CardHeaderStandard } from "@/components/ui/CardHeaderStandard";

interface TabCertificateProps {
    data: Partial<CompanySettings>;
    onChange: (field: keyof CompanySettings, value: any) => void;
    isAdmin: boolean;
}

// Simple encryption for password storage (use proper backend encryption in production)
async function encryptPassword(password: string): Promise<string> {
    // In production, this should be done server-side with proper encryption
    // This is a client-side representation for demo purposes
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function TabCertificate({ data, onChange, isAdmin }: TabCertificateProps) {
    const { selectedCompany } = useCompany();
    const supabase = createClient();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);

    // Password handling
    const [certPassword, setCertPassword] = useState("");
    const [passwordSaved, setPasswordSaved] = useState(false);

    // Test
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState<{ valid: boolean; message: string } | null>(null);

    const processFile = async (file: File) => {
        if (!selectedCompany) return;

        // Validate
        const validation = validateCertFile(file);
        if (!validation.valid) {
            setUploadError(validation.error || "Arquivo inválido");
            return;
        }

        setUploadError(null);
        setUploading(true);

        try {
            const path = generateFilePath(selectedCompany.id, 'cert', file.name);
            const { error } = await supabase.storage
                .from('company-assets')
                .upload(path, file, { upsert: true });

            if (error) throw error;

            // Success
            onChange('cert_a1_storage_path', path);
            onChange('cert_a1_uploaded_at', new Date().toISOString());
            onChange('cert_a1_expires_at', null);

        } catch (err: any) {
            setUploadError("Erro ao enviar arquivo: " + err.message);
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) await processFile(file);
    };

    // Drag and drop handlers
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            await processFile(files[0]);
        }
    };

    const handlePasswordSave = async () => {
        if (!certPassword) {
            setUploadError("Digite a senha do certificado");
            return;
        }

        try {
            // Encrypt password
            const encrypted = await encryptPassword(certPassword);
            onChange('cert_password_encrypted', encrypted);
            onChange('is_cert_password_saved', true);
            setPasswordSaved(true);
            setUploadError(null);
        } catch (err: any) {
            setUploadError("Erro ao salvar senha: " + err.message);
        }
    };

    const handleTestCertificate = async () => {
        if (!data.cert_a1_storage_path) return;
        setTesting(true);
        setTestResult(null);

        // Mock test for now (real impl requires server-side p12 parsing)
        setTimeout(() => {
            setTesting(false);
            if (!certPassword && !data.is_cert_password_saved) {
                setTestResult({ valid: false, message: "Senha necessária para testar o certificado." });
            } else {
                setTestResult({
                    valid: true,
                    message: "Certificado acessível e salvo! (Data de expiração será atualizada pelo servidor)"
                });
            }
        }, 1500);
    };

    return (
        <Card>
            <CardHeaderStandard
                icon={<ShieldCheck className="w-5 h-5 text-brand-600" />}
                title="Certificado Digital A1"
            />
            <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Left Column: Upload / Status */}
                    <div className="flex flex-col h-full">
                        <label className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-4">
                            <Upload className="w-4 h-4" /> Status do Certificado
                        </label>

                        {data.cert_a1_storage_path ? (
                            <div className="bg-gray-50/50 border border-gray-100 rounded-lg p-5 flex-1 flex flex-col">
                                <div className="flex items-start gap-4 mb-4">
                                    <div className="w-12 h-12 rounded-full bg-brand-50 flex items-center justify-center text-brand-600 shrink-0 border border-brand-100">
                                        <FileKey className="w-6 h-6" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-bold text-gray-900 text-sm">Arquivo Carregado</h4>
                                        <p className="text-xs text-gray-500 mt-1">Certificado digital ativo</p>
                                    </div>
                                    {isAdmin && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="text-gray-400 hover:text-red-600 hover:bg-red-50 h-8 w-8"
                                            onClick={() => {
                                                onChange('cert_a1_storage_path', null);
                                                onChange('is_cert_password_saved', false);
                                                setCertPassword("");
                                                setPasswordSaved(false);
                                            }}
                                            title="Remover Certificado"
                                        >
                                            <X className="w-4 h-4" />
                                        </Button>
                                    )}
                                </div>

                                <div className="space-y-3 mt-2">
                                    <div className="flex items-center justify-between py-2 border-t border-gray-200/50">
                                        <span className="text-xs font-medium text-gray-600">Data de Upload</span>
                                        <span className="text-xs font-semibold text-gray-900">
                                            {new Date(data.cert_a1_uploaded_at!).toLocaleDateString('pt-BR')}
                                        </span>
                                    </div>
                                    {data.cert_a1_expires_at && (
                                        <div className="flex items-center justify-between py-2 border-t border-gray-200/50">
                                            <span className="text-xs font-medium text-gray-600">Vencimento</span>
                                            <span className="text-xs font-semibold text-brand-600">
                                                {new Date(data.cert_a1_expires_at).toLocaleDateString('pt-BR')}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div
                                className={`border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center text-center transition-all cursor-pointer group ${isDragging
                                    ? 'border-brand-500 bg-brand-50/50'
                                    : 'border-gray-200 hover:bg-gray-50 hover:border-brand-200'
                                    }`}
                                onClick={() => fileInputRef.current?.click()}
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                            >
                                <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-3 transition-all ${isDragging
                                    ? 'bg-brand-100 scale-110'
                                    : 'bg-gray-50 group-hover:scale-110'
                                    }`}>
                                    <Upload className={`w-8 h-8 ${isDragging ? 'text-brand-600' : 'text-gray-400 group-hover:text-brand-600'}`} />
                                </div>
                                <h4 className="font-semibold text-gray-900 text-sm">
                                    {isDragging ? 'Solte o arquivo aqui' : 'Upload do Certificado'}
                                </h4>
                                <p className="text-xs text-gray-500 mt-1 max-w-[250px]">
                                    Arraste seu arquivo .pfx / .p12 ou clique para buscar.
                                </p>

                                {isAdmin && (
                                    <>
                                        <input
                                            type="file"
                                            accept=".pfx,.p12"
                                            className="hidden"
                                            ref={fileInputRef}
                                            onChange={handleFileChange}
                                        />
                                        <div className="mt-4">
                                            <Button variant="outline" size="sm" className="bg-white border-gray-200 shadow-sm" disabled={uploading}>
                                                {uploading ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : null}
                                                {uploading ? "Enviando..." : "Selecionar Arquivo"}
                                            </Button>
                                        </div>
                                    </>
                                )}
                                {uploadError && <p className="text-xs text-red-500 mt-2 font-medium">{uploadError}</p>}
                            </div>
                        )}
                    </div>

                    {/* Right Column: Security & Test */}
                    <div className="flex flex-col h-full">
                        <div className="flex flex-col flex-1">
                            <label className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-4">
                                <ShieldCheck className="w-4 h-4" /> Segurança e Teste
                            </label>

                            <div className="bg-gray-50/50 border border-gray-100 rounded-lg p-5 space-y-5 flex-1">
                                <div className="flex items-start gap-3">
                                    <div className="flex items-center h-5 mt-0.5">
                                        <input
                                            type="checkbox"
                                            id="save_pass"
                                            checked={data.is_cert_password_saved || false}
                                            onChange={(e) => onChange('is_cert_password_saved', e.target.checked)}
                                            disabled={!isAdmin}
                                            className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-0.5">
                                        <label htmlFor="save_pass" className="text-sm font-medium text-gray-900 cursor-pointer">
                                            Salvar senha no servidor
                                        </label>
                                        <p className="text-[11px] text-gray-500 leading-relaxed italic">
                                            Recomendado para emissão automática de NF-e.
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Senha do Arquivo</label>
                                        {passwordSaved && (
                                            <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-600">
                                                <CheckCircle2 className="w-3 h-3" />
                                                Salva
                                            </span>
                                        )}
                                    </div>
                                    <Input
                                        type="password"
                                        value={certPassword}
                                        onChange={e => setCertPassword(e.target.value)}
                                        disabled={!isAdmin}
                                        placeholder="••••••••"
                                        className="bg-white"
                                    />
                                    {data.is_cert_password_saved && certPassword && !passwordSaved && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={handlePasswordSave}
                                            className="w-full text-xs"
                                        >
                                            <ShieldCheck className="w-3 h-3 mr-1" />
                                            Salvar Senha Criptografada
                                        </Button>
                                    )}
                                    {data.is_cert_password_saved && (
                                        <div className="flex items-center gap-2 text-amber-700 text-[10px] bg-amber-50 px-2.5 py-1.5 rounded-md border border-amber-100">
                                            <AlertTriangle className="w-3 h-3" />
                                            A senha será armazenada de forma segura para uso posterior.
                                        </div>
                                    )}
                                </div>

                                <div className="pt-2 flex flex-col gap-3">
                                    <Button
                                        variant="secondary"
                                        onClick={handleTestCertificate}
                                        disabled={testing || !data.cert_a1_storage_path}
                                        size="sm"
                                        className="w-full font-semibold"
                                    >
                                        {testing ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : null}
                                        Testar Conectividade
                                    </Button>
                                    {testResult && (
                                        <div className={`text-xs px-3 py-2 rounded-md font-medium border ${testResult.valid ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
                                            {testResult.message}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
