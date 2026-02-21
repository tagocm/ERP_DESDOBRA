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
import { Edit2, Calendar, Trash2, AlertTriangle, MapPin, User, CheckCircle2, XCircle } from "lucide-react";
import { TrafficFineRow } from "@/lib/types/traffic-fines";
import { formatCurrency } from "@/lib/utils";
import { deleteTrafficFineAction } from "@/app/actions/traffic-fines-actions";
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

interface TrafficFinesTableProps {
    records: TrafficFineRow[];
    onEdit: (record: TrafficFineRow) => void;
    onDelete?: () => void;
}

export function TrafficFinesTable({ records, onEdit, onDelete }: TrafficFinesTableProps) {
    const { toast } = useToast();
    const [confirmId, setConfirmId] = useState<string | null>(null);

    const handleDelete = async (id: string) => {
        const result = await deleteTrafficFineAction(id);
        if (result.ok) {
            toast({
                title: "Sucesso!",
                description: "Registro de multa excluído.",
            });
            setConfirmId(null);
            onDelete?.();
        } else {
            toast({ title: "Erro", description: result.error.message, variant: "destructive" });
        }
    };

    return (
        <div className="w-full">
            <Table>
                <TableHeader className="bg-gray-50/50">
                    <TableRow className="border-gray-100 hover:bg-transparent">
                        <TableHead className="w-12 pl-6"></TableHead>
                        <TableHead className="font-semibold text-gray-900 uppercase text-[10px] tracking-widest px-4">Data</TableHead>
                        <TableHead className="font-semibold text-gray-900 uppercase text-[10px] tracking-widest px-4">Cidade</TableHead>
                        <TableHead className="font-semibold text-gray-900 uppercase text-[10px] tracking-widest px-4">Motivo</TableHead>
                        <TableHead className="font-semibold text-gray-900 uppercase text-[10px] tracking-widest px-4">Motorista</TableHead>
                        <TableHead className="font-semibold text-gray-900 uppercase text-[10px] tracking-widest px-4 text-right">Valor</TableHead>
                        <TableHead className="font-semibold text-gray-900 uppercase text-[10px] tracking-widest px-4 text-center">Descontado</TableHead>
                        <TableHead className="text-right pr-6 uppercase text-[10px] tracking-widest">Ações</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {records.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={8} className="h-48 text-center text-gray-500 italic">
                                Nenhum registro de multa encontrado.
                            </TableCell>
                        </TableRow>
                    ) : (
                        records.map((record) => (
                            <TableRow key={record.id} className="group border-gray-50 hover:bg-gray-50/50 transition-colors">
                                <TableCell className="pl-6">
                                    <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center text-red-400 group-hover:bg-red-100 group-hover:text-red-600 transition-colors">
                                        <AlertTriangle className="w-4 h-4" />
                                    </div>
                                </TableCell>
                                <TableCell className="px-4 py-4">
                                    <div className="flex items-center gap-1.5">
                                        <Calendar className="w-3 h-3 text-gray-400" />
                                        <span className="font-bold text-gray-900 leading-none">
                                            {new Date(record.fine_date).toLocaleDateString('pt-BR')}
                                        </span>
                                    </div>
                                </TableCell>
                                <TableCell className="px-4">
                                    <div className="flex items-center gap-1.5">
                                        <MapPin className="w-3 h-3 text-gray-400" />
                                        <span className="font-medium text-gray-900 text-sm">
                                            {record.city}
                                        </span>
                                    </div>
                                </TableCell>
                                <TableCell className="px-4">
                                    <span className="text-sm text-gray-600">
                                        {record.reason}
                                    </span>
                                </TableCell>
                                <TableCell className="px-4">
                                    <div className="flex items-center gap-1.5">
                                        <User className="w-3 h-3 text-gray-400" />
                                        <span className="text-sm text-gray-700 font-medium">
                                            {record.driver_name}
                                        </span>
                                    </div>
                                </TableCell>
                                <TableCell className="px-4 text-right">
                                    <span className="font-semibold text-red-600">
                                        {formatCurrency(record.amount)}
                                    </span>
                                </TableCell>
                                <TableCell className="px-4 text-center">
                                    {record.deducted_from_driver ? (
                                        <Badge variant="outline" className="bg-green-50 border-green-200 text-green-700 rounded-full">
                                            <CheckCircle2 className="w-3 h-3 mr-1" />
                                            Sim
                                        </Badge>
                                    ) : (
                                        <Badge variant="outline" className="bg-gray-50 border-gray-200 text-gray-600 rounded-full">
                                            <XCircle className="w-3 h-3 mr-1" />
                                            Não
                                        </Badge>
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
                        <AlertDialogTitle className="text-xl font-bold">Deseja excluir este registro?</AlertDialogTitle>
                        <AlertDialogDescription className="text-gray-500">
                            Esta ação não pode ser desfeita. O registro de multa será permanentemente removido.
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
