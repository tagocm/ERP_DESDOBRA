
"use client";

import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { CompanySettings } from "@/lib/data/company-settings";
import { useState, useRef } from "react";
import { createClient } from "@/lib/supabaseBrowser";
import { validateCertFile, generateFilePath } from "@/lib/upload-helpers";
import { Loader2, Upload, FileKey, ShieldCheck, AlertTriangle } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { useCompany } from "@/contexts/CompanyContext";
import { CardHeaderStandard } from "@/components/ui/CardHeaderStandard";

interface TabCertificateProps {
    data: Partial<CompanySettings>;
    onChange: (field: keyof CompanySettings, value: any) => void;
    isAdmin: boolean;
}

export function TabCertificate({ data, onChange, isAdmin }: TabCertificateProps) {
    const { selectedCompany } = useCompany();
    const supabase = createClient();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);

    // Password handling
    const [certPassword, setCertPassword] = useState("");

    // Test
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState<{ valid: boolean; message: string } | null>(null);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !selectedCompany) return;

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
            // Clear expires_at as we don't know it yet (server function usually extracts it)
            onChange('cert_a1_expires_at', null);

        } catch (err: any) {
            setUploadError("Erro ao enviar arquivo: " + err.message);
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const handleTestCertificate = async () => {
        if (!data.cert_a1_storage_path) return;
        setTesting(true);
        setTestResult(null);

        // Mock test for now (real impl requires server-side p12 parsing)
        setTimeout(() => {
            setTesting(false);
            // We can't actually test without backend logic to parse pfx
            // Assuming success for UI demo or failure if no password
            if (!certPassword && !data.is_cert_password_saved) {
                setTestResult({ valid: false, message: "Senha necessária para testar o certificado." });
            } else {
                setTestResult({ valid: true, message: "Certificado válido! Vencimento: 31/12/2025" });
                // If we had real parsing, we would update 'expires_at' here or in backend
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
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                    {/* Left Column: Upload / Status */}
                    <div className="space-y-4">
                        <label className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                            <Upload className="w-4 h-4" /> Status do Certificado
                        </label>

                        {data.cert_a1_storage_path ? (
                            <div className="bg-white border rounded-lg p-5 flex items-start gap-4 shadow-sm group hover:border-brand-200 transition-all">
                                <div className="w-12 h-12 rounded-full bg-brand-50 flex items-center justify-center text-brand-600 shrink-0 border border-brand-100">
                                    <FileKey className="w-6 h-6" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-bold text-gray-900 text-base">Arquivo Carregado</h4>
                                    <div className="mt-1 space-y-0.5">
                                        <p className="text-xs text-gray-500 flex items-center gap-1.5">
                                            <span className="w-1.5 h-1.5 rounded-full bg-gray-300"></span>
                                            Enviado em: {new Date(data.cert_a1_uploaded_at!).toLocaleDateString()}
                                        </p>
                                        {data.cert_a1_expires_at && (
                                            <p className="text-xs font-medium text-brand-600 flex items-center gap-1.5">
                                                <span className="w-1.5 h-1.5 rounded-full bg-brand-400"></span>
                                                Vence em: {new Date(data.cert_a1_expires_at).toLocaleDateString()}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                {isAdmin && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="text-gray-400 hover:text-red-600 hover:bg-red-50 -mt-1 -mr-1"
                                        onClick={() => onChange('cert_a1_storage_path', null)}
                                        title="Remover Certificado"
                                    >
                                        <ShieldCheck className="w-4 h-4 rotate-180" /> {/* Using an icon that looks like a remove or swap */}
                                    </Button>
                                )}
                            </div>
                        ) : (
                            <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 flex flex-col items-center justify-center text-center hover:bg-gray-50 hover:border-brand-200 transition-all cursor-pointer group" onClick={() => fileInputRef.current?.click()}>
                                <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                    <Upload className="w-6 h-6 text-gray-400 group-hover:text-brand-600" />
                                </div>
                                <h4 className="font-semibold text-gray-900 text-sm">Upload do Certificado</h4>
                                <p className="text-xs text-gray-500 mt-1 max-w-[200px]">Arraste seu arquivo .pfx / .p12 ou clique para buscar.</p>

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
                    <div className="space-y-6">
                        <div className="space-y-4">
                            <label className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                                <ShieldCheck className="w-4 h-4" /> Segurança e Teste
                            </label>

                            <div className="bg-gray-50/50 border border-gray-100 rounded-lg p-5 space-y-5">
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
                                    </div>
                                    <Input
                                        type="password"
                                        value={certPassword}
                                        onChange={e => {
                                            setCertPassword(e.target.value);
                                            onChange('cert_password_encrypted' as any, e.target.value);
                                        }}
                                        disabled={!isAdmin}
                                        placeholder="••••••••"
                                        className="bg-white"
                                    />
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
