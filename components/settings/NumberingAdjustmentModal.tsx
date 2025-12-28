"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Textarea } from "@/components/ui/Textarea";
import { Loader2, AlertTriangle } from "lucide-react";

interface NumberingAdjustmentModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentNumber: number;
    onConfirm: (newNumber: number, motive: string) => Promise<void>;
}

export function NumberingAdjustmentModal({
    isOpen,
    onClose,
    currentNumber,
    onConfirm
}: NumberingAdjustmentModalProps) {
    const [newNumber, setNewNumber] = useState<string>("");
    const [motive, setMotive] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async () => {
        setError(null);
        if (!newNumber || parseInt(newNumber) <= 0) {
            setError("O novo número deve ser maior que zero.");
            return;
        }
        if (!motive || motive.length < 5) {
            setError("Informe um motivo válido para a auditoria (mínimo 5 caracteres).");
            return;
        }

        setIsLoading(true);
        try {
            await onConfirm(parseInt(newNumber), motive);
            onClose();
            setNewNumber("");
            setMotive("");
        } catch (err: any) {
            setError(err.message || "Erro ao ajustar numeração.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Ajustar Numeração NF-e</DialogTitle>
                    <DialogDescription>
                        Esta ação é auditada. Use com cautela para correção de sequências.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    {error && (
                        <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                            {error}
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-gray-500">Número Atual</Label>
                            <div className="p-2 bg-gray-100 rounded border text-gray-700 font-mono">
                                {currentNumber}
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="new-number" className="text-blue-700 font-semibold">Novo Número</Label>
                            <Input
                                id="new-number"
                                type="number"
                                value={newNumber}
                                onChange={(e) => setNewNumber(e.target.value)}
                                className="border-blue-200 focus:border-blue-500"
                                placeholder="Ex: 101"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="motive">Motivo da Alteração <span className="text-red-500">*</span></Label>
                        <Textarea
                            id="motive"
                            value={motive}
                            onChange={(e) => setMotive(e.target.value)}
                            placeholder="Ex: Pulei a sequência devido a rejeição na SEFAZ..."
                            className="min-h-[80px]"
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={isLoading}>
                        Cancelar
                    </Button>
                    <Button onClick={handleSubmit} disabled={isLoading} variant="destructive">
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                        Confirmar Ajuste
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
