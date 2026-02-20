'use client';

import { useState, useEffect } from 'react';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import {
    fetchRevenueCategoriesAction,
    createRevenueCategoryAction,
    updateRevenueCategoryAction,
    toggleRevenueCategoryStatusAction,
    deleteRevenueCategoryAction
} from '@/app/actions/finance-actions';
import { RevenueCategory } from '@/lib/data/finance/chart-of-accounts';
import { Loader2, Plus, Trash2, Power, Edit2, Check, X, AlertCircle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { Badge } from "@/components/ui/Badge";

interface ManageCategoriesModalProps {
    isOpen: boolean;
    onClose: () => void;
    onChanged: () => void; // Refresh parent tree
}

export function ManageCategoriesModal({ isOpen, onClose, onChanged }: ManageCategoriesModalProps) {
    const [categories, setCategories] = useState<RevenueCategory[]>([]);
    const [loading, setLoading] = useState(true);
    const [newName, setNewName] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    // Edit state
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const { toast } = useToast();

    const loadCategories = async () => {
        setLoading(true);
        const result = await fetchRevenueCategoriesAction();
        if (result.success && result.data) {
            setCategories(result.data);
        } else {
            toast({ variant: "destructive", title: "Erro", description: 'Erro ao carregar categorias.' });
        }
        setLoading(false);
    };

    useEffect(() => {
        if (isOpen) {
            loadCategories();
        }
    }, [isOpen]);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newName.trim()) return;

        setIsCreating(true);
        try {
            const result = await createRevenueCategoryAction(newName);
            if (result.success) {
                toast({ title: "Sucesso", description: 'Categoria criada com sucesso.' });
                setNewName('');
                await loadCategories();
                onChanged();
            } else {
                toast({ variant: "destructive", title: "Erro", description: result.message });
            }
        } catch (error) {
            toast({ variant: "destructive", title: "Erro", description: 'Erro ao criar categoria.' });
        } finally {
            setIsCreating(false);
        }
    };

    const handleStartEdit = (cat: RevenueCategory) => {
        setEditingId(cat.id);
        setEditName(cat.name);
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setEditName('');
    };

    const handleSaveEdit = async (id: string) => {
        if (!editName.trim()) return;

        setIsSaving(true);
        try {
            const result = await updateRevenueCategoryAction(id, editName);
            if (result.success) {
                toast({ title: "Sucesso", description: 'Categoria atualizada.' });
                setEditingId(null);
                await loadCategories();
                onChanged();
            } else {
                toast({ variant: "destructive", title: "Erro", description: result.message });
            }
        } catch (error) {
            toast({ variant: "destructive", title: "Erro", description: 'Erro ao atualizar.' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleToggle = async (cat: RevenueCategory) => {
        try {
            const result = await toggleRevenueCategoryStatusAction(cat.id, !cat.is_active);
            if (result.success) {
                toast({ title: "Sucesso", description: `Categoria ${!cat.is_active ? 'ativada' : 'inativada'}.` });
                await loadCategories();
                onChanged();
            } else {
                toast({ variant: "destructive", title: "Erro", description: result.message });
            }
        } catch (error) {
            toast({ variant: "destructive", title: "Erro", description: 'Erro ao alterar status.' });
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Tem certeza que deseja excluir esta categoria? Esta ação não pode ser desfeita.')) return;

        try {
            const result = await deleteRevenueCategoryAction(id);
            if (result.success) {
                toast({ title: "Sucesso", description: 'Categoria excluída.' });
                await loadCategories();
                onChanged();
            } else {
                toast({ variant: "destructive", title: "Erro", description: result.message });
            }
        } catch (error) {
            toast({ variant: "destructive", title: "Erro", description: 'Erro ao excluir.' });
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-3xl max-h-screen flex flex-col">
                <DialogHeader>
                    <DialogTitle>Gerenciar Categorias de Receita</DialogTitle>
                    <DialogDescription>
                        Crie ou edite categorias de produtos acabados. Cada categoria gera automaticamente uma conta de receita (1.1.XX).
                    </DialogDescription>
                </DialogHeader>

                {/* Create Form */}
                <form onSubmit={handleCreate} className="flex gap-3 items-end border-b border-gray-100 pb-6 pt-2">
                    <div className="flex-1 space-y-1">
                        <Label htmlFor="newName" className="text-xs font-semibold uppercase text-gray-500">Nova Categoria</Label>
                        <Input
                            id="newName"
                            placeholder="Ex: Granito Serrado, Mármore Polido..."
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            className="bg-gray-50/50"
                        />
                    </div>
                    <Button type="submit" disabled={isCreating || !newName.trim()}>
                        {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                        Adicionar
                    </Button>
                </form>

                {/* List */}
                <div className="flex-1 overflow-y-auto -mx-6 px-6 py-2">
                    {loading ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
                        </div>
                    ) : categories.length === 0 ? (
                        <div className="text-center py-12 text-gray-400">
                            Nenhuma categoria cadastrada.
                        </div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead className="text-xs text-gray-500 font-semibold uppercase bg-gray-50 sticky top-0">
                                <tr>
                                    <th className="px-3 py-3 text-left">Nome</th>
                                    <th className="px-3 py-3 text-left">Código Conta</th>
                                    <th className="px-3 py-3 text-center">Status</th>
                                    <th className="px-3 py-3 text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {categories.map(cat => (
                                    <tr key={cat.id} className="group hover:bg-gray-50/50 transition-colors">
                                        <td className="px-3 py-3 font-medium text-gray-900">
                                            {editingId === cat.id ? (
                                                <div className="flex gap-2">
                                                    <Input
                                                        value={editName}
                                                        onChange={(e) => setEditName(e.target.value)}
                                                        className="h-8 text-sm"
                                                        autoFocus
                                                    />
                                                    <Button size="sm" variant="ghost" onClick={() => handleSaveEdit(cat.id)} disabled={isSaving} className="h-8 w-8 p-0 text-emerald-600">
                                                        <Check className="w-4 h-4" />
                                                    </Button>
                                                    <Button size="sm" variant="ghost" onClick={handleCancelEdit} disabled={isSaving} className="h-8 w-8 p-0 text-gray-400">
                                                        <X className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            ) : (
                                                cat.name
                                            )}
                                        </td>
                                        <td className="px-3 py-3 font-mono text-gray-500 text-xs">
                                            {cat.account_code || <span className="text-amber-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Pendente</span>}
                                        </td>
                                        <td className="px-3 py-3 text-center">
                                            <Badge variant={cat.is_active ? "outline" : "secondary"} className={cn("text-xs font-normal border-gray-200", cat.is_active ? "text-emerald-700 bg-emerald-50" : "text-gray-500 bg-gray-100")}>
                                                {cat.is_active ? 'Ativo' : 'Inativo'}
                                            </Badge>
                                        </td>
                                        <td className="px-3 py-3 text-right flex justify-end gap-1">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 w-8 p-0 text-gray-400 hover:text-blue-600"
                                                onClick={() => handleStartEdit(cat)}
                                                disabled={!!editingId}
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className={cn("h-8 w-8 p-0", cat.is_active ? "text-gray-400 hover:text-amber-600" : "text-gray-400 hover:text-emerald-600")}
                                                onClick={() => handleToggle(cat)}
                                                disabled={!!editingId}
                                                title={cat.is_active ? "Inativar" : "Ativar"}
                                            >
                                                <Power className="w-4 h-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 w-8 p-0 text-gray-400 hover:text-red-600"
                                                onClick={() => handleDelete(cat.id)}
                                                disabled={!!editingId || (cat.usage_count || 0) > 0}
                                                title={(cat.usage_count || 0) > 0 ? "Em uso (não pode excluir)" : "Excluir"}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                <DialogFooter className="border-t border-gray-100 pt-4">
                    <Button variant="outline" onClick={onClose}>Fechar</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
