
"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Alert } from "@/components/ui/Alert";
import { createClient } from "@/lib/supabaseBrowser";
import { Loader2 } from "lucide-react";

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
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Confirmar Alterações</DialogTitle>
                    <DialogDescription>
                        Por segurança, confirme sua senha para salvar estas alterações.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {error && (
                        <Alert variant="destructive">{error}</Alert>
                    )}
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Sua Senha</label>
                        <Input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
                    <Button onClick={handleConfirm} disabled={loading}>
                        {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Confirmar e Salvar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
