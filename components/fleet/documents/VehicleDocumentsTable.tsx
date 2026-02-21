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
import { Edit2, Calendar, Trash2, FileText, CheckCircle2, AlertTriangle, Clock } from "lucide-react";
import { VehicleDocumentRow } from "@/app/actions/vehicle-documents-actions";
import { formatCurrency } from "@/lib/utils";
import { deleteVehicleDocumentAction } from "@/app/actions/vehicle-documents-actions";
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

interface VehicleDocumentsTableProps {
    records: VehicleDocumentRow[];
    onEdit: (record: VehicleDocumentRow) => void;
    onDelete?: () => void;
}

export function VehicleDocumentsTable({ records, onEdit, onDelete }: VehicleDocumentsTableProps) {
    const { toast } = useToast();
    const [confirmId, setConfirmId] = useState<string | null>(null);

    const handleDelete = async (id: string) => {
        const result = await deleteVehicleDocumentAction(id);
        if (result.ok) {
            toast({
                title: "Sucesso!",
                description: "Documento excluído. Lançamentos financeiros pendentes removidos.",
            });
            setConfirmId(null);
            onDelete?.();
        } else {
            toast({ title: "Erro", description: result.error?.message ?? "Não foi possível concluir a operação.", variant: "destructive" });
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'VENCIDO':
                return (
                    <Badge variant="outline" className="bg-red-50 border-red-200 text-red-700 rounded-full">
                        <AlertTriangle className="w-3 h-3 mr-1" /> Vencido
                    </Badge>
                );
            default:
                return (
                    <Badge variant="outline" className="bg-yellow-50 border-yellow-200 text-yellow-700 rounded-full">
                        <Clock className="w-3 h-3 mr-1" /> Em Aberto
                    </Badge>
                );
        }
    };

    return (
        <div className="w-full">
            <Table>
                <TableHeader className="bg-gray-50/50">
                    <TableRow className="border-gray-100 hover:bg-transparent">
                        <TableHead className="w-12 pl-6"></TableHead>
                        <TableHead className="font-semibold text-gray-900 uppercase text-[10px] tracking-widest px-4">Competência</TableHead>
                        <TableHead className="font-semibold text-gray-900 uppercase text-[10px] tracking-widest px-4">Tipo</TableHead>
                        <TableHead className="font-semibold text-gray-900 uppercase text-[10px] tracking-widest px-4 text-center">Parcelas</TableHead>
                        <TableHead className="font-semibold text-gray-900 uppercase text-[10px] tracking-widest px-4">1º Vencimento</TableHead>
                        <TableHead className="font-semibold text-gray-900 uppercase text-[10px] tracking-widest px-4 text-right">Valor Total</TableHead>
                        <TableHead className="font-semibold text-gray-900 uppercase text-[10px] tracking-widest px-4 text-center">Status</TableHead>
                        <TableHead className="text-right pr-6 uppercase text-[10px] tracking-widest">Ações</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {records.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={8} className="h-48 text-center text-gray-500 italic">
                                Nenhum documento encontrado.
                            </TableCell>
                        </TableRow>
                    ) : (
                        records.map((record) => (
                            <TableRow key={record.id} className="group border-gray-50 hover:bg-gray-50/50 transition-colors">
                                <TableCell className="pl-6">
                                    <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-400 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
                                        <FileText className="w-4 h-4" />
                                    </div>
                                </TableCell>
                                <TableCell className="px-4 font-medium text-gray-900">
                                    {record.competency_year}
                                </TableCell>
                                <TableCell className="px-4">
                                    <span className="text-sm font-medium text-gray-700">
                                        {record.type}
                                    </span>
                                </TableCell>
                                <TableCell className="px-4 text-center">
                                    <Badge variant="secondary" className="bg-gray-100 text-gray-700 hover:bg-gray-200 border-none">
                                        {record.installments_count}x
                                    </Badge>
                                </TableCell>
                                <TableCell className="px-4">
                                    <div className="flex items-center gap-1.5">
                                        <Calendar className="w-3 h-3 text-gray-400" />
                                        <span className="text-sm text-gray-700">
                                            {new Date(record.first_due_date).toLocaleDateString('pt-BR')}
                                        </span>
                                    </div>
                                </TableCell>
                                <TableCell className="px-4 text-right">
                                    <span className="font-semibold text-gray-900">
                                        {formatCurrency(record.amount)}
                                    </span>
                                </TableCell>
                                <TableCell className="px-4 text-center">
                                    {getStatusBadge(record.status)}
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
                        <AlertDialogTitle className="text-xl font-bold">Deseja excluir este documento?</AlertDialogTitle>
                        <AlertDialogDescription className="text-gray-500">
                            Esta ação excluirá todos os lançamentos financeiros pendentes associados.
                            <br /><br />
                            <span className="font-semibold text-amber-600">Atenção:</span> Se houver lançamentos já aprovados, a exclusão será bloqueada.
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
