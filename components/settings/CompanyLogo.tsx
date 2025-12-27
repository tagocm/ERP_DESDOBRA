"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Upload, X, Loader2, Image as ImageIcon } from "lucide-react";

interface CompanyLogoProps {
    companyId: string;
    onMessage: (message: { type: 'success' | 'warning' | 'error', text: string }) => void;
}

export function CompanyLogo({ companyId, onMessage }: CompanyLogoProps) {
    // Logo State
    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [logoUrl, setLogoUrl] = useState<string | null>(null);
    const [logoUploading, setLogoUploading] = useState(false);
    const [logoPreview, setLogoPreview] = useState<string | null>(null);

    // Load logo on mount
    useEffect(() => {
        if (companyId) {
            fetchLogoUrl();
        }
    }, [companyId]);

    // Handle Logo File Selection
    const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setLogoFile(file);
            // Create preview
            const reader = new FileReader();
            reader.onloadend = () => {
                setLogoPreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    // Logo Upload Handler
    const handleLogoUpload = async () => {
        if (!logoFile) return;

        setLogoUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', logoFile);
            formData.append('companyId', companyId);

            const response = await fetch('/api/company/logo/upload', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Erro ao fazer upload');
            }

            onMessage({ type: 'success', text: 'Logo enviado com sucesso!' });
            setLogoFile(null);
            setLogoPreview(null);
            await fetchLogoUrl(); // Refresh URL

        } catch (error: any) {
            onMessage({ type: 'error', text: error.message });
        } finally {
            setLogoUploading(false);
        }
    };

    // Fetch Logo URL
    const fetchLogoUrl = async () => {
        try {
            const response = await fetch('/api/company/logo/signed-url', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ companyId })
            });

            if (response.ok) {
                const data = await response.json();
                setLogoUrl(data.signedUrl);
            }
        } catch (error) {
            console.error('Error fetching logo URL:', error);
        }
    };

    // Delete Logo
    const handleLogoDelete = async () => {
        if (!confirm('Tem certeza que deseja remover o logo?')) return;

        try {
            const response = await fetch('/api/company/logo/delete', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ companyId })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Erro ao deletar logo');
            }

            setLogoUrl(null);
            onMessage({ type: 'success', text: 'Logo removido com sucesso!' });

        } catch (error: any) {
            onMessage({ type: 'error', text: error.message });
        }
    };

    return (
        <Card className="overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
                <CardTitle className="flex items-center gap-2 text-lg">
                    <div className="p-2 bg-blue-100 rounded-lg">
                        <ImageIcon className="w-5 h-5 text-blue-600" />
                    </div>
                    Logo da Empresa
                </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
                {/* Logo Preview */}
                <div className="mb-6">
                    <div className="relative w-full aspect-video bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden group">
                        {(logoUrl || logoPreview) ? (
                            <>
                                <img
                                    src={logoPreview || logoUrl || ''}
                                    alt="Logo"
                                    className="max-w-full max-h-full object-contain p-4"
                                />
                                {logoUrl && (
                                    <button
                                        type="button"
                                        onClick={handleLogoDelete}
                                        className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                                        title="Remover logo"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                )}
                            </>
                        ) : (
                            <div className="text-center p-6">
                                <ImageIcon className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                                <p className="text-sm text-gray-500">Nenhum logo enviado</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Upload Form */}
                <div className="space-y-3">
                    <label className="block">
                        <span className="text-sm font-medium text-gray-700 mb-2 block">
                            Selecionar novo logo
                        </span>
                        <Input
                            type="file"
                            accept=".png,.jpg,.jpeg,.svg,.webp"
                            onChange={handleLogoFileChange}
                            disabled={logoUploading}
                            className="cursor-pointer"
                        />
                    </label>
                    <p className="text-xs text-gray-500">
                        Formatos aceitos: PNG, JPG, SVG ou WebP • Tamanho máximo: 5MB
                    </p>

                    {logoFile && (
                        <Button
                            type="button"
                            onClick={handleLogoUpload}
                            disabled={logoUploading}
                            className="w-full"
                        >
                            {logoUploading ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Enviando...
                                </>
                            ) : (
                                <>
                                    <Upload className="w-4 h-4 mr-2" />
                                    Fazer Upload
                                </>
                            )}
                        </Button>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
