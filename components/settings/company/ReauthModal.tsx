
"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { createClient } from "@/lib/supabaseBrowser";
import { Loader2, ShieldCheck, AlertCircle } from "lucide-react";

interface ReauthModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => Promise<void>;
}

export function ReauthModal({ isOpen, onClose, onConfirm }: ReauthModalProps) {
    const supabase = createClient();
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleConfirm = async () => {
        if (!password) {
            setError("Digite sua senha.");
            return;
        }

        setLoading(true);
        setError(null);

        try {
            // Validate password
            const { data: { user } } = await supabase.auth.getUser();
            if (!user || !user.email) throw new Error("Usuário não identificado");

            const { error: signInError } = await supabase.auth.signInWithPassword({
                email: user.email,
                password: password
            });

            if (signInError) throw new Error("Senha incorreta.");

            // Proceed
            await onConfirm();
            onClose();
        } catch (err: any) {
            setError(err.message || "Erro de autenticação.");
        } finally {
            setLoading(false);
            setPassword(""); // Clear password
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => {
            if (!open && !loading) onClose();
        }}>
            <DialogContent className="sm:max-w-[440px] gap-6 p-6">
                <DialogHeader className="flex flex-col items-center gap-2 text-center sm:text-left sm:items-start sm:gap-1">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 mb-2 sm:mb-0">
                        <ShieldCheck className="h-5 w-5 text-brand-600" />
                    </div>
                    <DialogTitle className="text-xl font-semibold text-gray-900">Confirmar Alterações</DialogTitle>
                    <DialogDescription className="text-gray-500">
                        Por motivos de segurança, entre com sua senha para salvar as configurações sensíveis da empresa.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    {error && (
                        <div className="flex items-center gap-2 p-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-gray-700">Confirme sua Senha</label>
                        <Input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
                            autoFocus
                            placeholder="••••••••"
                            className="h-10"
                        />
                    </div>
                </div>

                <DialogFooter className="sm:justify-end gap-2">
                    <Button variant="secondary" onClick={onClose} disabled={loading} className="h-10 px-4">Cancelar</Button>
                    <Button onClick={handleConfirm} disabled={loading} className="h-10 px-4 min-w-[140px]">
                        {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Confirmar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
