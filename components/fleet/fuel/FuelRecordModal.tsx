"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { CurrencyInput } from "@/components/ui/CurrencyInput";
import { Label } from "@/components/ui/Label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { saveFuelRecordAction } from "@/app/actions/fuel-records-actions";
import { FuelRecordRow } from "@/lib/types/fuel-records";
import { fuelTypeLabels, FleetVehicleRow } from "@/lib/types/fleet";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Save } from "lucide-react";

interface FuelRecordModalProps {
    isOpen: boolean;
    onClose: () => void;
    vehicleId: string;
    vehicleData: FleetVehicleRow;
    initialData?: FuelRecordRow;
    onSuccess?: () => void;
}

interface FormData {
    fuel_date: string;
    odometer_km: number | string;
    fuel_type: string;
    quantity_liters: number | string;
    price_per_liter: number | string;
    total_amount: number | string;
    gas_station: string;
    notes: string;
}

export function FuelRecordModal({ isOpen, onClose, vehicleId, vehicleData, initialData, onSuccess }: FuelRecordModalProps) {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const { register, handleSubmit, setValue, watch, reset } = useForm<FormData>({
        defaultValues: {
            fuel_date: initialData?.fuel_date || new Date().toISOString().split('T')[0],
            odometer_km: initialData?.odometer_km || '',
            fuel_type: initialData?.fuel_type || vehicleData.fuel_type || 'gasoline',
            quantity_liters: initialData?.quantity_liters || '',
            price_per_liter: initialData?.price_per_liter || '',
            total_amount: initialData?.total_amount || '',
            gas_station: initialData?.gas_station || '',
            notes: initialData?.notes || '',
        }
    });

    const quantityLiters = watch('quantity_liters');
    const pricePerLiter = watch('price_per_liter');
    const totalAmount = watch('total_amount');

    // Dynamic calculation: when quantity or price per liter changes, update total
    useEffect(() => {
        const qty = parseFloat(String(quantityLiters));
        const price = parseFloat(String(pricePerLiter));

        if (!isNaN(qty) && qty > 0 && !isNaN(price) && price > 0) {
            const calculatedTotal = qty * price;
            setValue('total_amount', calculatedTotal);
        }
    }, [quantityLiters, pricePerLiter, setValue]);

    // Dynamic calculation: when total changes (and quantity is set), update price per liter
    const handleTotalChange = (value: number) => {
        setValue('total_amount', value);

        const qty = parseFloat(String(quantityLiters));

        if (value > 0 && !isNaN(qty) && qty > 0) {
            const calculatedPrice = value / qty;
            setValue('price_per_liter', calculatedPrice);
        }
    };

    const handlePriceChange = (value: number) => {
        setValue('price_per_liter', value);
    };

    const onSubmit = async (data: FormData) => {
        setLoading(true);

        const payload = {
            id: initialData?.id,
            vehicle_id: vehicleId,
            fuel_date: data.fuel_date,
            odometer_km: parseInt(String(data.odometer_km)),
            fuel_type: data.fuel_type,
            quantity_liters: parseFloat(String(data.quantity_liters)),
            price_per_liter: parseFloat(String(data.price_per_liter)),
            total_amount: parseFloat(String(data.total_amount)),
            gas_station: data.gas_station || null,
            notes: data.notes || null,
        };

        const result = await saveFuelRecordAction(payload);

        if (result.ok) {
            toast({
                title: "Sucesso!",
                description: initialData ? "Abastecimento atualizado." : "Abastecimento registrado.",
            });
            reset();
            onSuccess?.();
            onClose();
        } else {
            toast({
                title: "Erro ao salvar",
                description: result.error.message,
                variant: "destructive"
            });
        }

        setLoading(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-screen overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{initialData ? "Editar Abastecimento" : "Novo Abastecimento"}</DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                    {/* Card: Dados do Abastecimento */}
                    <div className="border border-gray-200 rounded-2xl p-6 space-y-4">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="w-8 h-8 rounded-2xl bg-brand-50 flex items-center justify-center">
                                <svg className="w-4 h-4 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                            </div>
                            <div>
                                <h3 className="font-semibold text-gray-900">Dados do abastecimento</h3>
                                <p className="text-sm text-gray-500">Informações sobre o abastecimento realizado</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            {/* Data */}
                            <div className="space-y-1.5">
                                <Label className="text-sm font-medium text-gray-700">Data</Label>
                                <Input
                                    type="date"
                                    {...register('fuel_date')}
                                    required
                                    className="h-10"
                                />
                            </div>

                            {/* Odômetro */}
                            <div className="space-y-1.5">
                                <Label className="text-sm font-medium text-gray-700">Odômetro (km)</Label>
                                <Input
                                    type="number"
                                    {...register('odometer_km')}
                                    placeholder="Ex: 15000"
                                    required
                                    min="0"
                                    step="1"
                                    className="h-10"
                                />
                            </div>

                            {/* Tipo de Combustível */}
                            <div className="space-y-1.5">
                                <Label className="text-sm font-medium text-gray-700">Combustível</Label>
                                <Select
                                    onValueChange={(val) => setValue('fuel_type', val)}
                                    value={watch('fuel_type')}
                                >
                                    <SelectTrigger className="h-10">
                                        <SelectValue placeholder="Selecione..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {Object.entries(fuelTypeLabels).map(([value, label]) => (
                                            <SelectItem key={value} value={value}>{label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Quantidade (Litros) */}
                            <div className="space-y-1.5">
                                <Label className="text-sm font-medium text-gray-700">Quantidade (litros)</Label>
                                <Input
                                    type="number"
                                    {...register('quantity_liters')}
                                    placeholder="Ex: 40.5"
                                    required
                                    min="0.01"
                                    step="0.01"
                                    className="h-10"
                                />
                            </div>

                            {/* Preço por Litro */}
                            <div className="space-y-1.5">
                                <Label className="text-sm font-medium text-gray-700">Preço por litro</Label>
                                <CurrencyInput
                                    value={parseFloat(String(watch('price_per_liter'))) || 0}
                                    onChange={handlePriceChange}
                                    required
                                    className="h-10"
                                />
                            </div>

                            {/* Valor Total */}
                            <div className="space-y-1.5">
                                <Label className="text-sm font-medium text-gray-700">Valor total</Label>
                                <CurrencyInput
                                    value={parseFloat(String(watch('total_amount'))) || 0}
                                    onChange={handleTotalChange}
                                    required
                                    className="h-10"
                                />
                            </div>

                            {/* Posto */}
                            <div className="col-span-3 space-y-1.5">
                                <Label className="text-sm font-medium text-gray-700">Posto</Label>
                                <Input
                                    {...register('gas_station')}
                                    placeholder="Ex: Shell, Petrobras, Ipiranga..."
                                    className="h-10"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Card: Observações */}
                    <div className="border border-gray-200 rounded-2xl p-6 space-y-4">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="w-8 h-8 rounded-2xl bg-gray-50 flex items-center justify-center">
                                <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <div>
                                <h3 className="font-semibold text-gray-900">Observações</h3>
                                <p className="text-sm text-gray-500">Anotações adicionais sobre este abastecimento</p>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Textarea
                                {...register('notes')}
                                placeholder="Anotações sobre este abastecimento..."
                                rows={3}
                                className="resize-none"
                            />
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={onClose}
                            disabled={loading}
                        >
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                            Salvar
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
