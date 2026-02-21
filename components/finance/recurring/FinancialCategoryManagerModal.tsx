
import { useEffect, useState } from "react";
import { Edit, Loader2, Plus, Trash2, X } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { DialogContent, DialogTitle, DialogDescription } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
    getFinancialCategoriesAction as getFinancialCategories,
    createFinancialCategoryAction as createFinancialCategory,
    getOperationalExpenseParentAccountsAction as getOperationalExpenseParents,
    updateFinancialCategoryAction as updateFinancialCategory,
    deleteFinancialCategoryAction as deleteFinancialCategory,
    FinancialCategory,
    OperationalExpenseParentAccount
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";

interface FinancialCategoryManagerModalProps {
    companyId: string;
    onClose?: () => void;
    onChange?: () => void; // Trigger reload in parent
    prefillName?: string;
    onCreated?: (categoryId: string) => void;
}

export function FinancialCategoryManagerModal({ companyId, onClose, onChange, prefillName, onCreated }: FinancialCategoryManagerModalProps) {
    const { toast } = useToast();
    const [categories, setCategories] = useState<FinancialCategory[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [newItemName, setNewItemName] = useState("");
    const [isCreating, setIsCreating] = useState(false);
    const [parentAccounts, setParentAccounts] = useState<OperationalExpenseParentAccount[]>([]);
    const [parentAccountId, setParentAccountId] = useState<string>("");
    const [isLoadingParents, setIsLoadingParents] = useState(false);

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

    const fetchParents = async () => {
        setIsLoadingParents(true);
        try {
            const result = await getOperationalExpenseParents(companyId);
            if (result.data) {
                setParentAccounts(result.data);
                // Default to 4.2 (Despesas Administrativas) when available.
                const defaultParent = result.data.find(a => a.code === '4.2') ?? result.data[0];
                if (defaultParent && !parentAccountId) {
                    setParentAccountId(defaultParent.id);
                }
            } else {
                toast({
                    title: "Erro ao carregar subcategorias",
                    description: result.error,
                    variant: "destructive"
                });
            }
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Erro inesperado';
            toast({ title: "Erro ao carregar subcategorias", description: message, variant: "destructive" });
        } finally {
            setIsLoadingParents(false);
        }
    };

    useEffect(() => {
        if (companyId) {
            fetchCategories();
            fetchParents();
        }
    }, [companyId]);

    useEffect(() => {
        if (prefillName && !editingId) {
            setNewItemName(prefillName);
            setAddBoxOpen(true);
        }
    }, [prefillName, editingId]);

    const handleCreate = async () => {
        if (!newItemName.trim()) return;
        if (!parentAccountId) {
            toast({ title: "Subcategoria obrigatória", description: "Selecione onde a conta final ficará vinculada no Plano de Contas (item 4).", variant: "destructive" });
            return;
        }
        setIsCreating(true);
        try {
            const result = await createFinancialCategory({
                name: newItemName,
                parent_account_id: parentAccountId,
            });
            if (result.data) {
                onCreated?.(result.data.id);
                setNewItemName("");
                fetchCategories();
                onChange?.();
                toast({ title: "Categoria criada com sucesso!", variant: "default" });
            } else {
                toast({ title: "Erro ao criar", description: result.error, variant: "destructive" });
            }
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Erro inesperado';
            toast({ title: "Erro ao criar", description: message, variant: "destructive" });
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
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Erro inesperado';
            toast({ title: "Erro ao atualizar", description: message, variant: "destructive" });
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
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Erro inesperado';
            toast({ title: "Erro ao remover", description: message, variant: "destructive" });
        } finally {
            setCategoryToDelete(null);
        }
    };

    return (
        <DialogContent
            hideCloseButton
            className={cn(
                // Keep the modal comfortably within the viewport on small/medium screens.
                "w-[min(860px,92vw)] max-w-none",
                "p-0 gap-0 bg-gray-50 overflow-hidden rounded-2xl flex flex-col",
                "max-h-[80vh]"
            )}
        >
            {/* Header */}
            <div className="bg-white px-5 py-3 border-b border-gray-100 flex justify-between items-center">
                <div>
                    <DialogTitle className="text-lg font-semibold text-gray-900">Categorias Financeiras</DialogTitle>
                    <DialogDescription className="text-sm text-gray-500 mt-1">
                        Gerencie as categorias utilizadas para classificar seus fatos geradores.
                    </DialogDescription>
                </div>
                <Button
                    onClick={() => {
                        setEditingId(null);
                        const nextOpen = !addBoxOpen;
                        setAddBoxOpen(nextOpen);
                        if (nextOpen && prefillName) {
                            setNewItemName(prefillName);
                        }
                    }}
                    className="bg-brand-600 hover:bg-brand-700 text-white rounded-full px-4 text-xs h-8 transition-all"
                >
                    <Plus className="w-3.5 h-3.5 mr-1.5" />
                    Nova Categoria
                </Button>
            </div>

            {/* Body: keep header always visible; only the list should scroll */}
            <div className="flex-1 p-4 overflow-hidden flex flex-col">
                {/* Create/Edit Form Inline */}
                {(addBoxOpen || editingId) && (
                    <Card className="mb-4 p-4 border-gray-200 shadow-none animate-in fade-in slide-in-from-top-2">
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
                            {!editingId && (
                                <div>
                                    <label className="text-xs text-gray-500 mb-1.5 block">Subcategoria (Plano de Contas)</label>
                                    <Select value={parentAccountId} onValueChange={setParentAccountId} disabled={isLoadingParents || parentAccounts.length === 0}>
                                        <SelectTrigger className={cn("h-9 text-sm rounded-2xl", !parentAccountId && "text-gray-500")}>
                                            <SelectValue placeholder={isLoadingParents ? "Carregando..." : "Selecione..."} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {parentAccounts.map((acc) => (
                                                <SelectItem key={acc.id} value={acc.id}>
                                                    <span className="font-mono text-xs mr-2">{acc.code}</span>
                                                    <span>{acc.name}</span>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <p className="mt-1 text-[11px] text-gray-400">
                                        A conta final será criada dentro desta pasta do item 4 (Despesas Operacionais).
                                    </p>
                                </div>
                            )}
                        </div>

                        <div className="mt-4 flex gap-2">
                            <Button
                                onClick={() => editingId ? handleUpdate(editingId) : handleCreate()}
                                disabled={
                                    isCreating ||
                                    isUpdating ||
                                    !(editingId ? editName : newItemName).trim() ||
                                    (!editingId && !parentAccountId)
                                }
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
                <Card className="border-gray-200 overflow-hidden shadow-none flex-1 min-h-0">
                    <div className="h-full overflow-y-auto">
                        <Table>
                        <TableHeader className="bg-gray-50/50 sticky top-0 z-10">
                            <TableRow className="hover:bg-transparent border-gray-100">
                                <TableHead className="w-full text-xs font-semibold text-gray-500 h-9">NOME</TableHead>
                                <TableHead className="text-xs font-semibold text-gray-500 h-9 text-right pr-4">AÇÕES</TableHead>
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
                                    // account_is_system_locked is populated by the server action
                                    // to prevent edits/removals on fixed chart accounts.
                                    <TableRow key={cat.id} className="group border-gray-50 hover:bg-gray-50/50 transition-colors">
                                        <TableCell className="py-2 font-medium text-gray-900">
                                            <div className="flex items-center gap-2 min-w-0">
                                                {cat.account_code && (
                                                    <span className="font-mono text-xs text-gray-500 shrink-0">{cat.account_code}</span>
                                                )}
                                                <span className="truncate">{cat.name}</span>
                                                {cat.account_is_system_locked && (
                                                    <Badge variant="secondary" className="text-[10px] bg-amber-50 text-amber-700 border border-amber-100 shrink-0">
                                                        Sistema
                                                    </Badge>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="py-2 text-right pr-4">
                                            <div className="flex justify-end gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => {
                                                        setAddBoxOpen(false);
                                                        setEditingId(cat.id);
                                                        setEditName(cat.name);
                                                    }}
                                                    disabled={!!cat.account_is_system_locked}
                                                    className="h-7 w-7 p-0 rounded-2xl hover:bg-blue-50 hover:text-blue-600 text-gray-400 transition-colors"
                                                    title="Editar"
                                                >
                                                    <Edit className="h-3.5 w-3.5" />
                                                </Button>

                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => setCategoryToDelete(cat.id)}
                                                    disabled={!!cat.account_is_system_locked}
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
                    </div>
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
