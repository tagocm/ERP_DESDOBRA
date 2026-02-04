
import { useEffect, useState } from "react";
import { AlertCircle, Edit, Loader2, Plus, Settings, Trash2, X } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { getCategories, createCategory, updateCategory, deleteCategory } from "@/lib/data/categories";
import { ProductCategory } from "@/types/product";
import { cn } from "@/lib/utils";
import { Alert } from "@/components/ui/Alert";
import { ConfirmDialogDesdobra } from "@/components/ui/ConfirmDialogDesdobra";
import { Card } from "@/components/ui/Card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

interface CategoryManagerModalProps {
    companyId: string;
    onClose?: () => void;
    onChange?: () => void; // Trigger reload in parent
}

export function CategoryManagerModal({ companyId, onClose, onChange }: CategoryManagerModalProps) {
    const { toast } = useToast();
    const [categories, setCategories] = useState<ProductCategory[]>([]);
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
            const data = await getCategories(companyId);
            setCategories(data);
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
            await createCategory(companyId, newItemName);
            setNewItemName("");
            fetchCategories();
            onChange?.();
            toast({ title: "Categoria criada com sucesso!", variant: "default" });
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
            await updateCategory(id, editName);
            setEditingId(null);
            fetchCategories();
            onChange?.();
            toast({ title: "Categoria atualizada!", variant: "default" });
        } catch (error: any) {
            toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
        } finally {
            setIsUpdating(false);
        }
    };

    const handleDelete = async () => {
        if (!categoryToDelete) return;
        try {
            await deleteCategory(categoryToDelete);
            fetchCategories();
            onChange?.();
            toast({ title: "Categoria removida!", variant: "default" });
        } catch (error: any) {
            toast({ title: "Erro ao remover", description: error.message, variant: "destructive" });
        } finally {
            setCategoryToDelete(null);
        }
    };

    // Filter locally or sorting
    // List logic

    return (
        <DialogContent className="max-w-4xl w-full p-0 gap-0 bg-gray-50 overflow-hidden rounded-2xl">
            {/* Header */}
            <div className="bg-white px-6 py-4 border-b border-gray-100 flex justify-between items-center sticky top-0 z-10">
                <div>
                    <DialogTitle className="text-xl font-semibold text-gray-900">Categorias de Produto</DialogTitle>
                    <DialogDescription className="text-sm text-gray-500 mt-1">
                        Gerencie as categorias utilizadas para organizar seus produtos.
                    </DialogDescription>
                </div>
                <Button
                    onClick={() => {
                        setEditingId(null);
                        setAddBoxOpen(!addBoxOpen);
                    }}
                    className="bg-brand-600 hover:bg-brand-700 text-white rounded-2xl px-4 text-xs h-8 shadow-card transition-all"
                >
                    <Plus className="w-3.5 h-3.5 mr-1.5" />
                    Nova Categoria
                </Button>
            </div>

            <div className="p-6 overflow-y-auto max-h-screen">
                {/* Create/Edit Form Inline */}
                {(addBoxOpen || editingId) && (
                    <Card className="mb-6 bg-white p-4 border border-gray-200/70 shadow-card animate-in fade-in slide-in-from-top-2">
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
                                    placeholder="Ex: Alimentos, Bebidas..."
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
                <Card className="border border-gray-200/70 overflow-hidden bg-white shadow-card">
                    <Table>
                        <TableHeader className="bg-gray-50/50">
                            <TableRow className="hover:bg-transparent border-gray-100">
                                <TableHead className="w-full text-xs font-semibold text-gray-500 h-10">NOME</TableHead>
                                <TableHead className="text-xs font-semibold text-gray-500 h-10 text-center">EM USO</TableHead>
                                <TableHead className="text-xs font-semibold text-gray-500 h-10 text-right pr-4">AÇÕES</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={3} className="h-32 text-center">
                                        <Loader2 className="h-6 w-6 animate-spin mx-auto text-gray-300" />
                                    </TableCell>
                                </TableRow>
                            ) : categories.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={3} className="h-32 text-center text-gray-400 text-sm">
                                        Nenhuma categoria cadastrada.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                categories.map((cat) => (
                                    <TableRow key={cat.id} className="group border-gray-50 hover:bg-gray-50/50 transition-colors">
                                        <TableCell className="py-3 font-medium text-gray-900">
                                            <div className="flex items-center gap-2">
                                                {cat.name}
                                                {/* Global Indicator */}
                                                {!cat.company_id && (
                                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600 border border-gray-200" title="Categoria Global (Sistema)">
                                                        Global
                                                    </span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="py-3 text-center">
                                            {cat.product_count! > 0 ? (
                                                <span className="inline-flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-2xl font-medium">
                                                    {cat.product_count} itens
                                                </span>
                                            ) : (
                                                <span className="text-gray-300 text-xs">—</span>
                                            )}
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
                                                    disabled={!cat.company_id} // Disable edit for global
                                                    className={cn(
                                                        "h-7 w-7 p-0 rounded-2xl hover:bg-blue-50 hover:text-blue-600 text-gray-400 transition-colors",
                                                        !cat.company_id && "opacity-30 cursor-not-allowed hover:bg-transparent hover:text-gray-400"
                                                    )}
                                                    title={!cat.company_id ? "Categorias globais não podem ser editadas" : "Editar"}
                                                >
                                                    <Edit className="h-3.5 w-3.5" />
                                                </Button>

                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => setCategoryToDelete(cat.id)}
                                                    disabled={cat.product_count! > 0 || !cat.company_id}
                                                    className={cn(
                                                        "h-7 w-7 p-0 rounded-2xl transition-colors border-none bg-transparent",
                                                        cat.product_count! > 0 || !cat.company_id
                                                            ? "opacity-20 cursor-not-allowed"
                                                            : "hover:bg-red-50 hover:text-red-600 text-gray-400"
                                                    )}
                                                    title={!cat.company_id ? "Categorias globais não podem ser excluídas" : "Excluir"}
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
