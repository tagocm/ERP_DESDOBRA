import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabaseBrowser";
import { getSystemReasons, deleteSystemReason } from "@/lib/data/system-preferences";
import { SystemOccurrenceReasonWithDefaults } from "@/types/system-preferences";
import { Button } from "@/components/ui/Button";
import { Edit2, Trash2, Plus, GripVertical } from "lucide-react";
import { ReasonModal } from "./ReasonModal";
import { useToast } from "@/components/ui/use-toast";
import { ConfirmDialogDesdobra } from "@/components/ui/ConfirmDialogDesdobra";

interface ReasonListProps {
    typeCode: string;
    typeLabel: string;
}

export function ReasonList({ typeCode, typeLabel }: ReasonListProps) {
    const { toast } = useToast();
    const [reasons, setReasons] = useState<SystemOccurrenceReasonWithDefaults[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingReason, setEditingReason] = useState<SystemOccurrenceReasonWithDefaults | null>(null);
    const [deleteId, setDeleteId] = useState<string | null>(null);

    const supabase = createClient();

    const fetchReasons = async () => {
        setIsLoading(true);
        try {
            const data = await getSystemReasons(supabase, typeCode);
            setReasons(data);
        } catch (error) {
            console.error(error);
            toast({ title: "Erro", description: "Falha ao carregar motivos.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchReasons();
    }, [typeCode]);

    const handleCreate = () => {
        setEditingReason(null);
        setIsModalOpen(true);
    };

    const handleEdit = (reason: SystemOccurrenceReasonWithDefaults) => {
        setEditingReason(reason);
        setIsModalOpen(true);
    };

    const handleDelete = async () => {
        if (!deleteId) return;
        try {
            await deleteSystemReason(supabase, deleteId);
            toast({ title: "Sucesso", description: "Motivo removido." });
            fetchReasons();
        } catch (error) {
            console.error(error);
            toast({ title: "Erro", description: "Erro ao remover motivo. Ele pode estar em uso.", variant: "destructive" });
        } finally {
            setDeleteId(null);
        }
    };

    if (isLoading) {
        return <div className="p-8 text-center text-gray-500">Carregando motivos...</div>;
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                    Motivos cadastrados
                </h3>
                <Button size="sm" variant="outline" onClick={handleCreate}>
                    <Plus className="w-4 h-4 mr-2" />
                    Adicionar Motivo
                </Button>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
                {reasons.length === 0 ? (
                    <div className="p-8 text-center text-gray-500 text-sm">
                        Nenhum motivo cadastrado para {typeLabel}.
                    </div>
                ) : (
                    reasons.map((reason) => (
                        <div key={reason.id} className="p-4 flex items-center justify-between hover:bg-gray-50 group transition-colors">
                            <div className="flex items-center gap-3">
                                <GripVertical className="w-4 h-4 text-gray-300 cursor-move" />
                                <div>
                                    <div className="font-medium text-gray-900 flex items-center gap-2">
                                        {reason.label}
                                        {!reason.active && (
                                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-gray-100 text-gray-500 font-medium border border-gray-200">
                                                INATIVO
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-xs text-gray-500 mt-1 flex gap-2">
                                        {reason.defaults?.require_note && <span className="text-amber-600">• Exige nota</span>}

                                        {/* Summarize actions */}
                                        {reason.defaults?.return_to_sandbox_pending && <span className="text-blue-600">• Retorna p/ Sandbox</span>}
                                        {reason.defaults?.create_devolution && <span className="text-purple-600">• Gera Devolução</span>}
                                        {reason.defaults?.create_complement_order && <span className="text-green-600">• Gera Complementar</span>}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button size="sm" variant="ghost" onClick={() => handleEdit(reason)}>
                                    <Edit2 className="w-4 h-4 text-gray-500" />
                                </Button>
                                <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => setDeleteId(reason.id)}>
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <ReasonModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                typeCode={typeCode}
                typeLabel={typeLabel}
                editingReason={editingReason}
                onSuccess={fetchReasons}
            />

            <ConfirmDialogDesdobra
                open={!!deleteId}
                onOpenChange={(open) => !open && setDeleteId(null)}
                title="Excluir Motivo"
                description="Tem certeza que deseja excluir este motivo? Esta ação não pode ser desfeita se o motivo já estiver em uso."
                confirmText="Excluir"
                variant="danger"
                onConfirm={handleDelete}
            />
        </div>
    );
}
