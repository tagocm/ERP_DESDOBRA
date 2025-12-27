
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
            <div className="flex-1 overflow-y-auto space-y-1 pr-1">
                {isLoading ? (
                    <div className="flex justify-center py-4"><Loader2 className="animate-spin text-gray-400" /></div>
                ) : categories.length === 0 ? (
                    <p className="text-center text-gray-500 py-4 text-sm">Nenhuma categoria cadastrada.</p>
                ) : (
                    categories.map(cat => (
                        <div key={cat.id} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-md group border border-transparent hover:border-gray-100">
                            {editingId === cat.id ? (
                                <div className="flex flex-1 gap-2 items-center">
                                    <Input
                                        value={editName}
                                        onChange={(e) => setEditName(e.target.value)}
                                        className="h-8 text-sm"
                                        autoFocus
                                    />
                                    <Button size="sm" onClick={() => handleUpdate(cat.id)} disabled={isUpdating}>
                                        {isUpdating ? <Loader2 className="w-3 h-3 animate-spin" /> : "OK"}
                                    </Button>
                                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                                        <X className="w-3 h-3" />
                                    </Button>
                                </div>
                            ) : (
                                <>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium text-gray-700">{cat.name}</span>
                                        {cat.product_count! > 0 && (
                                            <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
                                                {cat.product_count}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => {
                                            setEditingId(cat.id);
                                            setEditName(cat.name);
                                        }}>
                                            <Edit className="w-3.5 h-3.5 text-gray-500 hover:text-blue-600" />
                                        </Button>

                                        {cat.product_count! === 0 ? (
                                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setCategoryToDelete(cat.id)}>
                                                <Trash2 className="w-3.5 h-3.5 text-gray-500 hover:text-red-600" />
                                            </Button>
                                        ) : (
                                            <div title="Vinculada a produtos">
                                                <Button size="icon" variant="ghost" className="h-7 w-7 opacity-50 cursor-not-allowed">
                                                    <Trash2 className="w-3.5 h-3.5 text-gray-300" />
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    ))
                )}
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
