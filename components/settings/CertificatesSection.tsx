"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Upload, Shield, X, CheckCircle2, Loader2, FileKey, Lock, Eye, EyeOff, AlertTriangle } from "lucide-react";

interface CertificatesSectionProps {
    companyId: string;
    onMessage: (message: { type: 'success' | 'warning' | 'error', text: string }) => void;
}

export function CertificatesSection({ companyId, onMessage }: CertificatesSectionProps) {
    // Certificate State
    const [certFile, setCertFile] = useState<File | null>(null);
    const [certUploading, setCertUploading] = useState(false);
    const [certUploadedAt, setCertUploadedAt] = useState<string | null>(null);

    // Password State
    const [certPassword, setCertPassword] = useState("");
    const [certPasswordSaving, setCertPasswordSaving] = useState(false);
    const [hasSavedPassword, setHasSavedPassword] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    // Certificate Upload Handler
    const handleCertUpload = async () => {
        if (!certFile) return;

        setCertUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', certFile);
            formData.append('companyId', companyId);

            const response = await fetch('/api/company/cert-a1/upload', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Erro ao fazer upload');
            }

            onMessage({ type: 'success', text: 'Certificado enviado com sucesso!' });
            setCertFile(null);
            setCertUploadedAt(data.uploadedAt);

        } catch (error: any) {
            onMessage({ type: 'error', text: error.message });
        } finally {
            setCertUploading(false);
        }
    };

    // Delete Certificate
    const handleCertDelete = async () => {
        if (!confirm('Tem certeza que deseja remover o certificado?')) return;

        try {
            const response = await fetch('/api/company/cert-a1/delete', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ companyId })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Erro ao deletar certificado');
            }

            setCertUploadedAt(null);
            onMessage({ type: 'success', text: 'Certificado removido com sucesso!' });

        } catch (error: any) {
            onMessage({ type: 'error', text: error.message });
        }
    };

    // Save Password
    const handlePasswordSave = async () => {
        if (!certPassword) {
            onMessage({ type: 'error', text: 'Digite uma senha' });
            return;
        }

        setCertPasswordSaving(true);
        try {
            const response = await fetch('/api/company/cert-a1/password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ companyId, password: certPassword })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Erro ao salvar senha');
            }

            setHasSavedPassword(true);
            setCertPassword("");
            onMessage({ type: 'success', text: 'Senha salva com segurança!' });

        } catch (error: any) {
            onMessage({ type: 'error', text: error.message });
        } finally {
            setCertPasswordSaving(false);
        }
    };

    // Delete Password
    const handlePasswordDelete = async () => {
        if (!confirm('Tem certeza que deseja remover a senha salva?')) return;

        try {
            const response = await fetch('/api/company/cert-a1/password', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ companyId })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Erro ao remover senha');
            }

            setHasSavedPassword(false);
            onMessage({ type: 'success', text: 'Senha removida!' });

        } catch (error: any) {
            onMessage({ type: 'error', text: error.message });
        }
    };

    // Handle Cert File Selection
    const handleCertFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setCertFile(file);
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Side: Status & Upload */}
            <div className="space-y-6">
                <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-1">Certificado Digital A1</h3>
                    <p className="text-sm text-gray-500">
                        Envie o arquivo .pfx ou .p12 para permitir a emissão de notas fiscais.
                    </p>
                </div>

                {/* Status Indicator */}
                {certUploadedAt ? (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <div className="flex items-start gap-4">
                            <div className="p-2 bg-green-100 rounded-full flex-shrink-0">
                                <Shield className="w-6 h-6 text-green-600" />
                            </div>
                            <div className="flex-1">
                                <h4 className="font-medium text-green-900">Certificado Ativo</h4>
                                <p className="text-sm text-green-700 mt-1">
                                    Enviado em {new Date(certUploadedAt).toLocaleDateString()}
                                </p>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleCertDelete}
                                    className="mt-3 text-red-600 hover:text-red-700 hover:bg-red-50 -ml-2 h-auto py-1 px-2"
                                >
                                    Remover certificado
                                </Button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 flex items-center gap-3">
                        <AlertTriangle className="w-5 h-5 text-gray-400" />
                        <p className="text-sm text-gray-600">
                            Nenhum certificado digital configurado.
                        </p>
                    </div>
                )}

                {/* Upload Area */}
                {!certUploadedAt && (
                    <div className="space-y-4">
                        <label className={`
                            relative border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-colors
                            ${certFile ? 'border-blue-300 bg-blue-50' : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'}
                        `}>
                            <input
                                type="file"
                                accept=".pfx,.p12"
                                onChange={handleCertFileChange}
                                disabled={certUploading}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                            />

                            <div className="w-12 h-12 bg-white border border-gray-200 rounded-lg flex items-center justify-center mb-4 shadow-sm">
                                <Upload className={`w-6 h-6 ${certFile ? 'text-blue-600' : 'text-gray-400'}`} />
                            </div>

                            {certFile ? (
                                <>
                                    <p className="font-medium text-blue-900">{certFile.name}</p>
                                    <p className="text-sm text-blue-700 mt-1">
                                        {(certFile.size / 1024).toFixed(2)} KB
                                    </p>
                                    <p className="text-xs text-blue-600 mt-2">Clique para alterar</p>
                                </>
                            ) : (
                                <>
                                    <p className="font-medium text-gray-900">Clique para selecionar o certificado</p>
                                    <p className="text-sm text-gray-500 mt-1">ou arraste o arquivo aqui</p>
                                    <p className="text-xs text-gray-400 mt-4">Formatos .pfx ou .p12</p>
                                </>
                            )}
                        </label>

                        {certFile && (
                            <Button
                                type="button"
                                onClick={handleCertUpload}
                                disabled={certUploading}
                                className="w-full"
                            >
                                {certUploading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Enviando Certificado...
                                    </>
                                ) : (
                                    <>
                                        <Upload className="w-4 h-4 mr-2" />
                                        Confirmar Upload
                                    </>
                                )}
                            </Button>
                        )}
                    </div>
                )}
            </div>

            {/* Right Side: Security & Password */}
            <div className="space-y-6">
                <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-1">Segurança</h3>
                    <p className="text-sm text-gray-500">
                        Gerencie a senha de acesso do certificado digital.
                    </p>
                </div>

                <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="bg-gray-50 p-4 border-b border-gray-200">
                        <div className="flex items-center gap-2">
                            <Lock className="w-5 h-5 text-gray-500" />
                            <h4 className="font-medium text-gray-900">Senha do Certificado</h4>
                        </div>
                    </div>

                    <div className="p-6 space-y-6">
                        {hasSavedPassword ? (
                            <div className="flex items-center justify-between p-4 bg-green-50 border border-green-100 rounded-lg">
                                <div className="flex items-center gap-3">
                                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                                    <div>
                                        <p className="font-medium text-green-900">Senha salva</p>
                                        <p className="text-xs text-green-700">O sistema pode emitir notas automaticamente.</p>
                                    </div>
                                </div>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={handlePasswordDelete}
                                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                >
                                    Remover
                                </Button>
                            </div>
                        ) : (
                            <div className="p-4 bg-yellow-50 border border-yellow-100 rounded-lg flex gap-3">
                                <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                                <div className="text-sm text-yellow-800">
                                    <p className="font-medium">Senha não configurada</p>
                                    <p className="mt-1">
                                        Sem a senha salva, será necessário informá-la manualmente a cada emissão de nota fiscal.
                                    </p>
                                </div>
                            </div>
                        )}

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">
                                    {hasSavedPassword ? 'Atualizar Senha' : 'Configurar Nova Senha'}
                                </label>
                                <div className="relative">
                                    <Input
                                        type={showPassword ? "text" : "password"}
                                        value={certPassword}
                                        onChange={(e) => setCertPassword(e.target.value)}
                                        placeholder={hasSavedPassword ? "Digite a nova senha para alterar" : "Senha do arquivo .pfx"}
                                        disabled={certPasswordSaving}
                                        className="pr-10"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 bg-transparent border-0 p-1"
                                    >
                                        {showPassword ? (
                                            <EyeOff className="w-4 h-4" />
                                        ) : (
                                            <Eye className="w-4 h-4" />
                                        )}
                                    </button>
                                </div>
                            </div>

                            <Button
                                type="button"
                                onClick={handlePasswordSave}
                                disabled={!certPassword || certPasswordSaving}
                                className="w-full"
                            >
                                {certPasswordSaving ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Salvando Senha...
                                    </>
                                ) : (
                                    <>
                                        <Lock className="w-4 h-4 mr-2" />
                                        {hasSavedPassword ? 'Atualizar Senha' : 'Salvar Senha'}
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
