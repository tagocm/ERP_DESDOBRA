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
import { Edit, Trash2, Plus, Loader2, Save, X } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { PackagingType, createPackagingType, deletePackagingType, getAllPackagingTypesIncludingInactive, updatePackagingType } from "@/lib/data/packaging-types";
import { useCompany } from "@/contexts/CompanyContext";
import { cn } from "@/lib/utils";
import { ConfirmDialogDesdobra } from "@/components/ui/ConfirmDialogDesdobra";

interface PackagingTypeManagerModalProps {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    trigger?: React.ReactNode;
}

export function PackagingTypeManagerModal({ open: controlledOpen, onOpenChange, trigger }: PackagingTypeManagerModalProps) {
    const [internalOpen, setInternalOpen] = useState(false);
    const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;
    const setOpen = (val: boolean) => {
        setInternalOpen(val);
        if (onOpenChange) onOpenChange(val);
    };

    const { selectedCompany } = useCompany();
    const { toast } = useToast();
    const [types, setTypes] = useState<PackagingType[]>([]);
    const [loading, setLoading] = useState(false);

    // Edit/Create State
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<{ name: string; code: string }>({ name: "", code: "" });
    const [isCreating, setIsCreating] = useState(false);

    // Delete State
    const [deletingId, setDeletingId] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen && selectedCompany?.id) {
            loadTypes();
        } else if (!isOpen) {
            // Reset state on close
            setEditingId(null);
            setIsCreating(false);
            setEditForm({ name: "", code: "" });
        }
    }, [isOpen, selectedCompany]);

    const loadTypes = async () => {
        if (!selectedCompany?.id) return;
        setLoading(true);
        try {
            const data = await getAllPackagingTypesIncludingInactive(selectedCompany.id);
            setTypes(data);
        } catch (error) {
            console.error(error);
            toast({ title: "Erro ao carregar tipos", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!selectedCompany?.id) return;
        if (!editForm.name.trim() || !editForm.code.trim()) {
            toast({ title: "Preencha nome e código", variant: "destructive" });
            return;
        }

        // Validate code format: 3-6 uppercase letters only, no spaces
        const codeRegex = /^[A-Z]{3,6}$/;
        if (!codeRegex.test(editForm.code.trim())) {
            toast({
                title: "Código inválido",
                description: "O código deve ter de 3 a 6 letras maiúsculas, sem espaços ou números.",
                variant: "destructive"
            });
            return;
        }

        try {
            if (isCreating) {
                await createPackagingType({
                    company_id: selectedCompany.id,
                    name: editForm.name.trim(),
                    code: editForm.code.trim(),
                    is_active: true,
                });
                toast({ title: "Tipo criado com sucesso!" });
            } else if (editingId) {
                await updatePackagingType(editingId, {
                    name: editForm.name.trim(),
                    code: editForm.code.trim(),
                });
                toast({ title: "Tipo atualizado!" });
            }

            setEditingId(null);
            setIsCreating(false);
            setEditForm({ name: "", code: "" });
            loadTypes();
        } catch (error: any) {
            console.error(error);
            if (error.message?.includes("idx_packaging_types_code")) {
                toast({ title: "Já existe um tipo com este código.", variant: "destructive" });
            } else {
                toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
            }
        }
    };

    const confirmDelete = async () => {
        if (!deletingId) return;
        try {
            await deletePackagingType(deletingId);
            toast({ title: "Tipo excluído." });
            loadTypes();
        } catch (error: any) {
            console.error(error);
            toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
        } finally {
            setDeletingId(null);
        }
    };

    const startEdit = (type: PackagingType) => {
        // Prevent editing global types (no company_id) if we want to enforce it
        // Or just allow overriding? For now, we only allow editing if it belongs to valid company or user has permission.
        // Assuming RLS blocks update if not owner.
        if (!type.company_id) {
            toast({ title: "Tipos padrão do sistema não podem ser editados", variant: "default" });
            return;
        }

        setEditingId(type.id);
        setIsCreating(false);
        setEditForm({ name: type.name, code: type.code });
    };

    const startCreate = () => {
        setIsCreating(true);
        setEditingId(null);
        setEditForm({ name: "", code: "" });
    };

    const cancelEdit = () => {
        setEditingId(null);
        setIsCreating(false);
        setEditForm({ name: "", code: "" });
    };

    // Helper to check if item is global
    const isGlobal = (id: string) => {
        const t = types.find(x => x.id === id);
        return t && !t.company_id;
    }

    return (
        <Dialog open={isOpen} onOpenChange={setOpen}>
            {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
            <DialogContent className="max-w-[800px] w-full p-0 gap-0 bg-gray-50 overflow-hidden rounded-2xl">
                <div className="bg-white px-6 py-4 border-b border-gray-100 flex justify-between items-center sticky top-0 z-10">
                    <div>
                        <DialogTitle className="text-xl font-semibold text-gray-900">Tipos de Embalagem</DialogTitle>
                        <DialogDescription className="text-sm text-gray-500 mt-1">
                            Gerencie os tipos (Caixa, Pacote, Pallet) disponíveis.
                        </DialogDescription>
                    </div>
                    {!isCreating && !editingId && (
                        <Button onClick={startCreate} className="bg-brand-600 hover:bg-brand-700 text-white rounded-full px-4 text-xs h-8">
                            <Plus className="w-3.5 h-3.5 mr-1.5" />
                            Novo Tipo
                        </Button>
                    )}
                </div>

                <div className="p-6 overflow-y-auto max-h-[60vh]">
                    {(isCreating || editingId) && (
                        <div className="mb-6 bg-white p-4 rounded-xl border border-gray-200 shadow-sm animate-in fade-in slide-in-from-top-2">
                            <h4 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                {isCreating ? <Plus className="w-4 h-4 text-brand-600" /> : <Edit className="w-4 h-4 text-brand-600" />}
                                {isCreating ? "Novo Tipo" : "Editar Tipo"}
                            </h4>
                            <div className="grid grid-cols-12 gap-4 items-end">
                                <div className="col-span-6">
                                    <Label className="text-xs text-gray-500 mb-1.5 block">Nome (ex: Caixa Plástica)</Label>
                                    <Input
                                        value={editForm.name}
                                        onChange={e => {
                                            const name = e.target.value;
                                            setEditForm(prev => ({
                                                ...prev,
                                                name,
                                                // Auto-suggest code if creating
                                                code: isCreating && !prev.code ? name.toUpperCase().substring(0, 10).replace(/[^A-Z0-9]/g, '') : prev.code
                                            }))
                                        }}
                                        placeholder="Nome do tipo"
                                        className="h-9 text-sm"
                                        autoFocus
                                    />
                                </div>
                                <div className="col-span-3">
                                    <Label className="text-xs text-gray-500 mb-1.5 block">Código (3-6 letras, ex: BOX, PACK)</Label>
                                    <Input
                                        value={editForm.code}
                                        onChange={e => setEditForm(prev => ({ ...prev, code: e.target.value.toUpperCase().replace(/[^A-Z]/g, '').substring(0, 6) }))}
                                        placeholder="CÓDIGO"
                                        className="h-9 text-sm font-mono"
                                        maxLength={6}
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
                                    <TableHead className="w-[45%] text-xs font-semibold text-gray-500 h-10">NOME</TableHead>
                                    <TableHead className="w-[20%] text-xs font-semibold text-gray-500 h-10">CÓDIGO</TableHead>
                                    <TableHead className="w-[20%] text-xs font-semibold text-gray-500 h-10 text-center">ORIGEM</TableHead>
                                    <TableHead className="w-[15%] text-xs font-semibold text-gray-500 h-10 text-right pr-4">AÇÕES</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading && types.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="h-32 text-center">
                                            <Loader2 className="w-6 h-6 animate-spin mx-auto text-brand-600 mb-2" />
                                            <p className="text-sm text-gray-500">Carregando...</p>
                                        </TableCell>
                                    </TableRow>
                                ) : types.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="h-32 text-center text-gray-500">
                                            Nenhum tipo cadastrado.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    types.map((type) => (
                                        <TableRow key={type.id} className="group border-gray-50 hover:bg-gray-50/50 transition-colors">
                                            <TableCell className="py-3 font-medium text-gray-900">{type.name}</TableCell>
                                            <TableCell className="py-3">
                                                <span className="inline-flex items-center px-2 py-1 rounded bg-gray-100 text-xs font-semibold text-gray-700 border border-gray-200 font-mono">
                                                    {type.code}
                                                </span>
                                            </TableCell>
                                            <TableCell className="py-3 text-center">
                                                {!type.company_id ? (
                                                    <span className="inline-flex items-center gap-1 text-[10px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                                                        Sistema
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 text-[10px] text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                                                        Personalizado
                                                    </span>
                                                )}
                                            </TableCell>
                                            <TableCell className="py-3 text-right pr-4">
                                                <div className="flex justify-end gap-1 opacity-100 transition-opacity">
                                                    {type.company_id && (
                                                        <>
                                                            <Button
                                                                variant="ghost"
                                                                className="h-7 w-7 p-0 rounded-lg hover:bg-blue-50 hover:text-blue-600"
                                                                onClick={() => startEdit(type)}
                                                                disabled={loading}
                                                            >
                                                                <Edit className="w-3.5 h-3.5" />
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                className="h-7 w-7 p-0 rounded-lg hover:bg-red-50 hover:text-red-600 text-gray-400"
                                                                onClick={() => setDeletingId(type.id)}
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </Button>
                                                        </>
                                                    )}
                                                    {!type.company_id && (
                                                        <span className="text-[10px] text-gray-300 italic pr-2">Padrão</span>
                                                    )}
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
                title="Excluir Tipo de Embalagem"
                description={`Tem certeza que deseja excluir este tipo?`}
                onConfirm={confirmDelete}
            />
        </Dialog>
    );
}
