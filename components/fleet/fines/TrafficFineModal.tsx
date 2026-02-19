"use client";

import { useForm, SubmitHandler, Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { Checkbox } from "@/components/ui/Checkbox";
import { useToast } from "@/components/ui/use-toast";
import { saveTrafficFineAction } from "@/app/actions/traffic-fines-actions";
import { TrafficFineRow } from "@/lib/types/traffic-fines";
import { trafficFineSchema, TrafficFineSchema } from "@/lib/validations/traffic-fines";
import { Loader2, Save } from "lucide-react";
import { CurrencyInput } from "@/components/ui/CurrencyInput";

interface TrafficFineModalProps {
    isOpen: boolean;
    onClose: () => void;
    vehicleId: string;
    initialData?: TrafficFineRow;
    onSuccess?: () => void;
}

export function TrafficFineModal({ isOpen, onClose, vehicleId, initialData, onSuccess }: TrafficFineModalProps) {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);

    const form = useForm<TrafficFineSchema>({
        resolver: zodResolver(trafficFineSchema) as Resolver<TrafficFineSchema>,
        defaultValues: initialData ? {
            id: initialData.id,
            vehicle_id: initialData.vehicle_id,
            fine_date: initialData.fine_date,
            due_date: initialData.due_date,
            city: initialData.city,
            reason: initialData.reason,
            amount: initialData.amount,
            driver_name: initialData.driver_name,
            notes: initialData.notes || '',
            deducted_from_driver: initialData.deducted_from_driver,
        } : {
            vehicle_id: vehicleId,
            fine_date: new Date().toISOString().split('T')[0],
            city: '',
            reason: '',
            amount: 0,
            driver_name: '',
            notes: '',
            deducted_from_driver: false,
        }
    });

    const { register, handleSubmit, setValue, watch, formState: { errors }, reset } = form;

    const onSubmit: SubmitHandler<TrafficFineSchema> = async (data) => {
        setLoading(true);
        const result = await saveTrafficFineAction(data);

        if (result.ok) {
            toast({
                title: "Sucesso!",
                description: initialData ? "Registro atualizado." : "Registro criado.",
                // @ts-ignore
                className: "bg-green-600 text-white border-none"
            });
            reset();
            onClose();
            onSuccess?.();
        } else {
            toast({ title: "Erro", description: result.error.message, variant: "destructive" });
        }
        setLoading(false);
    };

    const handleClose = () => {
        reset();
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{initialData ? "Editar Multa" : "Nova Multa"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                    {/* Card: Dados da Multa */}
                    <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
                        <h3 className="text-sm font-semibold text-gray-900">Dados da multa</h3>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-sm font-medium text-gray-700">Data da Infração</Label>
                                <Input
                                    type="date"
                                    {...register("fine_date")}
                                    className="h-10 border-gray-200"
                                />
                                {errors.fine_date && <p className="text-xs text-red-500">{errors.fine_date.message}</p>}
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-sm font-medium text-gray-700">Vencimento (Opcional)</Label>
                                <Input
                                    type="date"
                                    {...register("due_date")}
                                    className="h-10 border-gray-200"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-sm font-medium text-gray-700">Cidade</Label>
                            <Input
                                {...register("city")}
                                placeholder="Ex: São Paulo"
                                className="h-10 border-gray-200"
                            />
                            {errors.city && <p className="text-xs text-red-500">{errors.city.message}</p>}
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-sm font-medium text-gray-700">Motivo</Label>
                            <Input
                                {...register("reason")}
                                placeholder="Ex: Excesso de velocidade"
                                className="h-10 border-gray-200"
                            />
                            {errors.reason && <p className="text-xs text-red-500">{errors.reason.message}</p>}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-sm font-medium text-gray-700">Valor</Label>
                                <CurrencyInput
                                    value={watch("amount")}
                                    onChange={(val) => setValue("amount", val)}
                                    className="h-10 border-gray-200"
                                />
                                {errors.amount && <p className="text-xs text-red-500">{errors.amount.message}</p>}
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-sm font-medium text-gray-700">Motorista</Label>
                                <Input
                                    {...register("driver_name")}
                                    placeholder="Nome do motorista"
                                    className="h-10 border-gray-200"
                                />
                                {errors.driver_name && <p className="text-xs text-red-500">{errors.driver_name.message}</p>}
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-sm font-medium text-gray-700">Observações</Label>
                            <Textarea
                                {...register("notes")}
                                placeholder="Observações adicionais..."
                                className="min-h-20 border-gray-200"
                            />
                        </div>

                        <div className="flex items-center space-x-2 pt-2">
                            <Checkbox
                                id="deducted"
                                checked={watch("deducted_from_driver")}
                                onCheckedChange={(checked) => setValue("deducted_from_driver", checked as boolean)}
                            />
                            <Label
                                htmlFor="deducted"
                                className="text-sm font-medium text-gray-700 cursor-pointer"
                            >
                                Descontado do motorista
                            </Label>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={loading} className="min-w-32">
                            {loading ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Salvando...
                                </>
                            ) : (
                                <>
                                    <Save className="w-4 h-4 mr-2" />
                                    Salvar
                                </>
                            )}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
