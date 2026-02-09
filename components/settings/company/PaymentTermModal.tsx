"use client";

import { useEffect, useState, useMemo } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { DecimalInput } from "@/components/ui/DecimalInput";
import { upsertPaymentTermAction } from "@/app/actions/settings/payment-terms-actions";
import { PaymentTerm } from "@/lib/types/settings-types";
import { Loader2, Save, X, CalendarClock } from "lucide-react";
import { FormErrorSummary } from "@/components/ui/FormErrorSummary";
import { FieldError } from "@/components/ui/FieldError";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

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
            const payload = {
                id: termToEdit?.id, // undefined if new
                installments_count: installments,
                first_due_days: firstDueDays,
                cadence_days: installments === 1 ? null : (cadenceDays || 0),
                min_installment_amount: minAmount,
                name: generatedName, // Always auto-generated
                is_custom_name: false,
                is_active: true // Always active
            };

            const res = await upsertPaymentTermAction(payload);
            if (!res.success) throw new Error(res.error);

            toast({
                title: "Sucesso",
                description: "Prazo de pagamento salvo.",
            });
            onOpenChange(false);
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
            <DialogContent className="max-w-xl w-full p-0 gap-0 bg-gray-50 overflow-hidden rounded-2xl border-none shadow-float flex flex-col max-h-screen">
                {/* Header: White Background with Title, Description and Close Button */}
                <div className="bg-white px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                    <div>
                        <DialogTitle className="text-xl font-bold text-gray-900 leading-tight">
                            {termToEdit ? "Editar Prazo" : "Novo Prazo"}
                        </DialogTitle>
                        <DialogDescription className="text-xs text-gray-500 mt-0.5 font-normal">
                            Defina as regras de parcelamento e vendas.
                        </DialogDescription>
                    </div>
                </div>

                <div className="flex-1 p-6 overflow-y-auto">
                    <div className="space-y-6">
                        <FormErrorSummary errors={Object.values(errors)} visible={Object.keys(errors).length > 0} />

                        {/* Top Inputs */}
                        <div className="grid grid-cols-12 gap-4">
                            <div className="col-span-12 md:col-span-2 space-y-1">
                                <Label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Nº Parc.</Label>
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
                                    className="text-center h-9 rounded-2xl border-gray-200 bg-white focus:border-brand-500 focus:ring-brand-500 transition-all font-medium [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />
                            </div>
                            <div className="col-span-12 md:col-span-2 space-y-1">
                                <Label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">1ª Parc.</Label>
                                <Input
                                    type="number"
                                    min={0}
                                    max={365}
                                    value={firstDueDays}
                                    onChange={(e) => setFirstDueDays(parseInt(e.target.value) || 0)}
                                    onFocus={(e) => e.target.select()}
                                    onClick={(e) => e.currentTarget.select()}
                                    className="text-center h-9 rounded-2xl border-gray-200 bg-white focus:border-brand-500 focus:ring-brand-500 transition-all font-medium [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />
                            </div>

                            <div className="col-span-12 md:col-span-5 space-y-1">
                                <Label className={cn(
                                    "text-[11px] font-bold uppercase tracking-wider",
                                    installments === 1 ? "text-gray-300" : "text-gray-500"
                                )}>Cadência</Label>
                                <Select
                                    value={cadenceDays?.toString() || ""}
                                    onValueChange={(v) => setCadenceDays(parseInt(v))}
                                    disabled={installments === 1}
                                >
                                    <SelectTrigger error={!!errors.cadence} className="h-9 rounded-2xl border-gray-200 bg-white">
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

                            <div className="col-span-12 md:col-span-3 space-y-1">
                                <Label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Parc. Mínima</Label>
                                <DecimalInput
                                    value={minAmount || 0}
                                    onChange={(v) => setMinAmount(v || null)}
                                    className="text-right h-9 rounded-2xl border-gray-200 bg-white focus:border-brand-500 focus:ring-brand-500 transition-all font-medium"
                                    precision={2}
                                />
                            </div>
                        </div>

                        {/* Divider */}
                        <div className="py-2">
                            <div className="flex items-center gap-2">
                                <div className="h-px flex-1 bg-gray-200/60"></div>
                                <div className="p-1 rounded-full bg-gray-100/50">
                                    <CalendarClock className="w-3 h-3 text-gray-400" />
                                </div>
                                <div className="h-px flex-1 bg-gray-200/60"></div>
                            </div>
                        </div>

                        {/* Preview Area - White Card */}
                        <Card className="p-4 border-gray-200 shadow-none space-y-3">
                            <div className="flex justify-between items-center">
                                <Label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                                    Vencimentos Previstos
                                </Label>
                                <div className="text-[10px] font-bold text-brand-600 bg-brand-50 px-2 py-1 rounded-2xl border border-brand-100">
                                    {installments} parcela(s)
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto p-1">
                                {previewDates.map((d, i) => (
                                    <div key={i} className="flex flex-col items-center bg-gray-50 border border-gray-100 rounded-2xl px-2.5 py-1.5 min-w-12">
                                        <span className="text-[9px] text-gray-400 font-bold uppercase">{i + 1}ª</span>
                                        <span className="text-xs text-gray-700 font-bold font-mono">+{d}d</span>
                                    </div>
                                ))}
                            </div>

                            <div className="pt-3 border-t border-gray-100">
                                <div className="flex items-center gap-2 text-xs">
                                    <span className="text-gray-400 font-medium">Nome gerado:</span>
                                    <span className="font-bold text-gray-900 bg-gray-100 px-2 py-0.5 rounded">{generatedName}</span>
                                </div>
                            </div>
                        </Card>
                    </div>
                </div>

                {/* Footer Sticky Compact */}
                <div className="bg-white px-6 py-3 border-t border-gray-100 flex gap-3">
                    <Button
                        variant="ghost"
                        onClick={() => onOpenChange(false)}
                        className="flex-1 h-10 bg-gray-50 hover:bg-gray-100 text-gray-600 font-semibold transition-all"
                    >
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={isLoading}
                        className="flex-[2] h-10 bg-brand-600 hover:bg-brand-700 text-white font-bold active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                    >
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Salvar Prazo
                    </Button>
                </div>
            </DialogContent >
        </Dialog >
    );
}
