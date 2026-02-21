"use client";

import { useForm, SubmitHandler, Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { CardHeaderStandard } from "@/components/ui/CardHeaderStandard";
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
import { saveVehicleAction } from "@/app/actions/fleet-actions";
import {
    FleetVehicleRow,
    VehicleType,
    vehicleTypeLabels,
    FuelType,
    fuelTypeLabels,
    ActionResult
} from "@/lib/types/fleet";
import { vehicleSchema, VehicleSchema } from "@/lib/validations/fleet";
import {
    Car,
    FileText,
    Gauge,
    Info,
    Save,
    Loader2,
    Settings2,
    ChevronLeft
} from "lucide-react";
import Link from "next/link";

interface VehicleFormProps {
    initialData?: FleetVehicleRow;
    isEdit?: boolean;
    onSubmitStateChange?: (isSubmitting: boolean) => void;
}

export function VehicleForm({ initialData, isEdit, onSubmitStateChange }: VehicleFormProps) {
    const router = useRouter();
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);

    const form = useForm<VehicleSchema>({
        // Casting resolver due to occasional TS version mismatch in node_modules
        resolver: zodResolver(vehicleSchema) as Resolver<VehicleSchema>,
        defaultValues: initialData ? {
            ...initialData,
            plate: initialData.plate || '',
            brand: initialData.brand || '',
            model: initialData.model || '',
            color: initialData.color || '',
            renavam: initialData.renavam || '',
            chassis: initialData.chassis || '',
            cost_center_id: initialData.cost_center_id || undefined,
            type: (initialData.type as VehicleType) || 'car',
            fuel_type: (initialData.fuel_type as FuelType) || 'flex',
            is_active: initialData.is_active ?? true,
        } : {
            is_active: true,
            type: 'car',
            fuel_type: 'flex',
            name: '',
            plate: '',
        }
    });

    const { register, handleSubmit, setValue, watch, formState: { errors } } = form;

    const onSubmit: SubmitHandler<VehicleSchema> = async (data) => {
        setLoading(true);
        onSubmitStateChange?.(true);
        const result = await saveVehicleAction(data);

        if (result.ok) {
            toast({
                title: "Sucesso!",
                description: isEdit ? "Veículo atualizado com sucesso." : "Veículo cadastrado com sucesso.",
            });
            router.push("/app/frota");
        } else {
            toast({ title: "Erro ao salvar", description: result.error.message, variant: "destructive" });
        }
        setLoading(false);
        onSubmitStateChange?.(false);
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8 pb-32" id="vehicle-form">

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                    {/* Card 1: Identificação */}
                    <Card className="border-none shadow-card rounded-2xl bg-white overflow-hidden">
                        <CardHeaderStandard
                            title="Identificação"
                            description="Nome, placa e características básicas."
                            icon={<Car className="w-5 h-5 text-brand-500" />}
                        />
                        <div className="p-6 space-y-4">
                            {/* Nome do Veículo - Full width */}
                            <div className="space-y-1.5">
                                <Label className="text-sm font-medium text-gray-700">Nome do veículo</Label>
                                <Input
                                    {...register("name")}
                                    placeholder="Ex: Fiat Fiorino - Entrega 01"
                                    className="h-10 border-gray-200"
                                />
                                {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
                            </div>

                            {/* Placa e Tipo */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label className="text-sm font-medium text-gray-700">Placa</Label>
                                    <Input
                                        {...register("plate")}
                                        placeholder="AAA-0000"
                                        className="h-10 border-gray-200 uppercase"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <Label className="text-sm font-medium text-gray-700">Tipo de veículo</Label>
                                    <Select
                                        onValueChange={(val: VehicleType) => setValue("type", val)}
                                        value={watch("type") || undefined}
                                    >
                                        <SelectTrigger className="h-10">
                                            <SelectValue placeholder="Selecione..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {Object.entries(vehicleTypeLabels).map(([val, label]) => (
                                                <SelectItem key={val} value={val}>{label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {/* Marca e Modelo */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label className="text-sm font-medium text-gray-700">Marca</Label>
                                    <Input
                                        {...register("brand")}
                                        placeholder="Ex: Fiat"
                                        className="h-10 border-gray-200"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <Label className="text-sm font-medium text-gray-700">Modelo</Label>
                                    <Input
                                        {...register("model")}
                                        placeholder="Ex: Fiorino"
                                        className="h-10 border-gray-200"
                                    />
                                </div>
                            </div>

                            {/* Ano e Cor */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label className="text-sm font-medium text-gray-700">Ano</Label>
                                    <Input
                                        type="number"
                                        {...register("year")}
                                        placeholder="2024"
                                        className="h-10 border-gray-200"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <Label className="text-sm font-medium text-gray-700">Cor</Label>
                                    <Input
                                        {...register("color")}
                                        placeholder="Ex: Branco"
                                        className="h-10 border-gray-200"
                                    />
                                </div>
                            </div>
                        </div>
                    </Card>

                    {/* Card 2: Documentos */}
                    <Card className="border-none shadow-card rounded-2xl bg-white overflow-hidden">
                        <CardHeaderStandard
                            title="Documentação"
                            description="Identificadores legais e de registro."
                            icon={<FileText className="w-5 h-5 text-blue-500" />}
                        />
                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label className="text-sm font-medium text-gray-700">RENAVAM</Label>
                                    <Input
                                        {...register("renavam")}
                                        className="h-10 border-gray-200"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-sm font-medium text-gray-700">Chassi</Label>
                                    <Input
                                        {...register("chassis")}
                                        className="h-10 border-gray-200 uppercase"
                                    />
                                </div>
                            </div>
                        </div>
                    </Card>

                    {/* Card 3: Controle e Capacidade */}
                    <Card className="border-none shadow-card rounded-2xl bg-white overflow-hidden">
                        <CardHeaderStandard
                            title="Controle"
                            description="Consumo, odômetro e centro de custo."
                            icon={<Gauge className="w-5 h-5 text-emerald-500" />}
                        />
                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label className="text-sm font-medium text-gray-700">Consumo médio (km/L)</Label>
                                    <Input
                                        type="text"
                                        value={initialData?.avg_fuel_consumption_km_l?.toFixed(2) || "—"}
                                        disabled
                                        className="h-10 border-gray-200 bg-gray-50 text-gray-600 cursor-not-allowed"
                                    />
                                    <p className="text-xs text-gray-400">Calculado automaticamente com base nos abastecimentos.</p>
                                </div>

                                <div className="space-y-1.5">
                                    <Label className="text-sm font-medium text-gray-700">Combustível</Label>
                                    <Select
                                        onValueChange={(val: FuelType) => setValue("fuel_type", val)}
                                        value={watch("fuel_type") || undefined}
                                    >
                                        <SelectTrigger className="h-10">
                                            <SelectValue placeholder="Selecione..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {Object.entries(fuelTypeLabels).map(([val, label]) => (
                                                <SelectItem key={val} value={val}>{label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label className="text-sm font-medium text-gray-700">Tanque (litros)</Label>
                                    <Input
                                        type="number"
                                        {...register("tank_capacity_l")}
                                        placeholder="Ex: 50"
                                        className="h-10 border-gray-200"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <Label className="text-sm font-medium text-gray-700">KM inicial</Label>
                                    <Input
                                        type="number"
                                        {...register("odometer_initial_km")}
                                        className="h-10 border-gray-200"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label className="text-sm font-medium text-gray-700">KM atual</Label>
                                    <Input
                                        type="number"
                                        {...register("odometer_current_km")}
                                        className="h-10 border-gray-200"
                                    />
                                    <p className="text-xs text-gray-400">Será atualizado conforme registros de abastecimento/viagem.</p>
                                </div>

                                <div className="space-y-1.5">
                                    <Label className="text-sm font-medium text-gray-700">Centro de custo</Label>
                                    <Select onValueChange={(val) => setValue("cost_center_id", val)} value={watch("cost_center_id") || "default"}>
                                        <SelectTrigger className="h-10">
                                            <SelectValue placeholder="Selecione..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="default">Geral</SelectItem>
                                            {/* Futuramente carregar do banco */}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>
                    </Card>
                </div>

                <div className="space-y-8">
                    {/* Card 4: Status */}
                    <Card className="border-none shadow-card rounded-2xl bg-white overflow-hidden">
                        <CardHeaderStandard
                            title="Status"
                            description="Ativar ou desativar o veículo."
                            icon={<Settings2 className="w-5 h-5 text-gray-400" />}
                        />
                        <div className="p-6 space-y-4">
                            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
                                <div>
                                    <p className="text-sm font-semibold text-gray-900">Veículo ativo</p>
                                    <p className="text-xs text-gray-500">Disponível para uso e lançamentos.</p>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={watch("is_active")}
                                    onChange={(e) => setValue("is_active", e.target.checked)}
                                    className="w-5 h-5 rounded text-brand-600 focus:ring-brand-500 border-gray-300 transition-all cursor-pointer"
                                />
                            </div>
                        </div>
                    </Card>

                    {/* Card 5: Observações */}
                    <Card className="border-none shadow-card rounded-2xl bg-white overflow-hidden">
                        <CardHeaderStandard
                            title="Observações"
                            icon={<Info className="w-5 h-5 text-gray-400" />}
                        />
                        <div className="p-6">
                            <Textarea
                                placeholder="Observações internas sobre o veículo..."
                                className="min-h-32 bg-white border-gray-200"
                            />
                        </div>
                    </Card>
                </div>
            </div>
        </form>
    );
}
