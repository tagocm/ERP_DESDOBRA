
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabaseBrowser";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Loader2, User, Mail, Lock } from "lucide-react";

export default function AccountSheet() {
    const supabase = createClient();
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const [userData, setUserData] = useState({
        email: "",
        full_name: "",
        user_id: ""
    });

    useEffect(() => {
        async function loadUserData() {
            setIsLoading(true);
            try {
                const { data: { user }, error: authError } = await supabase.auth.getUser();

                if (authError || !user) {
                    console.error("Auth error:", authError);
                    return;
                }

                const { data: profile, error: profileError } = await supabase
                    .from("user_profiles")
                    .select("full_name")
                    .eq("user_id", user.id)
                    .single();

                setUserData({
                    email: user.email || "",
                    full_name: profile?.full_name || user.user_metadata?.full_name || "",
                    user_id: user.id
                });

            } catch (err) {
                console.error("Error loading user data:", err);
            } finally {
                setIsLoading(false);
            }
        }

        loadUserData();
    }, [supabase]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage(null);
        setIsSaving(true);

        try {
            const { error } = await supabase
                .from("user_profiles")
                .upsert({
                    user_id: userData.user_id,
                    full_name: userData.full_name,
                    updated_at: new Date().toISOString()
                });

            if (error) throw error;

            setMessage({ type: 'success', text: 'Perfil atualizado com sucesso!' });
        } catch (err: any) {
            console.error("Error saving profile:", err);
            setMessage({ type: 'error', text: 'Erro ao salvar: ' + err.message });
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
        );
    }

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
                {/* Profile Information */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <User className="w-5 h-5" />
                            Informações do Perfil
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium flex items-center gap-2">
                                <Mail className="w-4 h-4 text-gray-400" />
                                Email
                            </label>
                            <Input
                                type="email"
                                value={userData.email}
                                disabled
                                className="bg-gray-50"
                            />
                            <p className="text-xs text-gray-500">
                                O email não pode ser alterado
                            </p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">
                                Nome Completo
                            </label>
                            <Input
                                type="text"
                                value={userData.full_name}
                                onChange={(e) => setUserData(prev => ({ ...prev, full_name: e.target.value }))}
                                placeholder="Seu nome completo"
                            />
                        </div>

                        <div className="flex justify-end pt-4 border-t">
                            <Button type="submit" disabled={isSaving}>
                                {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                Salvar Alterações
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Password Section */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <Lock className="w-5 h-5" />
                            Segurança
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <div>
                                <h4 className="text-sm font-medium mb-2">Alterar Senha</h4>
                                <p className="text-sm text-gray-600 mb-4">
                                    Para alterar sua senha, você receberá um email com instruções.
                                </p>
                                <Button
                                    type="button"
                                    variant="secondary"
                                    disabled
                                    title="Em breve"
                                >
                                    Solicitar Alteração de Senha
                                </Button>
                                <p className="text-xs text-gray-500 mt-2">
                                    Funcionalidade em desenvolvimento
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </form>
        </div>
    );
}
