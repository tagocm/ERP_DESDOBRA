"use client";

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Edit2, Truck, Car, Bike, HelpCircle, Power, AlertTriangle, CheckCircle } from "lucide-react";
import Link from "next/link";
import { FleetVehicleListItem, ActionResult } from "@/lib/types/fleet";
import { toggleVehicleActiveAction } from "@/app/actions/fleet-actions";
import { useToast } from "@/components/ui/use-toast";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useState } from "react";

interface FleetTableProps {
    vehicles: FleetVehicleListItem[];
}

export function FleetTable({ vehicles }: FleetTableProps) {
    const { toast } = useToast();
    const [confirmId, setConfirmId] = useState<string | null>(null);

    const getIcon = (type: string | null) => {
        switch (type) {
            case 'truck': return <Truck className="w-4 h-4" />;
            case 'car': return <Car className="w-4 h-4" />;
            case 'motorcycle': return <Bike className="w-4 h-4" />;
            default: return <HelpCircle className="w-4 h-4" />;
        }
    };

    const handleToggleActive = async (id: string, currentStatus: boolean) => {
        const result: ActionResult = await toggleVehicleActiveAction(id, !currentStatus);
        if (result.ok) {
            toast({
                title: "Status atualizado!",
                description: `O veículo foi ${!currentStatus ? 'ativado' : 'inativado'} com sucesso.`,
            });
            setConfirmId(null);
        } else {
            toast({ title: "Erro", description: result.error.message, variant: "destructive" });
        }
    };

    const selectedVehicle = vehicles.find(v => v.id === confirmId);

    return (
        <div className="w-full">
            <Table>
                <TableHeader className="bg-gray-50/50">
                    <TableRow className="border-gray-100 hover:bg-transparent">
                        <TableHead className="w-12 pl-6"></TableHead>
                        <TableHead className="font-semibold text-gray-900 uppercase text-[10px] tracking-widest px-4">Veículo</TableHead>
                        <TableHead className="font-semibold text-gray-900 uppercase text-[10px] tracking-widest px-4">Placa</TableHead>
                        <TableHead className="font-semibold text-gray-900 uppercase text-[10px] tracking-widest px-4 text-center">KM Atual</TableHead>
                        <TableHead className="font-semibold text-gray-900 uppercase text-[10px] tracking-widest px-4 text-center">Status</TableHead>
                        <TableHead className="text-right pr-6 uppercase text-[10px] tracking-widest">Ações</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {vehicles.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={6} className="h-48 text-center text-gray-500 italic">
                                Nenhum veículo encontrado.
                            </TableCell>
                        </TableRow>
                    ) : (
                        vehicles.map((v) => (
                            <TableRow key={v.id} className="group border-gray-50 hover:bg-gray-50/50 transition-colors">
                                <TableCell className="pl-6">
                                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 group-hover:bg-brand-50 group-hover:text-brand-600 transition-colors">
                                        {getIcon(v.type)}
                                    </div>
                                </TableCell>
                                <TableCell className="px-4 py-4">
                                    <div className="flex flex-col">
                                        <span className="font-bold text-gray-900 leading-none mb-1">{v.name}</span>
                                        <span className="text-xs text-gray-500">
                                            {v.brand} {v.model} {v.year && `• ${v.year}`}
                                        </span>
                                    </div>
                                </TableCell>
                                <TableCell className="px-4">
                                    <Badge variant="outline" className="font-mono bg-white border-gray-200 text-gray-600 rounded-full">
                                        {v.plate || 'S/ PLACA'}
                                    </Badge>
                                </TableCell>
                                <TableCell className="px-4 text-center font-mono text-xs text-gray-600">
                                    {v.odometer_current_km ? `${v.odometer_current_km.toLocaleString('pt-BR')} km` : '-'}
                                </TableCell>
                                <TableCell className="px-4 text-center">
                                    <Badge className={v.is_active ? "bg-green-100 text-green-700 hover:bg-green-100 border-none px-2.5" : "bg-red-100 text-red-700 hover:bg-red-100 border-none px-2.5"}>
                                        {v.is_active ? "Ativo" : "Inativo"}
                                    </Badge>
                                </TableCell>
                                <TableCell className="pr-6 text-right">
                                    <div className="flex justify-end gap-1">
                                        <Link href={`/app/frota/${v.id}`}>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-gray-400 hover:text-brand-600 hover:bg-brand-50 transition-colors">
                                                <Edit2 className="w-4 h-4" />
                                            </Button>
                                        </Link>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => {
                                                if (v.is_active) {
                                                    setConfirmId(v.id);
                                                } else {
                                                    handleToggleActive(v.id, false);
                                                }
                                            }}
                                            className={`h-8 w-8 rounded-full transition-colors ${v.is_active
                                                ? 'text-gray-400 hover:text-red-500 hover:bg-red-50'
                                                : 'text-gray-400 hover:text-green-500 hover:bg-green-50'
                                                }`}
                                            title={v.is_active ? "Inativar" : "Ativar"}
                                        >
                                            {v.is_active ? <Power className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>

            <AlertDialog open={!!confirmId} onOpenChange={(open) => !open && setConfirmId(null)}>
                <AlertDialogContent className="rounded-2xl border-none shadow-premium">
                    <AlertDialogHeader>
                        <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mb-4">
                            <AlertTriangle className="w-6 h-6 text-red-500" />
                        </div>
                        <AlertDialogTitle className="text-xl font-bold">Deseja inativar o veículo?</AlertDialogTitle>
                        <AlertDialogDescription className="text-gray-500">
                            O veículo <strong>{selectedVehicle?.name}</strong> será marcado como inativo. Ele não será removido do sistema, mas não poderá ser usado em novos lançamentos operacionais.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="mt-6">
                        <AlertDialogCancel className="border-none hover:bg-gray-100 rounded-2xl">Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => selectedVehicle && handleToggleActive(selectedVehicle.id, true)}
                            className="bg-red-500 hover:bg-red-600 text-white rounded-2xl"
                        >
                            Confirmar Inativação
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
