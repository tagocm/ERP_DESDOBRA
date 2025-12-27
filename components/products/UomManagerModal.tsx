"use client";

import { useEffect, useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogTrigger,
} from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Edit, Trash2, Plus, Loader2, Save, X, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Uom } from "@/types/product";
import { createUom, deleteUom, getAllUomsIncludingInactive, updateUom } from "@/lib/data/uoms";
import { useCompany } from "@/contexts/CompanyContext";
import { cn } from "@/lib/utils";
import { Alert } from "@/components/ui/Alert";
import { ConfirmDialogDesdobra } from "@/components/ui/ConfirmDialogDesdobra";

interface UomManagerModalProps {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    trigger?: React.ReactNode;
}

export function UomManagerModal({ open: controlledOpen, onOpenChange, trigger }: UomManagerModalProps) {
    const [internalOpen, setInternalOpen] = useState(false);
    const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;
    const setOpen = onOpenChange || setInternalOpen;

    const { selectedCompany } = useCompany();
    const { toast } = useToast();
    const [uoms, setUoms] = useState<Uom[]>([]);
    const [loading, setLoading] = useState(false);

    // Edit/Create State
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<{ name: string; abbrev: string }>({ name: "", abbrev: "" });
    const [isCreating, setIsCreating] = useState(false);

    // Delete State
    const [deletingId, setDeletingId] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            loadUoms();
        } else {
            // Reset state on close
            setEditingId(null);
            setIsCreating(false);
            setEditForm({ name: "", abbrev: "" });
        }
    }, [isOpen]);

    const loadUoms = async () => {
        setLoading(true);
        try {
            const data = await getAllUomsIncludingInactive();
            setUoms(data);
        } catch (error) {
            console.error(error);
            toast({ title: "Erro ao carregar unidades", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!selectedCompany?.id) return;
        if (!editForm.name.trim() || !editForm.abbrev.trim()) {
            toast({ title: "Preencha todos os campos", variant: "destructive" });
            return;
        }

        try {
            if (isCreating) {
                await createUom({
                    company_id: selectedCompany.id,
                    name: editForm.name.trim(),
                    abbrev: editForm.abbrev.trim(),
                    is_active: true,
                });
                toast({ title: "Unidade criada com sucesso!", className: "bg-green-600 text-white" });
            } else if (editingId) {
                await updateUom(editingId, {
                    name: editForm.name.trim(),
                    abbrev: editForm.abbrev.trim(),
                });
                toast({ title: "Unidade atualizada!", className: "bg-green-600 text-white" });
            }

            setEditingId(null);
            setIsCreating(false);
            setEditForm({ name: "", abbrev: "" });
            loadUoms();
        } catch (error: any) {
            console.error(error);
            // Handle unique constraint violation
            if (error.message?.includes("uoms_name_company_unique")) {
                toast({ title: "Já existe uma unidade com este nome.", variant: "destructive" });
            } else if (error.message?.includes("uoms_abbrev_company_unique")) {
                toast({ title: "Já existe uma unidade com esta abreviação.", variant: "destructive" });
            } else {
                toast({ title: "Erro ao salvar", variant: "destructive" });
            }
        }
    };

    const confirmDelete = async () => {
        if (!deletingId) return;
        try {
            await deleteUom(deletingId);
            toast({ title: "Unidade excluída.", className: "bg-green-600 text-white" });
            loadUoms();
        } catch (error: any) {
            console.error(error);
            toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
        } finally {
            setDeletingId(null);
        }
    };

    const startEdit = (uom: Uom) => {
        setEditingId(uom.id);
        setIsCreating(false);
        setEditForm({ name: uom.name, abbrev: uom.abbrev });
    };

    const startCreate = () => {
        setIsCreating(true);
        setEditingId(null);
        setEditForm({ name: "", abbrev: "" });
    };

    const cancelEdit = () => {
        setEditingId(null);
        setIsCreating(false);
        setEditForm({ name: "", abbrev: "" });
    };

    return (
        <Dialog open={isOpen} onOpenChange={setOpen}>
            {trigger && <DialogTrigger>{trigger}</DialogTrigger>}
            <DialogContent className="max-w-[800px] w-full p-0 gap-0 bg-gray-50 overflow-hidden rounded-2xl">
                <div className="bg-white px-6 py-4 border-b border-gray-100 flex justify-between items-center sticky top-0 z-10">
                    <div>
                        <DialogTitle className="text-xl font-semibold text-gray-900">Unidades de Medida</DialogTitle>
                        <DialogDescription className="text-sm text-gray-500 mt-1">
                            Gerencie as unidades utilizadas no sistema.
                        </DialogDescription>
                    </div>
                    {!isCreating && !editingId && (
                        <Button onClick={startCreate} className="bg-brand-600 hover:bg-brand-700 text-white rounded-full px-4 text-xs h-8">
                            <Plus className="w-3.5 h-3.5 mr-1.5" />
                            Nova Unidade
                        </Button>
                    )}
                </div>

                <div className="p-6 overflow-y-auto max-h-[60vh]">
                    {(isCreating || editingId) && (
                        <div className="mb-6 bg-white p-4 rounded-xl border border-gray-200 shadow-sm animate-in fade-in slide-in-from-top-2">
                            <h4 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                {isCreating ? <Plus className="w-4 h-4 text-brand-600" /> : <Edit className="w-4 h-4 text-brand-600" />}
                                {isCreating ? "Nova Unidade" : "Editar Unidade"}
                            </h4>
                            <div className="grid grid-cols-12 gap-4 items-end">
                                <div className="col-span-6">
                                    <Label className="text-xs text-gray-500 mb-1.5 block">Nome (ex: Pacote)</Label>
                                    <Input
                                        value={editForm.name}
                                        onChange={e => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                                        placeholder="Nome da unidade"
                                        className="h-9 text-sm"
                                        autoFocus
                                    />
                                </div>
                                <div className="col-span-3">
                                    <Label className="text-xs text-gray-500 mb-1.5 block">Abrev. (ex: Pc)</Label>
                                    <Input
                                        value={editForm.abbrev}
                                        onChange={e => setEditForm(prev => ({ ...prev, abbrev: e.target.value }))}
                                        placeholder="Sigla"
                                        className="h-9 text-sm"
                                        maxLength={5}
                                    />
                                </div>
                                <div className="col-span-3 flex gap-2">
                                    <Button onClick={handleSave} className="h-9 flex-1 bg-brand-600 hover:bg-brand-700 text-white">
                                        <Save className="w-3.5 h-3.5 mr-1" />
                                        Salvar
                                    </Button>
                                    <Button onClick={cancelEdit} variant="outline" className="h-9 w-9 p-0 bg-gray-50">
                                        <X className="w-4 h-4 text-gray-500" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
                        <Table>
                            <TableHeader className="bg-gray-50/50">
                                <TableRow className="hover:bg-transparent border-gray-100">
                                    <TableHead className="w-[40%] text-xs font-semibold text-gray-500 h-10">NOME</TableHead>
                                    <TableHead className="w-[20%] text-xs font-semibold text-gray-500 h-10">ABREVIAÇÃO</TableHead>
                                    <TableHead className="w-[20%] text-xs font-semibold text-gray-500 h-10 text-center">EM USO</TableHead>
                                    <TableHead className="w-[20%] text-xs font-semibold text-gray-500 h-10 text-right pr-4">AÇÕES</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading && uoms.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="h-32 text-center">
                                            <Loader2 className="w-6 h-6 animate-spin mx-auto text-brand-600 mb-2" />
                                            <p className="text-sm text-gray-500">Carregando unidades...</p>
                                        </TableCell>
                                    </TableRow>
                                ) : uoms.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="h-32 text-center text-gray-500">
                                            Nenhuma unidade cadastrada.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    uoms.map((uom) => (
                                        <TableRow key={uom.id} className="group border-gray-50 hover:bg-gray-50/50 transition-colors">
                                            <TableCell className="py-3 font-medium text-gray-900">{uom.name}</TableCell>
                                            <TableCell className="py-3">
                                                <span className="inline-flex items-center px-2 py-1 rounded bg-gray-100 text-xs font-semibold text-gray-700 border border-gray-200">
                                                    {uom.abbrev}
                                                </span>
                                            </TableCell>
                                            <TableCell className="py-3 text-center">
                                                {uom.usage_count && uom.usage_count > 0 ? (
                                                    <span className="inline-flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full font-medium">
                                                        {uom.usage_count} itens
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-gray-400">-</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="py-3 text-right pr-4">
                                                <div className="flex justify-end gap-1 opacity-100 transition-opacity">
                                                    <Button
                                                        variant="ghost"
                                                        className="h-7 w-7 p-0 rounded-lg hover:bg-blue-50 hover:text-blue-600"
                                                        onClick={() => startEdit(uom)}
                                                        disabled={loading}
                                                    >
                                                        <Edit className="w-3.5 h-3.5" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        className={cn(
                                                            "h-7 w-7 p-0 rounded-lg",
                                                            (uom.usage_count || 0) > 0
                                                                ? "text-gray-300 cursor-not-allowed hover:bg-transparent"
                                                                : "hover:bg-red-50 hover:text-red-600 text-gray-400"
                                                        )}
                                                        onClick={() => setDeletingId(uom.id)}
                                                        disabled={(uom.usage_count || 0) > 0}
                                                        title={(uom.usage_count || 0) > 0 ? `Em uso por ${uom.usage_count} itens` : "Excluir unidade"}
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            </DialogContent>

            <ConfirmDialogDesdobra
                open={!!deletingId}
                onOpenChange={(val) => !val && setDeletingId(null)}
                title="Excluir Unidade de Medida"
                description={`Tem certeza que deseja excluir esta unidade? Esta ação não pode ser desfeita.`}
                onConfirm={confirmDelete}
            />
        </Dialog>
    );
}
