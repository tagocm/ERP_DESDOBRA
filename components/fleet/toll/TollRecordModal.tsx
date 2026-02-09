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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/use-toast";
import { saveTollRecordAction } from "@/app/actions/toll-records-actions";
import { TollRecordRow, PaymentMethod, paymentMethodLabels } from "@/lib/types/toll-records";
import { tollRecordSchema, TollRecordSchema } from "@/lib/validations/toll-records";
import { Loader2, Save } from "lucide-react";
import { CurrencyInput } from "@/components/ui/CurrencyInput";

interface TollRecordModalProps {
    isOpen: boolean;
    onClose: () => void;
    vehicleId: string;
    initialData?: TollRecordRow;
    onSuccess?: () => void;
}

export function TollRecordModal({ isOpen, onClose, vehicleId, initialData, onSuccess }: TollRecordModalProps) {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);

    const form = useForm<TollRecordSchema>({
        resolver: zodResolver(tollRecordSchema) as Resolver<TollRecordSchema>,
        defaultValues: initialData ? {
            id: initialData.id,
            vehicle_id: initialData.vehicle_id,
            toll_date: initialData.toll_date,
            toll_time: initialData.toll_time,
            location: initialData.location,
            amount: initialData.amount,
            payment_method: initialData.payment_method as PaymentMethod,
            notes: initialData.notes || '',
        } : {
            vehicle_id: vehicleId,
            toll_date: new Date().toISOString().split('T')[0],
            toll_time: new Date().toTimeString().slice(0, 5),
            location: '',
            amount: 0,
            payment_method: 'cash',
            notes: '',
        }
    });

    const { register, handleSubmit, setValue, watch, formState: { errors }, reset } = form;

    const onSubmit: SubmitHandler<TollRecordSchema> = async (data) => {
        setLoading(true);
        const result = await saveTollRecordAction(data);

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
                    <DialogTitle>{initialData ? "Editar Pedágio" : "Novo Pedágio"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                    {/* Card: Dados do Pedágio */}
                    <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
                        <h3 className="text-sm font-semibold text-gray-900">Dados do pedágio</h3>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-sm font-medium text-gray-700">Data</Label>
                                <Input
                                    type="date"
                                    {...register("toll_date")}
                                    className="h-10 border-gray-200"
                                />
                                {errors.toll_date && <p className="text-xs text-red-500">{errors.toll_date.message}</p>}
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-sm font-medium text-gray-700">Horário</Label>
                                <Input
                                    type="time"
                                    {...register("toll_time")}
                                    className="h-10 border-gray-200"
                                />
                                {errors.toll_time && <p className="text-xs text-red-500">{errors.toll_time.message}</p>}
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-sm font-medium text-gray-700">Praça de pedágio / Estacionamento</Label>
                            <Input
                                {...register("location")}
                                placeholder="Ex: Praça de Pedágio Km 120"
                                className="h-10 border-gray-200"
                            />
                            {errors.location && <p className="text-xs text-red-500">{errors.location.message}</p>}
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
                                <Label className="text-sm font-medium text-gray-700">Forma de pagamento</Label>
                                <Select
                                    onValueChange={(val: PaymentMethod) => setValue("payment_method", val)}
                                    value={watch("payment_method") || undefined}
                                >
                                    <SelectTrigger className="h-10">
                                        <SelectValue placeholder="Selecione..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {Object.entries(paymentMethodLabels).map(([val, label]) => (
                                            <SelectItem key={val} value={val}>{label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {errors.payment_method && <p className="text-xs text-red-500">{errors.payment_method.message}</p>}
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
