
"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Globe, Clock, DollarSign, Calendar, Loader2 } from "lucide-react";

interface Preferences {
    language: string;
    timezone: string;
    currency: string;
    dateFormat: string;
}

const defaultPreferences: Preferences = {
    language: "pt-BR",
    timezone: "America/Sao_Paulo",
    currency: "BRL",
    dateFormat: "DD/MM/YYYY"
};

export default function PreferencesSheet() {
    const [preferences, setPreferences] = useState<Preferences>(defaultPreferences);
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    useEffect(() => {
        const stored = localStorage.getItem("erp_preferences");
        if (stored) {
            try {
                setPreferences(JSON.parse(stored));
            } catch (err) {
                console.error("Error parsing preferences:", err);
            }
        }
    }, []);

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        setMessage(null);
        setIsSaving(true);

        try {
            localStorage.setItem("erp_preferences", JSON.stringify(preferences));
            setMessage({ type: 'success', text: 'Preferências salvas com sucesso!' });
        } catch (err: any) {
            console.error("Error saving preferences:", err);
            setMessage({ type: 'error', text: 'Erro ao salvar preferências' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleChange = (field: keyof Preferences, value: string) => {
        setPreferences(prev => ({ ...prev, [field]: value }));
    };

    return (
        <div className="space-y-6">
            {message && (
                <div className={`p-4 rounded-lg ${message.type === 'success'
                        ? 'bg-green-50 text-green-700 border border-green-200'
                        : 'bg-red-50 text-red-700 border border-red-200'
                    }`}>
                    {message.text}
                </div>
            )}

            <form onSubmit={handleSave} className="space-y-6">
                {/* Regional Settings */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <Globe className="w-5 h-5" />
                            Configurações Regionais
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Idioma</label>
                            <Select
                                value={preferences.language}
                                onChange={(e) => handleChange("language", e.target.value)}
                            >
                                <option value="pt-BR">Português (Brasil)</option>
                                <option value="en-US" disabled>English (US) - Em breve</option>
                                <option value="es-ES" disabled>Español - Em breve</option>
                            </Select>
                            <p className="text-xs text-gray-500">
                                Outros idiomas serão adicionados em breve
                            </p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium flex items-center gap-2">
                                <Clock className="w-4 h-4 text-gray-400" />
                                Fuso Horário
                            </label>
                            <Select
                                value={preferences.timezone}
                                onChange={(e) => handleChange("timezone", e.target.value)}
                            >
                                <option value="America/Sao_Paulo">América/São Paulo (BRT)</option>
                                <option value="America/Manaus">América/Manaus (AMT)</option>
                                <option value="America/Recife">América/Recife (BRT)</option>
                                <option value="America/Fortaleza">América/Fortaleza (BRT)</option>
                            </Select>
                        </div>
                    </CardContent>
                </Card>

                {/* Format Settings */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Formatos</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium flex items-center gap-2">
                                <DollarSign className="w-4 h-4 text-gray-400" />
                                Moeda
                            </label>
                            <Select
                                value={preferences.currency}
                                onChange={(e) => handleChange("currency", e.target.value)}
                            >
                                <option value="BRL">Real Brasileiro (R$)</option>
                                <option value="USD">Dólar Americano (US$)</option>
                                <option value="EUR">Euro (€)</option>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-gray-400" />
                                Formato de Data
                            </label>
                            <Select
                                value={preferences.dateFormat}
                                onChange={(e) => handleChange("dateFormat", e.target.value)}
                            >
                                <option value="DD/MM/YYYY">DD/MM/YYYY (31/12/2025)</option>
                                <option value="MM/DD/YYYY">MM/DD/YYYY (12/31/2025)</option>
                                <option value="YYYY-MM-DD">YYYY-MM-DD (2025-12-31)</option>
                            </Select>
                        </div>
                    </CardContent>
                </Card>

                {/* Info Card */}
                <Card className="bg-blue-50 border-blue-200">
                    <CardContent className="pt-6">
                        <p className="text-sm text-blue-800">
                            <strong>Nota:</strong> As preferências são salvas localmente.
                            Em breve, serão sincronizadas com sua conta.
                        </p>
                    </CardContent>
                </Card>

                {/* Save Button */}
                <div className="flex justify-end">
                    <Button type="submit" disabled={isSaving}>
                        {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Salvar Preferências
                    </Button>
                </div>
            </form>
        </div>
    );
}
