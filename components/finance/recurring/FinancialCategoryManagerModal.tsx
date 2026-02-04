
import { useEffect, useState } from "react";
import { Edit, Loader2, Plus, Trash2, X } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { DialogContent, DialogTitle, DialogDescription } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
    getFinancialCategoriesAction as getFinancialCategories,
    createFinancialCategoryAction as createFinancialCategory,
    updateFinancialCategoryAction as updateFinancialCategory,
    deleteFinancialCategoryAction as deleteFinancialCategory,
    FinancialCategory
} from "@/app/actions/financial-categories";
import { cn } from "@/lib/utils";
import { ConfirmDialogDesdobra } from "@/components/ui/ConfirmDialogDesdobra";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Card } from "@/components/ui/Card";

interface FinancialCategoryManagerModalProps {
    companyId: string;
    onClose?: () => void;
    onChange?: () => void; // Trigger reload in parent
}

export function FinancialCategoryManagerModal({ companyId, onClose, onChange }: FinancialCategoryManagerModalProps) {
    const { toast } = useToast();
    const [categories, setCategories] = useState<FinancialCategory[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [newItemName, setNewItemName] = useState("");
    const [isCreating, setIsCreating] = useState(false);

    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState("");
    const [isUpdating, setIsUpdating] = useState(false);
    const [addBoxOpen, setAddBoxOpen] = useState(false);

    const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);

    const fetchCategories = async () => {
        setIsLoading(true);
        try {
            const result = await getFinancialCategories(companyId);
            if (result.data) {
                setCategories(result.data);
            } else {
                toast({ title: "Erro ao carregar categorias", description: result.error, variant: "destructive" });
            }
        } catch (error) {
            console.error(error);
            toast({ title: "Erro ao carregar categorias", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (companyId) {
            fetchCategories();
        }
    }, [companyId]);

    const handleCreate = async () => {
        if (!newItemName.trim()) return;
        setIsCreating(true);
        try {
            const result = await createFinancialCategory(newItemName);
            if (result.data) {
                setNewItemName("");
                fetchCategories();
                onChange?.();
                toast({ title: "Categoria criada com sucesso!", variant: "default" });
            } else {
                toast({ title: "Erro ao criar", description: result.error, variant: "destructive" });
            }
        } catch (error: any) {
            toast({ title: "Erro ao criar", description: error.message, variant: "destructive" });
        } finally {
            setIsCreating(false);
        }
    };

    const handleUpdate = async (id: string) => {
        if (!editName.trim()) return;
        setIsUpdating(true);
        try {
            const result = await updateFinancialCategory(id, editName);
            if (result.data) {
                setEditingId(null);
                fetchCategories();
                onChange?.();
                toast({ title: "Categoria atualizada!", variant: "default" });
            } else {
                toast({ title: "Erro ao atualizar", description: result.error, variant: "destructive" });
            }
        } catch (error: any) {
            toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
        } finally {
            setIsUpdating(false);
        }
    };

    const handleDelete = async () => {
        if (!categoryToDelete) return;
        try {
            const result = await deleteFinancialCategory(categoryToDelete);
            if (result.success) {
                fetchCategories();
                onChange?.();
                toast({ title: "Categoria removida!", variant: "default" });
            } else {
                toast({ title: "Erro ao remover", description: result.error, variant: "destructive" });
            }
        } catch (error: any) {
            toast({ title: "Erro ao remover", description: error.message, variant: "destructive" });
        } finally {
            setCategoryToDelete(null);
        }
    };

    return (
        <DialogContent className="max-w-3xl w-full p-0 gap-0 bg-gray-50 overflow-hidden rounded-2xl flex flex-col max-h-screen">
            {/* Header */}
            <div className="bg-white px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                <div>
                    <DialogTitle className="text-xl font-semibold text-gray-900">Categorias Financeiras</DialogTitle>
                    <DialogDescription className="text-sm text-gray-500 mt-1">
                        Gerencie as categorias utilizadas para classificar seus fatos geradores.
                    </DialogDescription>
                </div>
                <Button
                    onClick={() => {
                        setEditingId(null);
                        setAddBoxOpen(!addBoxOpen);
                    }}
                    className="bg-brand-600 hover:bg-brand-700 text-white rounded-full px-4 text-xs h-8 transition-all"
                >
                    <Plus className="w-3.5 h-3.5 mr-1.5" />
                    Nova Categoria
                </Button>
            </div>

            <div className="flex-1 p-6 overflow-y-auto">
                {/* Create/Edit Form Inline */}
                {(addBoxOpen || editingId) && (
                    <Card className="mb-6 p-4 border-gray-200 shadow-none animate-in fade-in slide-in-from-top-2">
                        <div className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                            {editingId ? <Edit className="w-4 h-4 text-blue-500" /> : <Plus className="w-4 h-4 text-brand-500" />}
                            {editingId ? "Editar Categoria" : "Nova Categoria"}
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                            <div>
                                <label className="text-xs text-gray-500 mb-1.5 block">Nome da Categoria</label>
                                <Input
                                    value={editingId ? editName : newItemName}
                                    onChange={(e) => editingId ? setEditName(e.target.value) : setNewItemName(e.target.value)}
                                    placeholder="Ex: Despesas Gerais, Serviços, Impostos..."
                                    className="h-9 text-sm rounded-2xl"
                                    autoFocus
                                    onKeyDown={(e) => e.key === 'Enter' && (editingId ? handleUpdate(editingId) : handleCreate())}
                                />
                            </div>
                        </div>

                        <div className="mt-4 flex gap-2">
                            <Button
                                onClick={() => editingId ? handleUpdate(editingId) : handleCreate()}
                                disabled={isCreating || isUpdating || !(editingId ? editName : newItemName).trim()}
                                className="h-9 flex-1 bg-brand-600 hover:bg-brand-700 text-white rounded-2xl font-medium transition-all"
                            >
                                {(isCreating || isUpdating) ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    editingId ? "Salvar Alterações" : "Criar Categoria"
                                )}
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setEditingId(null);
                                    setAddBoxOpen(false);
                                }}
                                className="h-9 w-9 p-0 bg-gray-50 hover:bg-white text-gray-500 rounded-2xl border-gray-200"
                            >
                                <X className="w-4 h-4" />
                            </Button>
                        </div>
                    </Card>
                )}

                {/* List Container */}
                <Card className="border-gray-200 overflow-hidden shadow-none">
                    <Table>
                        <TableHeader className="bg-gray-50/50">
                            <TableRow className="hover:bg-transparent border-gray-100">
                                <TableHead className="w-full text-xs font-semibold text-gray-500 h-10">NOME</TableHead>
                                <TableHead className="text-xs font-semibold text-gray-500 h-10 text-right pr-4">AÇÕES</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={2} className="h-32 text-center">
                                        <Loader2 className="h-6 w-6 animate-spin mx-auto text-gray-300" />
                                    </TableCell>
                                </TableRow>
                            ) : categories.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={2} className="h-32 text-center text-gray-400 text-sm">
                                        Nenhuma categoria cadastrada.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                categories.map((cat) => (
                                    <TableRow key={cat.id} className="group border-gray-50 hover:bg-gray-50/50 transition-colors">
                                        <TableCell className="py-3 font-medium text-gray-900">
                                            {cat.name}
                                        </TableCell>
                                        <TableCell className="py-3 text-right pr-4">
                                            <div className="flex justify-end gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => {
                                                        setAddBoxOpen(false);
                                                        setEditingId(cat.id);
                                                        setEditName(cat.name);
                                                    }}
                                                    className="h-7 w-7 p-0 rounded-2xl hover:bg-blue-50 hover:text-blue-600 text-gray-400 transition-colors"
                                                    title="Editar"
                                                >
                                                    <Edit className="h-3.5 w-3.5" />
                                                </Button>

                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => setCategoryToDelete(cat.id)}
                                                    className="h-7 w-7 p-0 rounded-2xl hover:bg-red-50 hover:text-red-600 text-gray-400 transition-colors"
                                                    title="Excluir"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </Card>
            </div>

            <ConfirmDialogDesdobra
                open={!!categoryToDelete}
                onOpenChange={(val) => !val && setCategoryToDelete(null)}
                title="Excluir Categoria"
                description={`Tem certeza que deseja excluir esta categoria? Esta ação não pode ser desfeita.`}
                onConfirm={handleDelete}
                variant="danger"
            />
        </DialogContent >
    );
}
