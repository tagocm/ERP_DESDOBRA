
import { useEffect, useState } from "react";
import { AlertCircle, Edit, Loader2, Plus, Settings, Trash2, X } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { getCategories, createCategory, updateCategory, deleteCategory } from "@/lib/data/categories";
import { ProductCategory } from "@/types/product";
import { cn } from "@/lib/utils";
import { Alert } from "@/components/ui/Alert";
import { ConfirmDialogDesdobra } from "@/components/ui/ConfirmDialogDesdobra";

interface CategoryManagerModalProps {
    onClose?: () => void;
    onChange?: () => void; // Trigger reload in parent
}

export function CategoryManagerModal({ onClose, onChange }: CategoryManagerModalProps) {
    const { toast } = useToast();
    const [categories, setCategories] = useState<ProductCategory[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [newItemName, setNewItemName] = useState("");
    const [isCreating, setIsCreating] = useState(false);

    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState("");
    const [isUpdating, setIsUpdating] = useState(false);

    const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);

    const fetchCategories = async () => {
        setIsLoading(true);
        try {
            const data = await getCategories();
            setCategories(data);
        } catch (error) {
            console.error(error);
            toast({ title: "Erro ao carregar categorias", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchCategories();
    }, []);

    const handleCreate = async () => {
        if (!newItemName.trim()) return;
        setIsCreating(true);
        try {
            await createCategory(newItemName);
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
        <DialogContent className="sm:max-w-md max-h-[80vh] flex flex-col">
            <DialogHeader>
                <DialogTitle>Gerenciar Categorias</DialogTitle>
            </DialogHeader>

            {/* Create Input */}
            <div className="flex gap-2 py-4">
                <Input
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    placeholder="Nova categoria..."
                    disabled={isCreating}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                />
                <Button onClick={handleCreate} disabled={isCreating || !newItemName.trim()} className="shrink-0">
                    {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                </Button>
            </div>

            {/* List */}
            <div className="border border-gray-200 rounded-lg overflow-hidden shadow-sm bg-white">
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50/80 border-b border-gray-200">
                        <tr>
                            <th className="px-4 h-10 align-middle font-semibold text-xs text-gray-500 uppercase tracking-wider w-full">Nome</th>
                            <th className="px-4 h-10 align-middle font-semibold text-xs text-gray-500 uppercase tracking-wider whitespace-nowrap text-center">Produtos</th>
                            <th className="px-4 h-10 align-middle font-semibold text-xs text-gray-500 uppercase tracking-wider whitespace-nowrap text-right">Ações</th>
                        </tr>
                    </thead>
                </table>
                <div className="max-h-[300px] overflow-y-auto">
                    <table className="w-full text-sm text-left">
                        <tbody className="divide-y divide-gray-100">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={3} className="py-8 text-center">
                                        <Loader2 className="animate-spin h-5 w-5 text-gray-400 mx-auto" />
                                    </td>
                                </tr>
                            ) : categories.length === 0 ? (
                                <tr>
                                    <td colSpan={3} className="py-8 text-center text-gray-500">
                                        Nenhuma categoria cadastrada.
                                    </td>
                                </tr>
                            ) : (
                                categories.map(cat => (
                                    <tr key={cat.id} className="group hover:bg-gray-50/60 transition-colors">
                                        {editingId === cat.id ? (
                                            <td colSpan={3} className="px-4 py-3 bg-blue-50/30">
                                                <div className="flex items-center gap-2">
                                                    <Input
                                                        value={editName}
                                                        onChange={(e) => setEditName(e.target.value)}
                                                        className="h-8 text-sm bg-white shadow-none"
                                                        autoFocus
                                                    />
                                                    <Button size="sm" onClick={() => handleUpdate(cat.id)} disabled={isUpdating}>
                                                        {isUpdating ? <Loader2 className="w-3 h-3 animate-spin" /> : "Salvar"}
                                                    </Button>
                                                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                                                        <X className="w-3 h-3" />
                                                    </Button>
                                                </div>
                                            </td>
                                        ) : (
                                            <>
                                                <td className="px-4 py-3 font-medium text-gray-700 w-full align-middle">
                                                    {cat.name}
                                                </td>
                                                <td className="px-4 py-3 text-center align-middle whitespace-nowrap">
                                                    {cat.product_count! > 0 ? (
                                                        <span className="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-2 text-xs font-medium rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                                                            {cat.product_count}
                                                        </span>
                                                    ) : (
                                                        <span className="text-gray-300 text-xs">-</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-right align-middle whitespace-nowrap">
                                                    <div className="flex justify-end items-center gap-1">
                                                        <Button size="icon" variant="ghost" className="h-8 w-8 text-gray-400 hover:text-blue-600 hover:bg-blue-50" onClick={() => {
                                                            setEditingId(cat.id);
                                                            setEditName(cat.name);
                                                        }}>
                                                            <Edit className="w-4 h-4" />
                                                        </Button>

                                                        {cat.product_count! === 0 ? (
                                                            <Button size="icon" variant="ghost" className="h-8 w-8 text-gray-400 hover:text-red-600 hover:bg-red-50" onClick={() => setCategoryToDelete(cat.id)}>
                                                                <Trash2 className="w-4 h-4" />
                                                            </Button>
                                                        ) : (
                                                            <div title="Vinculada a produtos">
                                                                <Button size="icon" variant="ghost" className="h-8 w-8 opacity-30 cursor-not-allowed">
                                                                    <Trash2 className="w-4 h-4 text-gray-300" />
                                                                </Button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                            </>
                                        )}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <ConfirmDialogDesdobra
                open={!!categoryToDelete}
                onOpenChange={(open) => !open && setCategoryToDelete(null)}
                title="Excluir Categoria"
                description="Tem certeza que deseja excluir esta categoria? Esta ação não pode ser desfeita."
                onConfirm={handleDelete}
                confirmText="Excluir"
                variant="danger"
            />
        </DialogContent>
    );
}
