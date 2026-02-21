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
import { Edit2, Fuel, Calendar, Gauge, Trash2 } from "lucide-react";
import { FuelRecordRow } from "@/lib/types/fuel-records";
import { fuelTypeLabels } from "@/lib/types/fleet";
import { formatCurrency } from "@/lib/utils";
import { deleteFuelRecordAction } from "@/app/actions/fuel-records-actions";
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
import { AlertTriangle } from "lucide-react";

interface FuelRecordsTableProps {
    records: FuelRecordRow[];
    onEdit: (record: FuelRecordRow) => void;
    onDelete?: () => void;
}

export function FuelRecordsTable({ records, onEdit, onDelete }: FuelRecordsTableProps) {
    const { toast } = useToast();
    const [confirmId, setConfirmId] = useState<string | null>(null);

    const handleDelete = async (id: string) => {
        const result = await deleteFuelRecordAction(id);
        if (result.ok) {
            toast({
                title: "Sucesso!",
                description: "Abastecimento excluído.",
            });
            setConfirmId(null);
            onDelete?.();
        } else {
            toast({ title: "Erro", description: result.error.message, variant: "destructive" });
        }
    };

    const selectedRecord = records.find(r => r.id === confirmId);

    // Calculate consumption between consecutive records
    const getConsumption = (record: FuelRecordRow, index: number): number | null => {
        const prevRecord = records[index + 1];
        if (!prevRecord) return null;

        const kmDiff = record.odometer_km - prevRecord.odometer_km;
        if (kmDiff > 0 && record.quantity_liters > 0) {
            return kmDiff / record.quantity_liters;
        }
        return null;
    };

    return (
        <div className="w-full">
            <Table>
                <TableHeader className="bg-gray-50/50">
                    <TableRow className="border-gray-100 hover:bg-transparent">
                        <TableHead className="w-12 pl-6"></TableHead>
                        <TableHead className="font-semibold text-gray-900 uppercase text-[10px] tracking-widest px-4">Data / KM</TableHead>
                        <TableHead className="font-semibold text-gray-900 uppercase text-[10px] tracking-widest px-4">Combustível</TableHead>
                        <TableHead className="font-semibold text-gray-900 uppercase text-[10px] tracking-widest px-4 text-right">Preço/L</TableHead>
                        <TableHead className="font-semibold text-gray-900 uppercase text-[10px] tracking-widest px-4 text-right">Total</TableHead>
                        <TableHead className="font-semibold text-gray-900 uppercase text-[10px] tracking-widest px-4 text-center">Consumo</TableHead>
                        <TableHead className="text-right pr-6 uppercase text-[10px] tracking-widest">Ações</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {records.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={7} className="h-48 text-center text-gray-500 italic">
                                Nenhum abastecimento registrado.
                            </TableCell>
                        </TableRow>
                    ) : (
                        records.map((record, index) => {
                            const consumption = getConsumption(record, index);

                            return (
                                <TableRow key={record.id} className="group border-gray-50 hover:bg-gray-50/50 transition-colors">
                                    <TableCell className="pl-6">
                                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 group-hover:bg-brand-50 group-hover:text-brand-600 transition-colors">
                                            <Fuel className="w-4 h-4" />
                                        </div>
                                    </TableCell>
                                    <TableCell className="px-4 py-4">
                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-1.5 mb-1">
                                                <Calendar className="w-3 h-3 text-gray-400" />
                                                <span className="font-bold text-gray-900 leading-none">
                                                    {new Date(record.fuel_date).toLocaleDateString('pt-BR')}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <Gauge className="w-3 h-3 text-gray-400" />
                                                <span className="text-xs text-gray-500 font-mono">
                                                    {record.odometer_km.toLocaleString('pt-BR')} km
                                                </span>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="px-4">
                                        <div className="flex flex-col">
                                            <span className="font-medium text-gray-900 text-sm">
                                                {fuelTypeLabels[record.fuel_type as keyof typeof fuelTypeLabels] || record.fuel_type}
                                            </span>
                                            <span className="text-xs text-gray-500">
                                                {record.quantity_liters.toFixed(2)} L
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="px-4 text-right font-mono text-sm text-gray-600">
                                        {formatCurrency(record.price_per_liter)}
                                    </TableCell>
                                    <TableCell className="px-4 text-right">
                                        <span className="font-semibold text-brand-600">
                                            {formatCurrency(record.total_amount)}
                                        </span>
                                    </TableCell>
                                    <TableCell className="px-4 text-center">
                                        {consumption ? (
                                            <Badge variant="outline" className="font-mono bg-white border-gray-200 text-gray-600 rounded-full">
                                                {consumption.toFixed(2)} km/L
                                            </Badge>
                                        ) : (
                                            <span className="text-gray-400 text-sm">—</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="pr-6 text-right">
                                        <div className="flex justify-end gap-1">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 rounded-full text-gray-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                                                onClick={() => onEdit(record)}
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => setConfirmId(record.id)}
                                                className="h-8 w-8 rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                                title="Excluir"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            );
                        })
                    )}
                </TableBody>
            </Table>

            <AlertDialog open={!!confirmId} onOpenChange={(open) => !open && setConfirmId(null)}>
                <AlertDialogContent className="rounded-2xl border-none shadow-premium">
                    <AlertDialogHeader>
                        <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mb-4">
                            <AlertTriangle className="w-6 h-6 text-red-500" />
                        </div>
                        <AlertDialogTitle className="text-xl font-bold">Deseja excluir este abastecimento?</AlertDialogTitle>
                        <AlertDialogDescription className="text-gray-500">
                            Esta ação não pode ser desfeita. O registro de abastecimento será permanentemente removido.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="mt-6">
                        <AlertDialogCancel className="border-none hover:bg-gray-100 rounded-2xl">Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => confirmId && handleDelete(confirmId)}
                            className="bg-red-500 hover:bg-red-600 text-white rounded-2xl"
                        >
                            Confirmar Exclusão
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
