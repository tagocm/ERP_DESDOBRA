import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabaseBrowser";
import { getDeliveryReasons, deleteDeliveryReason } from "@/lib/data/reasons";
import { DeliveryReason, DELIVERY_REASON_GROUPS } from "@/types/reasons";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Edit2, Trash2, Plus, GripVertical, CheckCircle2 } from "lucide-react";
import { ReasonModal } from "./ReasonModal";
import { useToast } from "@/components/ui/use-toast";
import { ConfirmDialogDesdobra } from "@/components/ui/ConfirmDialogDesdobra";
import { useCompany } from "@/contexts/CompanyContext";

interface ReasonListProps {
    typeCode: string;
    typeLabel: string;
}

export function ReasonList({ typeCode, typeLabel }: ReasonListProps) {
    const { toast } = useToast();
    const { selectedCompany } = useCompany();
    const [reasons, setReasons] = useState<DeliveryReason[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingReason, setEditingReason] = useState<DeliveryReason | null>(null);
    const [deleteId, setDeleteId] = useState<string | null>(null);

    const supabase = createClient();

    const fetchReasons = async () => {
        if (!selectedCompany) return;
        setIsLoading(true);
        try {
            // We cast typeCode to any because logic mapping is done in parent or here if needed.
            // But logicTab passes 'NOT_DELIVERED_TOTAL' etc which matches DeliveryReasonGroup
            const data = await getDeliveryReasons(supabase, selectedCompany.id, typeCode as any);
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
    }, [typeCode, selectedCompany]);

    const handleCreate = () => {
        setEditingReason(null);
        setIsModalOpen(true);
    };

    const handleEdit = (reason: DeliveryReason) => {
        setEditingReason(reason);
        setIsModalOpen(true);
    };

    const handleDelete = async () => {
        if (!deleteId) return;
        try {
            await deleteDeliveryReason(supabase, deleteId);
            toast({ title: "Sucesso", description: "Motivo removido." });
            fetchReasons();
        } catch (error: any) {
            console.error(error);
            toast({
                title: "Erro ao excluir",
                description: error.message || "Ocorreu um erro inesperado.",
                variant: "destructive"
            });
        } finally {
            setDeleteId(null);
        }
    };

    if (!selectedCompany) return <div className="p-8 text-center text-gray-500">Selecione uma empresa.</div>;
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

            <Card className="divide-y divide-gray-100">
                {reasons.length === 0 ? (
                    <div className="p-8 text-center text-gray-500 text-sm">
                        Nenhum motivo cadastrado para {typeLabel}.
                    </div>
                ) : (
                    reasons.map((reason) => {
                        const groupLabel = DELIVERY_REASON_GROUPS.find(g => g.code === reason.reason_group)?.label;

                        return (
                            <div key={reason.id} className="p-4 flex items-center justify-between hover:bg-gray-50 group transition-colors">
                                <div className="flex items-center gap-3">
                                    <GripVertical className="w-4 h-4 text-gray-300 cursor-move" />
                                    <div>
                                        <div className="font-medium text-gray-900 flex items-center gap-2">
                                            {reason.name}
                                            {!reason.is_active && (
                                                <span className="px-1.5 py-0.5 rounded text-[10px] bg-gray-100 text-gray-500 font-medium border border-gray-200">
                                                    INATIVO
                                                </span>
                                            )}
                                        </div>

                                        <div className="text-xs text-gray-500 mt-1 flex gap-2 items-center flex-wrap">
                                            {groupLabel && (
                                                <span className="bg-gray-50 text-gray-600 px-1.5 py-0.5 rounded border border-gray-100 font-medium">
                                                    {groupLabel}
                                                </span>
                                            )}
                                            {reason.require_note && (
                                                <span className="bg-orange-50 text-orange-700 px-1.5 py-0.5 rounded border border-orange-100 font-medium">
                                                    Exige Observação
                                                </span>
                                            )}
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
                        );
                    })
                )}
            </Card>

            <ReasonModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                reason={editingReason}
                defaultGroup={typeCode as any}
                companyId={selectedCompany.id}
                onSaved={fetchReasons}
            />

            <ConfirmDialogDesdobra
                open={!!deleteId}
                onOpenChange={(open) => !open && setDeleteId(null)}
                title="Excluir Motivo"
                description="Tem certeza que deseja excluir este motivo?"
                confirmText="Excluir"
                variant="danger"
                onConfirm={handleDelete}
            />
        </div>
    );
}
