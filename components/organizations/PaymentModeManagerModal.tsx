
import { useEffect, useState } from "react";
import { Edit, Loader2, Plus, Trash2, X } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { DialogContent, DialogTitle, DialogDescription } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { getPaymentModes, createPaymentMode, updatePaymentMode, deletePaymentMode, PaymentMode } from "@/lib/data/payment-modes";
import { cn } from "@/lib/utils";
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
import { useCompany } from "@/contexts/CompanyContext";

interface PaymentModeManagerModalProps {
    onClose?: () => void;
    onChange?: () => void; // Trigger reload in parent
}

export function PaymentModeManagerModal({ onClose, onChange }: PaymentModeManagerModalProps) {
    const { toast } = useToast();
    const { selectedCompany } = useCompany();
    const [modes, setModes] = useState<PaymentMode[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [newItemName, setNewItemName] = useState("");
    const [isCreating, setIsCreating] = useState(false);

    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState("");
    const [isUpdating, setIsUpdating] = useState(false);
    const [addBoxOpen, setAddBoxOpen] = useState(false);

    const [itemToDelete, setItemToDelete] = useState<string | null>(null);

    const fetchModes = async () => {
        if (!selectedCompany) return;
        setIsLoading(true);
        try {
            const data = await getPaymentModes(selectedCompany.id);
            setModes(data);
        } catch (error) {
            console.error(error);
            toast({ title: "Erro ao carregar modalidades", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchModes();
    }, [selectedCompany]);

    const handleCreate = async () => {
        if (!newItemName.trim() || !selectedCompany) return;
        setIsCreating(true);
        try {
            await createPaymentMode(selectedCompany.id, newItemName);
            setNewItemName("");
            fetchModes();
            onChange?.();
            toast({ title: "Modalidade criada!", variant: "default" });
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
            await updatePaymentMode(id, editName);
            setEditingId(null);
            fetchModes();
            onChange?.();
            toast({ title: "Modalidade atualizada!", variant: "default" });
        } catch (error: any) {
            toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
        } finally {
            setIsUpdating(false);
        }
    };

    const handleDelete = async () => {
        if (!itemToDelete) return;
        try {
            await deletePaymentMode(itemToDelete);
            fetchModes();
            onChange?.();
            toast({ title: "Modalidade removida!", variant: "default" });
        } catch (error: any) {
            toast({ title: "Erro ao remover", description: error.message, variant: "destructive" });
        } finally {
            setItemToDelete(null);
        }
    };

    return (
        <DialogContent className="max-w-4xl w-full p-0 gap-0 bg-gray-50 overflow-hidden rounded-2xl">
            {/* Header */}
            <div className="bg-white px-6 py-4 border-b border-gray-100 flex justify-between items-center sticky top-0 z-10">
                <div>
                    <DialogTitle className="text-xl font-semibold text-gray-900">Modalidades de Pagamento</DialogTitle>
                    <DialogDescription className="text-sm text-gray-500 mt-1">
                        Gerencie as formas de pagamento aceitas (ex: Pix, Boleto, Cartão).
                    </DialogDescription>
                </div>
                <Button
                    onClick={() => {
                        setEditingId(null);
                        setAddBoxOpen(!addBoxOpen);
                    }}
                    className="bg-brand-600 hover:bg-brand-700 text-white rounded-full px-4 text-xs h-8 shadow-card transition-all"
                >
                    <Plus className="w-3.5 h-3.5 mr-1.5" />
                    Nova Modalidade
                </Button>
            </div>

            <div className="p-6 overflow-y-auto max-h-screen">
                {/* Create/Edit Form Inline */}
                {(addBoxOpen || editingId) && (
                    <Card className="mb-6 bg-white p-4 border border-gray-200/70 shadow-card animate-in fade-in slide-in-from-top-2">
                        <div className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                            {editingId ? <Edit className="w-4 h-4 text-blue-500" /> : <Plus className="w-4 h-4 text-brand-500" />}
                            {editingId ? "Editar Modalidade" : "Nova Modalidade"}
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                            <div>
                                <label className="text-xs text-gray-500 mb-1.5 block">Nome</label>
                                <Input
                                    value={editingId ? editName : newItemName}
                                    onChange={(e) => editingId ? setEditName(e.target.value) : setNewItemName(e.target.value)}
                                    placeholder="Ex: Pix, Boleto 30 Dias..."
                                    className="h-9 text-sm rounded-lg"
                                    autoFocus
                                    onKeyDown={(e) => e.key === 'Enter' && (editingId ? handleUpdate(editingId) : handleCreate())}
                                />
                            </div>
                        </div>

                        <div className="mt-4 flex gap-2">
                            <Button
                                onClick={() => editingId ? handleUpdate(editingId) : handleCreate()}
                                disabled={isCreating || isUpdating || !(editingId ? editName : newItemName).trim()}
                                className="h-9 flex-1 bg-brand-600 hover:bg-brand-700 text-white rounded-lg font-medium transition-all"
                            >
                                {(isCreating || isUpdating) ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    editingId ? "Salvar Alterações" : "Criar Modalidade"
                                )}
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setEditingId(null);
                                    setAddBoxOpen(false);
                                }}
                                className="h-9 w-9 p-0 bg-gray-50 hover:bg-white text-gray-500 rounded-lg border-gray-200"
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
                                <TableHead className="text-xs font-semibold text-gray-500 h-10 text-center">USO</TableHead>
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
                            ) : modes.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={3} className="h-32 text-center text-gray-400 text-sm">
                                        Nenhuma modalidade cadastrada.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                modes.map((mode) => (
                                    <TableRow key={mode.id} className="group border-gray-50 hover:bg-gray-50/50 transition-colors">
                                        <TableCell className="py-3 font-medium text-gray-900">
                                            {mode.name}
                                        </TableCell>
                                        <TableCell className="py-3 text-center">
                                            {mode.usage_count! > 0 ? (
                                                <span className="inline-flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full font-medium">
                                                    {mode.usage_count} usos
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
                                                        setEditingId(mode.id);
                                                        setEditName(mode.name);
                                                    }}
                                                    className="h-7 w-7 p-0 rounded-lg hover:bg-blue-50 hover:text-blue-600 text-gray-400 transition-colors"
                                                >
                                                    <Edit className="h-3.5 w-3.5" />
                                                </Button>

                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => setItemToDelete(mode.id)}
                                                    disabled={mode.usage_count! > 0}
                                                    className={cn(
                                                        "h-7 w-7 p-0 rounded-lg transition-colors border-none bg-transparent",
                                                        mode.usage_count! > 0
                                                            ? "opacity-20 cursor-not-allowed"
                                                            : "hover:bg-red-50 hover:text-red-600 text-gray-400"
                                                    )}
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
                open={!!itemToDelete}
                onOpenChange={(val) => !val && setItemToDelete(null)}
                title="Excluir Modalidade"
                description={`Tem certeza que deseja excluir esta modalidade? Esta ação não pode ser desfeita.`}
                onConfirm={handleDelete}
                variant="danger"
            />
        </DialogContent>
    );
}
