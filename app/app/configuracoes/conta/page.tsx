"use client";

import { PageHeader } from "@/components/ui/PageHeader";
// ModuleTabs removed
import { Card, CardContent } from "@/components/ui/Card";
import { CardHeaderStandard } from "@/components/ui/CardHeaderStandard";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useCompany } from "@/contexts/CompanyContext";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabaseBrowser";
import { AlertCircle, CheckCircle, Loader2, Save, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Alert } from "@/components/ui/Alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/use-toast";

// Tabs definitions removed

export default function AccountSettingsPage() {
    // We use 'user' from context which we fixed to be exposed
    const { user } = useCompany();
    const supabase = createClient();
    const { toast } = useToast();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Profile State
    const [fullName, setFullName] = useState("");
    const [email, setEmail] = useState("");
    const [jobTitle, setJobTitle] = useState("");
    // Role is tricky. public.users had it. user_profiles doesn't. 
    // We can infer generic role from metadata or empty for now. 
    // Or fetch from public.users if it exists? 
    // Let's rely on auth metadata or defaults since we are migrating.
    const [role, setRole] = useState("USER");

    // Fetch Profile
    useEffect(() => {
        async function fetchProfile() {
            if (!user) return;
            try {
                // Fetch from user_profiles instead of users
                // Use maybeSingle() to avoid error if no profile exists yet
                const { data, error } = await supabase
                    .from('user_profiles')
                    .select('*')
                    .eq('auth_user_id', user.id)
                    .maybeSingle();

                if (error) throw error;

                if (data) {
                    setFullName(data.full_name || "");
                    setJobTitle(data.job_title || "");
                }

                // Email comes from Auth
                setEmail(user.email || "");

                // Role: Try to check if there is an app_metadata role or similar, otherwise 'USER'
                // Or maybe unrelated to this table? 
                // Currently just defaulting to USER to avoid complexity as requested "Minha Conta" specific fields.
                // If user wants "Ranking", we might need to add it to profiles too.

            } catch (err: any) {
                console.error("Error fetching profile full:", err);
                console.error("Error Code:", err.code);
                console.error("Error Message:", err.message);
                toast({
                    title: "Erro ao carregar perfil",
                    description: err.message || "Desconhecido",
                    variant: "destructive"
                });
            } finally {
                setLoading(false);
            }
        }
        fetchProfile();
    }, [user, toast]);

    const handleSaveProfile = async () => {
        if (!user) return;
        if (!fullName.trim()) {
            toast({
                title: "Nome obrigatório",
                description: "Preencha o nome completo para salvar.",
                variant: "destructive"
            });
            return;
        }

        setSaving(true);

        try {
            // UPSERT profile
            const { error } = await supabase
                .from('user_profiles')
                .upsert({
                    auth_user_id: user.id,
                    full_name: fullName,
                    job_title: jobTitle,
                    updated_at: new Date().toISOString()
                });

            if (error) throw error;

            toast({
                title: "Dados atualizados com sucesso."
            });

        } catch (err: any) {
            console.error("Error updating profile:", err);
            toast({
                title: "Erro ao salvar perfil",
                description: err.message || "Erro desconhecido",
                variant: "destructive"
            });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="pb-20">
            <PageHeader
                title="Minha Conta"
                subtitle="Gerencie suas informações pessoais e segurança."
            />

            <div className="max-w-screen-2xl mx-auto px-6 space-y-6">
                {loading ? (
                    <div className="flex h-40 items-center justify-center">
                        <Loader2 className="w-8 h-8 animate-spin text-gray-300" />
                    </div>
                ) : (
                    <>
                        {/* MY ACCOUNT CARD */}
                        <Card>
                            <CardHeaderStandard
                                title="Minha Conta"
                                actions={
                                    <Button onClick={handleSaveProfile} disabled={saving} className="bg-brand-600 hover:bg-brand-700 text-white">
                                        {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                                        Salvar Alterações
                                    </Button>
                                }
                            />
                            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-8">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700">Nome Completo <span className="text-red-500">*</span></label>
                                    <Input
                                        value={fullName}
                                        onChange={e => setFullName(e.target.value)}
                                        placeholder="Seu nome"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700">Email</label>
                                    <Input
                                        value={email}
                                        disabled
                                        className="bg-gray-50 text-gray-500"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700">Área / Cargo</label>
                                    <Input
                                        value={jobTitle}
                                        onChange={e => setJobTitle(e.target.value)}
                                        placeholder="Ex: Gerente Financeiro"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700">Permissão</label>
                                    <div>
                                        <span className={cn(
                                            "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border",
                                            role === 'MASTER' || role === 'ADMIN'
                                                ? "bg-purple-50 text-purple-700 border-purple-200"
                                                : "bg-blue-50 text-blue-700 border-blue-200"
                                        )}>
                                            {role}
                                        </span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* SECURITY CARD */}
                        <Card>
                            <CardHeaderStandard
                                icon={<Lock className="w-5 h-5" />}
                                title="Segurança"
                                actions={<ChangePasswordDialog />}
                            />
                            <CardContent className="pb-8">
                                <div className="text-sm text-gray-500 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                                    Sua senha foi alterada pela última vez recentemente. Recomendamos o uso de senhas fortes.
                                </div>
                            </CardContent>
                        </Card>
                    </>
                )}
            </div>
        </div>
    );
}

function ChangePasswordDialog() {
    const supabase = createClient();
    const [isOpen, setIsOpen] = useState(false);

    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const reset = () => {
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setError(null);
        setSuccess(false);
        setLoading(false);
    };

    const handleChangePassword = async () => {
        setError(null);
        if (!currentPassword || !newPassword || !confirmPassword) {
            setError("Preencha todos os campos.");
            return;
        }
        if (newPassword.length < 8) {
            setError("A nova senha deve ter no mínimo 8 caracteres.");
            return;
        }
        if (newPassword !== confirmPassword) {
            setError("A nova senha e a confirmação não conferem.");
            return;
        }

        setLoading(true);

        try {
            // 1. Verify old password by signing in (re-authentication)
            const { data: { user }, error: signInError } = await supabase.auth.signInWithPassword({
                email: (await supabase.auth.getUser()).data.user?.email || "",
                password: currentPassword
            });

            if (signInError || !user) {
                throw new Error("Senha atual incorreta.");
            }

            // 2. Update password
            const { error: updateError } = await supabase.auth.updateUser({
                password: newPassword
            });

            if (updateError) throw updateError;

            setSuccess(true);
            setTimeout(() => {
                setIsOpen(false);
                reset();
            }, 2000); // Close after 2s success msg

        } catch (err: any) {
            console.error(err);
            setError(err.message || "Erro ao alterar senha.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => {
            setIsOpen(open);
            if (!open) reset();
        }}>
            <DialogTrigger asChild>
                <Button variant="outline">Alterar Senha</Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm w-full p-0 gap-0 bg-gray-50 overflow-hidden rounded-2xl border-none shadow-float flex flex-col max-h-screen">
                {/* Header: White Background with Title, Description and Close Button */}
                <div className="bg-white px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                    <div>
                        <DialogTitle className="text-xl font-bold text-gray-900 leading-tight">Alterar Senha</DialogTitle>
                        <DialogDescription className="text-xs text-gray-500 mt-0.5 font-normal">
                            Redefina sua senha com segurança.
                        </DialogDescription>
                    </div>
                </div>

                <div className="flex-1 p-6 overflow-y-auto">
                    {success ? (
                        <div className="py-6 flex flex-col items-center justify-center text-center space-y-4 animate-in fade-in zoom-in duration-500">
                            <div className="w-20 h-20 rounded-full bg-green-50 flex items-center justify-center mb-2">
                                <CheckCircle className="w-10 h-10 text-green-500" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-gray-900">Senha Alterada!</h3>
                                <p className="text-xs text-gray-500 mt-1.5 px-4 font-medium">Sua nova senha já está ativa.</p>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {error && (
                                <Alert variant="destructive" className="rounded-2xl border-red-100 bg-red-50 text-red-800 animate-in shake duration-300 py-3">
                                    <AlertCircle className="w-4 h-4 mr-2" />
                                    <span className="text-xs font-bold">{error}</span>
                                </Alert>
                            )}

                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Senha Atual</label>
                                <Input
                                    type="password"
                                    value={currentPassword}
                                    onChange={e => setCurrentPassword(e.target.value)}
                                    className="h-9 rounded-2xl border-gray-200 bg-white focus:border-brand-500 focus:ring-brand-500 transition-all font-medium"
                                    placeholder="••••••••"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Nova Senha</label>
                                <Input
                                    type="password"
                                    value={newPassword}
                                    onChange={e => setNewPassword(e.target.value)}
                                    placeholder="Mínimo 8 caracteres"
                                    className="h-9 rounded-2xl border-gray-200 bg-white focus:border-brand-500 focus:ring-brand-500 transition-all font-medium"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Confirmar Nova Senha</label>
                                <Input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={e => setConfirmPassword(e.target.value)}
                                    className="h-9 rounded-2xl border-gray-200 bg-white focus:border-brand-500 focus:ring-brand-500 transition-all font-medium"
                                    placeholder="Repita a nova senha"
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Sticky Compact */}
                <div className="bg-white px-6 py-3 border-t border-gray-100 flex gap-3">
                    {!success ? (
                        <>
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={() => setIsOpen(false)}
                                disabled={loading}
                                className="flex-1 h-10 bg-gray-50 hover:bg-gray-100 text-gray-600 font-semibold transition-all"
                            >
                                Cancelar
                            </Button>
                            <Button
                                onClick={handleChangePassword}
                                disabled={loading}
                                className="flex-[2] h-10 bg-brand-600 hover:bg-brand-700 text-white font-bold active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                            >
                                {loading ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Lock className="w-4 h-4" />
                                )}
                                Alterar Senha
                            </Button>
                        </>
                    ) : (
                            <Button
                                variant="ghost"
                                onClick={() => setIsOpen(false)}
                                className="flex-1 h-10 bg-gray-50 hover:bg-gray-100 text-gray-600 font-semibold transition-all"
                            >
                                Fechar
                            </Button>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
