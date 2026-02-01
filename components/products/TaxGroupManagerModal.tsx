
import { useEffect, useState } from "react";
import { Edit, Loader2, Plus, Trash2, X } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { DialogContent, DialogTitle, DialogDescription } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { TaxGroup, getTaxGroups, createTaxGroup, updateTaxGroup, deleteTaxGroup } from "@/lib/data/tax-groups";
import { createClient } from "@/lib/supabaseBrowser";
import { useCompany } from "@/contexts/CompanyContext";
import { cn, toTitleCase } from "@/lib/utils";
import { ConfirmDialogDesdobra } from "@/components/ui/ConfirmDialogDesdobra";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";

interface TaxGroupManagerModalProps {
    onClose?: () => void;
    onChange?: () => void; // Trigger reload in parent
}

export function TaxGroupManagerModal({ onClose, onChange }: TaxGroupManagerModalProps) {
    const { toast } = useToast();
    const { selectedCompany } = useCompany();
    const supabase = createClient();

    const [groups, setGroups] = useState<TaxGroup[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Form State
    const [isCreating, setIsCreating] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isUpdating, setIsUpdating] = useState(false);
    const [addBoxOpen, setAddBoxOpen] = useState(false);

    const [formName, setFormName] = useState("");
    // Deprecated: NCM/CEST/Origin are now on Product
    const [formObservation, setFormObservation] = useState("");
    const [formIsActive, setFormIsActive] = useState(true);

    const [groupToDelete, setGroupToDelete] = useState<string | null>(null);

    const fetchGroups = async () => {
        if (!selectedCompany?.id) return;
        setIsLoading(true);
        try {
            // Fetch ALL (including inactive) for management
            const data = await getTaxGroups(supabase, selectedCompany.id, false);
            setGroups(data);
        } catch (error) {
            console.error(error);
            toast({ title: "Erro ao carregar grupos tributários", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchGroups();
    }, [selectedCompany?.id]);

    const resetForm = () => {
        setFormName("");
        setFormObservation("");
        setFormIsActive(true);
        setEditingId(null);
    };

    const handleStartEdit = (group: TaxGroup) => {
        setEditingId(group.id);
        setFormName(group.name);
        setFormObservation(group.observation || "");
        setFormIsActive(group.is_active);
        setAddBoxOpen(true); // Re-use the add box for editing
    };

    const validate = () => {
        if (!formName.trim()) {
            toast({ title: "Nome obrigatório", variant: "destructive" });
            return false;
        }
        return true;
    }

    const handleCreate = async () => {
        if (!selectedCompany?.id) return;
        if (!validate()) return;
        setIsCreating(true);
        try {
            await createTaxGroup(supabase, {
                company_id: selectedCompany.id,
                name: toTitleCase(formName) || "",
                // Deprecated: ncm, cest, origin_default removed from payload
                is_active: formIsActive,
                observation: formObservation || null
            });
            resetForm();
            fetchGroups();
            onChange?.();
            toast({ title: "Grupo criado com sucesso!", variant: "default" });
        } catch (error: any) {
            toast({ title: "Erro ao criar", description: error.message, variant: "destructive" });
        } finally {
            setIsCreating(false);
        }
    };

    const handleUpdate = async (id: string) => {
        if (!validate()) return;
        setIsUpdating(true);
        try {
            await updateTaxGroup(supabase, id, {
                name: toTitleCase(formName) || "",
                // Deprecated: ncm, cest, origin_default removed from payload
                is_active: formIsActive,
                observation: formObservation || null
            });
            resetForm();
            fetchGroups();
            onChange?.();
            toast({ title: "Grupo atualizado!", variant: "default" });
            setAddBoxOpen(false); // Close box after update
        } catch (error: any) {
            toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
        } finally {
            setIsUpdating(false);
        }
    };

    const handleDelete = async () => {
        if (!groupToDelete) return;
        try {
            await deleteTaxGroup(supabase, groupToDelete);
            fetchGroups();
            onChange?.();
            toast({ title: "Grupo removido!", variant: "default" });
        } catch (error: any) {
            toast({ title: "Erro ao remover", description: error.message, variant: "destructive" });
        } finally {
            setGroupToDelete(null);
        }
    };

    return (
        <DialogContent className="max-w-[900px] w-full p-0 gap-0 bg-gray-50 overflow-hidden rounded-2xl">
            {/* Header */}
            <div className="bg-white px-6 py-4 border-b border-gray-100 flex justify-between items-center sticky top-0 z-10">
                <div>
                    <DialogTitle className="text-xl font-semibold text-gray-900">Grupos Tributários</DialogTitle>
                    <DialogDescription className="text-sm text-gray-500 mt-1">
                        Gerencie os agrupadores de regras fiscais.
                    </DialogDescription>
                </div>
                <Button
                    onClick={() => {
                        resetForm();
                        setAddBoxOpen(!addBoxOpen);
                    }}
                    className="bg-brand-600 hover:bg-brand-700 text-white rounded-full px-4 text-xs h-8 shadow-sm transition-all"
                >
                    <Plus className="w-3.5 h-3.5 mr-1.5" />
                    Novo Grupo
                </Button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[60vh]">
                {/* Create/Edit Form Inline */}
                {(addBoxOpen || editingId) && (
                    <div className="mb-6 bg-white p-4 rounded-xl border border-gray-200 shadow-sm animate-in fade-in slide-in-from-top-2">
                        <div className="text-sm font-semibold text-gray-900 mb-4 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                {editingId ? <Edit className="w-4 h-4 text-blue-500" /> : <Plus className="w-4 h-4 text-brand-500" />}
                                {editingId ? "Editar Grupo Tributário" : "Novo Grupo Tributário"}
                            </div>

                            <div className="flex items-center gap-2">
                                <label className="text-xs text-gray-500 font-medium">Status:</label>
                                <button
                                    onClick={() => setFormIsActive(!formIsActive)}
                                    className={cn(
                                        "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                                        formIsActive ? "bg-green-500" : "bg-gray-200"
                                    )}
                                >
                                    <span
                                        className={cn(
                                            "inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ml-1",
                                            formIsActive && "translate-x-3.5"
                                        )}
                                    />
                                </button>
                                <span className="text-xs font-medium text-gray-700">{formIsActive ? "Ativo" : "Inativo"}</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-12 gap-4">
                            <div className="col-span-12 md:col-span-6">
                                <label className="text-xs text-gray-500 mb-1.5 block">Nome do Grupo *</label>
                                <Input
                                    value={formName}
                                    onChange={(e) => setFormName(e.target.value)}
                                    onBlur={() => setFormName(toTitleCase(formName) || "")}
                                    placeholder="Ex: Revenda 18%, Produção Própria..."
                                    className="h-9 text-sm rounded-lg"
                                    autoFocus
                                />
                            </div>
                            {/* NCM/CEST/Origin removed */}
                            <div className="col-span-12 md:col-span-6">
                                <label className="text-xs text-gray-500 mb-1.5 block">Observação Fiscal</label>
                                <Input
                                    value={formObservation}
                                    onChange={(e) => setFormObservation(e.target.value)}
                                    placeholder="Ex: Base reduzida conf art. X..."
                                    className="h-9 text-sm rounded-lg"
                                />
                            </div>
                        </div>

                        <div className="mt-4 flex gap-2">
                            <Button
                                onClick={() => editingId ? handleUpdate(editingId) : handleCreate()}
                                disabled={isCreating || isUpdating}
                                className="h-9 flex-1 bg-brand-600 hover:bg-brand-700 text-white rounded-lg font-medium transition-all"
                            >
                                {(isCreating || isUpdating) ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    editingId ? "Salvar Alterações" : "Criar Grupo"
                                )}
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => {
                                    resetForm();
                                    setAddBoxOpen(false);
                                }}
                                className="h-9 w-9 p-0 bg-gray-50 hover:bg-white text-gray-500 rounded-lg border-gray-200"
                            >
                                <X className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                )}

                {/* List Container */}
                <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
                    <Table>
                        <TableHeader className="bg-gray-50/50">
                            <TableRow className="hover:bg-transparent border-gray-100">
                                <TableHead className="w-full text-xs font-semibold text-gray-500 h-10">NOME DO GRUPO</TableHead>
                                <TableHead className="text-xs font-semibold text-gray-500 h-10 text-right pr-4">AÇÕES</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-32 text-center">
                                        <Loader2 className="h-6 w-6 animate-spin mx-auto text-gray-300" />
                                    </TableCell>
                                </TableRow>
                            ) : groups.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-32 text-center text-gray-400 text-sm">
                                        Nenhum grupo tributário cadastrado.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                groups.map((group) => (
                                    <TableRow key={group.id} className="group border-gray-50 hover:bg-gray-50/50 transition-colors">
                                        <TableCell className="py-3 font-medium text-gray-900">
                                            {group.name}
                                        </TableCell>
                                        {/* Columns removed */}
                                        <TableCell className="py-3 text-right pr-4">
                                            <div className="flex justify-end gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleStartEdit(group)}
                                                    className="h-7 w-7 p-0 rounded-lg hover:bg-blue-50 hover:text-blue-600 text-gray-400 transition-colors"
                                                >
                                                    <Edit className="h-3.5 w-3.5" />
                                                </Button>

                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => setGroupToDelete(group.id)}
                                                    className="h-7 w-7 p-0 rounded-lg hover:bg-red-50 hover:text-red-600 text-gray-400 transition-colors"
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
            </div>

            <ConfirmDialogDesdobra
                open={!!groupToDelete}
                onOpenChange={(val) => !val && setGroupToDelete(null)}
                title="Excluir Grupo Tributário"
                description={`Tem certeza que deseja excluir este grupo? Produtos associados perderão esta configuração.`}
                onConfirm={handleDelete}
                variant="danger"
            />
        </DialogContent>
    );
}
