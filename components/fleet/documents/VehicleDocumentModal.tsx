"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { createVehicleDocumentAction, updateVehicleDocumentAction, VehicleDocumentRow, CreateVehicleDocumentInput, UpdateVehicleDocumentInput } from "@/app/actions/vehicle-documents-actions";
import { useToast } from "@/components/ui/use-toast";
import { CurrencyInput } from "@/components/ui/CurrencyInput";
import { Loader2, Save } from "lucide-react";

interface VehicleDocumentModalProps {
    isOpen: boolean;
    onClose: () => void;
    vehicleId: string;
    initialData?: VehicleDocumentRow;
    onSuccess: () => void;
}

const VEHICLE_DOCUMENT_TYPES: readonly CreateVehicleDocumentInput["type"][] = ["IPVA", "LICENCIAMENTO"];

function isVehicleDocumentType(value: string): value is CreateVehicleDocumentInput["type"] {
    return VEHICLE_DOCUMENT_TYPES.some((type) => type === value);
}

export function VehicleDocumentModal({ isOpen, onClose, vehicleId, initialData, onSuccess }: VehicleDocumentModalProps) {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);

    // Form State
    const [type, setType] = useState<CreateVehicleDocumentInput["type"]>('IPVA');
    const [competencyYear, setCompetencyYear] = useState<string>(new Date().getFullYear().toString());
    const [amount, setAmount] = useState<number>(0);
    const [installmentsCount, setInstallmentsCount] = useState<number>(1);
    const [firstDueDate, setFirstDueDate] = useState<string>('');
    const [notes, setNotes] = useState<string>('');

    // Errors state
    const [errors, setErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        if (isOpen) {
            setErrors({});
            if (initialData) {
                setType(initialData.type);
                setCompetencyYear(initialData.competency_year.toString());
                setAmount(initialData.amount);
                setInstallmentsCount(initialData.installments_count);
                setFirstDueDate(initialData.first_due_date);
                setNotes(initialData.notes || '');
            } else {
                // Reset for create
                setType('IPVA');
                setCompetencyYear(new Date().getFullYear().toString());
                setAmount(0);
                setInstallmentsCount(1);
                setFirstDueDate('');
                setNotes('');
            }
        }
    }, [isOpen, initialData]);

    const validate = () => {
        const newErrors: Record<string, string> = {};

        if (!firstDueDate) newErrors.firstDueDate = "Data de vencimento é obrigatória";
        if (amount <= 0) newErrors.amount = "Valor deve ser maior que zero";
        if (installmentsCount < 1 || installmentsCount > 12) newErrors.installmentsCount = "Parcelas entre 1 e 12";
        if (!competencyYear || parseInt(competencyYear) < 2000) newErrors.competencyYear = "Ano inválido";

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate()) return;

        setLoading(true);

        try {
            if (initialData) {
                // Update
                const payload: UpdateVehicleDocumentInput = {
                    type,
                    competency_year: parseInt(competencyYear),
                    amount,
                    installments_count: installmentsCount,
                    first_due_date: firstDueDate,
                    notes: notes || null,
                };
                const res = await updateVehicleDocumentAction(initialData.id, payload);
                if (!res.ok) throw res.error;
            } else {
                // Create
                const payload: CreateVehicleDocumentInput = {
                    vehicle_id: vehicleId,
                    type,
                    competency_year: parseInt(competencyYear),
                    amount,
                    installments_count: installmentsCount,
                    first_due_date: firstDueDate,
                    notes: notes || null,
                };
                const res = await createVehicleDocumentAction(payload);
                if (!res.ok) throw res.error;
            }

            toast({
                title: "Sucesso!",
                description: `Documento ${initialData ? 'atualizado' : 'criado'} com sucesso.`,
            });
            onSuccess();
            onClose();
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : "Falha ao salvar documento.";
            toast({
                title: "Erro",
                description: message,
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
            <DialogContent className="max-w-2xl max-h-screen overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{initialData ? 'Editar Documento' : 'Novo Documento'}</DialogTitle>
                    <p className="text-sm text-gray-500">
                        Preencha os dados do documento. Um lançamento financeiro será gerado automaticamente.
                    </p>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Card: Dados do Documento */}
                    <div className="border border-gray-200 rounded-2xl p-6 space-y-4">
                        <h3 className="text-sm font-semibold text-gray-900">Dados do documento</h3>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-sm font-medium text-gray-700">Tipo de Documento</Label>
                                <Select
                                    value={type}
                                    onValueChange={(value) => {
                                        if (isVehicleDocumentType(value)) {
                                            setType(value);
                                        }
                                    }}
                                >
                                    <SelectTrigger className="h-10 border-gray-200">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="IPVA">IPVA</SelectItem>
                                        <SelectItem value="LICENCIAMENTO">Licenciamento</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-sm font-medium text-gray-700">Competência / Ano</Label>
                                <Input
                                    type="number"
                                    value={competencyYear}
                                    onChange={(e) => setCompetencyYear(e.target.value)}
                                    className="h-10 border-gray-200"
                                    required
                                />
                                {errors.competencyYear && <p className="text-xs text-red-500">{errors.competencyYear}</p>}
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-sm font-medium text-gray-700">Valor Total</Label>
                            <CurrencyInput
                                value={amount}
                                onChange={(val: number) => setAmount(val || 0)}
                                className="h-10 border-gray-200"
                            />
                            {errors.amount && <p className="text-xs text-red-500">{errors.amount}</p>}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-sm font-medium text-gray-700">Nº de Parcelas</Label>
                                <Input
                                    type="number"
                                    min={1}
                                    max={12}
                                    value={installmentsCount}
                                    onChange={(e) => setInstallmentsCount(parseInt(e.target.value) || 1)}
                                    className="h-10 border-gray-200"
                                    required
                                />
                                {errors.installmentsCount && <p className="text-xs text-red-500">{errors.installmentsCount}</p>}
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-sm font-medium text-gray-700">Primeiro Vencimento</Label>
                                <Input
                                    type="date"
                                    value={firstDueDate}
                                    onChange={(e) => setFirstDueDate(e.target.value)}
                                    className="h-10 border-gray-200"
                                    required
                                />
                                {errors.firstDueDate && <p className="text-xs text-red-500">{errors.firstDueDate}</p>}
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-sm font-medium text-gray-700">Observações</Label>
                            <Textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                className="min-h-20 border-gray-200"
                                placeholder="Informações adicionais..."
                            />
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={loading} className="min-w-32 bg-brand-600 hover:bg-brand-700">
                            {loading ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Salvando...
                                </>
                            ) : (
                                <>
                                    <Save className="w-4 h-4 mr-2" />
                                    {initialData ? 'Salvar' : 'Criar Documento'}
                                </>
                            )}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
