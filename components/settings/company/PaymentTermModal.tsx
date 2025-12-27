
"use client";

import { useEffect, useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { DecimalInput } from "@/components/ui/DecimalInput";
import { PaymentTerm } from "@/lib/data/company-settings";
import { Loader2 } from "lucide-react";
import { FormErrorSummary } from "@/components/ui/FormErrorSummary";
import { FieldError } from "@/components/ui/FieldError";
import { useToast } from "@/components/ui/use-toast";

interface PaymentTermModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: (term: Partial<PaymentTerm>) => Promise<boolean>;
    termToEdit?: PaymentTerm | null; // If null, creates new
}

export function PaymentTermModal({ open, onOpenChange, onSave, termToEdit }: PaymentTermModalProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const { toast } = useToast();

    // ...

    const handleSave = async () => {
        setErrors({});
        const newErrors: Record<string, string> = {};

        if (installments > 1 && !cadenceDays) {
            newErrors.cadence = "Selecione a cadência.";
        }

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        setIsLoading(true);
        try {
            const success = await onSave({
                id: termToEdit?.id, // undefined if new
                installments_count: installments,
                first_due_days: firstDueDays,
                cadence_days: installments === 1 ? null : (cadenceDays || 0),
                min_installment_amount: minAmount,
                name: generatedName, // Always auto-generated
                is_active: true // Always active
            });
            if (success) {
                toast({
                    title: "Sucesso",
                    description: "Prazo de pagamento salvo.",
                    variant: "success"
                });
                onOpenChange(false);
            }
        } catch (e: any) {
            console.error(e);
            toast({
                title: "Erro ao Salvar",
                description: e.message || "Não foi possível salvar.",
                variant: "destructive"
            });
        } finally {
            setIsLoading(false);
        }
    };
    const [installments, setInstallments] = useState(1);
    const [firstDueDays, setFirstDueDays] = useState(0);
    const [cadenceDays, setCadenceDays] = useState<number | null>(null);
    const [minAmount, setMinAmount] = useState<number | null>(null);

    // Initialize logic
    useEffect(() => {
        if (open) {
            if (termToEdit) {
                setInstallments(termToEdit.installments_count);
                setFirstDueDays(termToEdit.first_due_days);
                setCadenceDays(termToEdit.cadence_days);
                setMinAmount(termToEdit.min_installment_amount || null);
            } else {
                // Return to defaults for new
                setInstallments(1);
                setFirstDueDays(0);
                setCadenceDays(30); // Default cadence
                setMinAmount(null);
            }
        }
    }, [open, termToEdit]);

    // Preview Logic
    const previewDates = useMemo(() => {
        const days = [];
        let current = firstDueDays;
        days.push(current);

        if (installments > 1) {
            const cad = cadenceDays || 30; // Default fallback
            for (let i = 1; i < installments; i++) {
                current += cad;
                days.push(current);
            }
        }
        return days;
    }, [installments, firstDueDays, cadenceDays]);

    // Auto Name Logic
    const generatedName = useMemo(() => {
        const previewStr = previewDates.join('-');
        return `${installments}x - ${previewStr}`;
    }, [installments, previewDates]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>{termToEdit ? "Editar Prazo" : "Novo Prazo"}</DialogTitle>
                </DialogHeader>

                <div className="grid grid-cols-12 gap-4 py-4 items-end">
                    <div className="col-span-12">
                        <FormErrorSummary errors={Object.values(errors)} visible={Object.keys(errors).length > 0} />
                    </div>
                    <div className="col-span-2 space-y-1.5">
                        <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Nº Parc.</Label>
                        <Input
                            type="number"
                            min={1}
                            max={24}
                            value={installments}
                            onChange={(e) => {
                                const val = parseInt(e.target.value);
                                if (val >= 1 && val <= 48) setInstallments(val);
                            }}
                            onFocus={(e) => e.target.select()}
                            onClick={(e) => e.currentTarget.select()}
                            className="text-center h-9 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                    </div>
                    <div className="col-span-2 space-y-1.5">
                        <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">1ª Parc.</Label>
                        <Input
                            type="number"
                            min={0}
                            max={365}
                            value={firstDueDays}
                            onChange={(e) => setFirstDueDays(parseInt(e.target.value) || 0)}
                            onFocus={(e) => e.target.select()}
                            onClick={(e) => e.currentTarget.select()}
                            className="text-center h-9 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                    </div>

                    <div className="col-span-4 space-y-1.5">
                        <Label className={`text-xs font-semibold uppercase tracking-wider whitespace-nowrap ${installments === 1 ? "text-gray-300" : "text-gray-500"}`}>Cadência</Label>
                        <Select
                            value={cadenceDays?.toString() || ""}
                            onValueChange={(v) => setCadenceDays(parseInt(v))}
                            disabled={installments === 1}
                        >
                            <SelectTrigger error={!!errors.cadence} className="h-9">
                                <SelectValue placeholder="Selecione..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="7">7 dias (Semanal)</SelectItem>
                                <SelectItem value="10">10 dias</SelectItem>
                                <SelectItem value="14">14 dias (Quinzenal)</SelectItem>
                                <SelectItem value="15">15 dias</SelectItem>
                                <SelectItem value="21">21 dias</SelectItem>
                                <SelectItem value="28">28 dias (4 Semanas)</SelectItem>
                                <SelectItem value="30">30 dias (Mensal)</SelectItem>
                                <SelectItem value="45">45 dias</SelectItem>
                                <SelectItem value="60">60 dias</SelectItem>
                            </SelectContent>
                        </Select>
                        <FieldError error={errors.cadence} />
                    </div>
                    <div className="col-span-4 space-y-1.5">
                        <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Parc. Mínima</Label>
                        <DecimalInput
                            value={minAmount || 0}
                            onChange={(v) => setMinAmount(v || null)}
                            className="text-right h-9"
                            precision={2}
                        />
                    </div>



                    {/* Preview Area */}
                    <div className="col-span-12 bg-gray-50 p-3 rounded-lg border border-gray-100">
                        <Label className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Vencimentos Previstos</Label>
                        <div className="mt-2 flex flex-wrap gap-1.5 max-h-[60px] overflow-y-auto">
                            {previewDates.map((d, i) => (
                                <span key={i} className="px-1.5 py-0.5 bg-white border border-gray-200 rounded text-xs text-gray-600 font-mono shadow-sm">
                                    {d}
                                </span>
                            ))}
                        </div>
                        <div className="mt-2 pt-2 border-t border-gray-200">
                            <p className="text-xs text-brand-600 font-medium">Nome gerado: {generatedName}</p>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                    <Button onClick={handleSave} disabled={isLoading}>
                        {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Salvar
                    </Button>
                </DialogFooter>
            </DialogContent >
        </Dialog >
    );
}
