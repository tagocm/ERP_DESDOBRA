
"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { Label } from "@/components/ui/Label";
import { Separator } from "@/components/ui/separator";
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
                <div className={`p-4 rounded-2xl ${message.type === 'success'
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
                            <Label className="text-sm font-medium">Idioma</Label>
                            <Select
                                value={preferences.language}
                                onValueChange={(val) => handleChange("language", val)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione o idioma" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="pt-BR">Português (Brasil)</SelectItem>
                                    <SelectItem value="en-US">English (US)</SelectItem>
                                    <SelectItem value="es-ES">Español</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid gap-2">
                            <Label>Fuso Horário</Label>
                            <Select
                                value={preferences.timezone}
                                onValueChange={(val) => handleChange("timezone", val)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione o fuso horário" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="America/Sao_Paulo">Brasília (GMT-3)</SelectItem>
                                    <SelectItem value="UTC">UTC</SelectItem>
                                    <SelectItem value="America/New_York">New York (EST)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </CardContent>
                </Card>

                {/* Format Settings */}
                <Card>
                    <CardContent className="space-y-4">
                        <Separator />

                        <div className="space-y-4">
                            <h4 className="text-sm font-medium leading-none">Formatos</h4>
                            <div className="grid gap-2">
                                <Label>Moeda</Label>
                                <Select
                                    value={preferences.currency}
                                    onValueChange={(val) => handleChange("currency", val)}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecione a moeda" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="BRL">Real (BRL)</SelectItem>
                                        <SelectItem value="USD">Dólar (USD)</SelectItem>
                                        <SelectItem value="EUR">Euro (EUR)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="grid gap-2">
                                <Label>Formato de Data</Label>
                                <Select
                                    value={preferences.dateFormat}
                                    onValueChange={(val) => handleChange("dateFormat", val)}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecione o formato" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="dd/MM/yyyy">dd/mm/aaaa</SelectItem>
                                        <SelectItem value="MM/dd/yyyy">mm/dd/aaaa</SelectItem>
                                        <SelectItem value="yyyy-MM-dd">aaaa-mm-dd</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
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
