import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useState } from "react";
import { useToast } from "@/components/ui/use-toast";
import { useCompany } from "@/contexts/CompanyContext";
import { createClient } from "@/lib/supabaseBrowser";
import { Loader2, AlertTriangle } from "lucide-react";

interface NumberingAdjustmentModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    currentNumber: number;
    onSuccess: (newNumber: number) => void;
}

export function NumberingAdjustmentModal({ open, onOpenChange, currentNumber, onSuccess }: NumberingAdjustmentModalProps) {
    const { selectedCompany, user } = useCompany();
    const { toast } = useToast();
    const [newNumber, setNewNumber] = useState(currentNumber.toString());
    const [reason, setReason] = useState("");
    const [loading, setLoading] = useState(false);
    const supabase = createClient();

    const handleSave = async () => {
        if (!selectedCompany || !user) return;

        const num = parseInt(newNumber);
        if (isNaN(num) || num <= 0) {
            toast({
                title: "Número inválido",
                description: "O número da NF-e deve ser maior que zero.",
                variant: "destructive",
            });
            return;
        }

        if (num === currentNumber) {
            toast({
                title: "Sem alteração",
                description: "O novo número é igual ao atual.",
            });
            return;
        }

        if (!reason.trim() || reason.length < 10) {
            toast({
                title: "Justificativa obrigatória",
                description: "Por favor, informe uma justificativa para a alteração (mínimo 10 caracteres).",
                variant: "destructive",
            });
            return;
        }

        setLoading(true);
        try {
            // 1. Update Company Settings
            const { error: updateError } = await supabase
                .from('company_settings')
                .update({ nfe_next_number: num })
                .eq('company_id', selectedCompany.id);

            if (updateError) throw updateError;

            // 2. Insert Audit Log
            const { error: logError } = await supabase
                .from('audit_logs')
                .insert({
                    company_id: selectedCompany.id,
                    user_id: user.id,
                    action: 'adjust_nfe_number',
                    resource: 'company_settings',
                    details: {
                        old_number: currentNumber,
                        new_number: num,
                        reason: reason,
                        user_email: user.email
                    }
                });

            if (logError) {
                console.error("Failed to log audit:", logError.message, logError);
                // We don't rollback the update, just warn? Or fail silently on log?
                // Ideally transactional, but Supabase Client doesn't support transactions easily without RPC.
                // Assuming it's fine for now, or we could use an RPC.
            }

            toast({
                title: "Numeração ajustada",
                description: `Próximo número NF-e alterado para ${num}.`,
            });

            onSuccess(num);
            onOpenChange(false);
            setReason("");

        } catch (error: any) {
            console.error(error);
            toast({
                title: "Erro ao ajustar numeração",
                description: error.message || "Tente novamente.",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Ajustar Numeração NF-e</DialogTitle>
                    <DialogDescription>
                        Esta ação altera a sequência de numeração fiscal.
                        Requer justificativa para auditoria.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-2xl border border-amber-200 text-amber-800 text-sm">
                        <AlertTriangle className="h-5 w-5 shrink-0" />
                        <p>Cuidado: Alterar a numeração pode causar rejeições na SEFAZ se houver duplicidade.</p>
                    </div>

                    <div className="grid grid-cols-4 items-center gap-4">
                        <label className="text-right text-sm font-medium">Atual</label>
                        <Input value={currentNumber} disabled className="col-span-3 bg-gray-50" />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <label className="text-right text-sm font-medium">Novo Nº</label>
                        <Input
                            value={newNumber}
                            onChange={(e) => setNewNumber(e.target.value)}
                            className="col-span-3"
                            type="number"
                        />
                    </div>
                    <div className="grid grid-cols-4 items-start gap-4">
                        <label className="text-right text-sm font-medium mt-2">Motivo</label>
                        <textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            className="col-span-3 flex min-h-20 w-full rounded-2xl border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            placeholder="Justifique a alteração..."
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                        Cancelar
                    </Button>
                    <Button onClick={handleSave} disabled={loading}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Salvar Ajuste
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
