"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select-shadcn';
import { Label } from '@/components/ui/Label';
// import { getSystemReasons } from "@/lib/data/system-preferences";
// import { SystemOccurrenceReasonWithDefaults } from "@/types/system-preferences";
import { OccurrenceActionsPanel, OperationAction } from "@/components/settings/system/OccurrenceActionsPanel";
import { listDeliveryReasonsAction } from "@/app/actions/expedition/reason-actions";

interface NotDeliveredModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (reasonLabel: string, notes?: string, actionFlags?: any) => void;
    order: any;
}

export function NotDeliveredModal({ isOpen, onClose, onConfirm, order }: NotDeliveredModalProps) {
    const { toast } = useToast();

    // Data State
    const [reasons, setReasons] = useState<any[]>([]);
    const [isLoadingReasons, setIsLoadingReasons] = useState(false);
    const [reasonsError, setReasonsError] = useState(false);

    // Form State
    const [selectedReasonId, setSelectedReasonId] = useState("");
    const [notes, setNotes] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Actions State
    const [currentActions, setCurrentActions] = useState<Record<string, boolean>>({
        [OperationAction.GENERATE_RETURN_MOVEMENT]: true,
        [OperationAction.RETURN_TO_SANDBOX_PENDING]: false
    });
    const [defaultActions, setDefaultActions] = useState<Record<string, boolean>>({});

    // Fetch Reasons
    useEffect(() => {
        if (isOpen) {
            let isMounted = true;

            const loadReasons = async () => {
                setIsLoadingReasons(true);
                setReasonsError(false);

                try {
                    const res = await listDeliveryReasonsAction('RETORNO_NAO_ENTREGUE');
                    if (!res.ok) {
                        throw new Error(res.error?.message || "Falha ao carregar motivos.");
                    }
                    const data = res.data || [];

                    if (isMounted) {
                        if (data.length > 0) {
                            setReasons(data);
                        } else {
                            setReasons([]);
                        }
                    }
                } catch (error) {
                    console.error("Failed to load reasons:", error);
                    if (isMounted) {
                        setReasonsError(true);
                        setReasons([]);
                    }
                } finally {
                    if (isMounted) setIsLoadingReasons(false);
                }
            };

            loadReasons();

            // Reset Form
            setSelectedReasonId("");
            setNotes("");
            setCurrentActions({
                [OperationAction.GENERATE_RETURN_MOVEMENT]: true,
                [OperationAction.RETURN_TO_SANDBOX_PENDING]: false
            });
            setDefaultActions({});

            return () => { isMounted = false; };
        }
    }, [isOpen, order]);

    // Handle Reason Selection & Defaults
    const handleReasonChange = (reasonId: string) => {
        setSelectedReasonId(reasonId);

        const reason = reasons.find(r => r.id === reasonId);
        // DeliveryReason doesn't have complex defaults currently, so we stick to currentActions defaults
        // If we need to implement defaults for custom reasons, we'd need to extend the DeliveryReason schema.
        // For now, we preserve the "require_note" check which IS in DeliveryReason.
    };

    const handleActionChange = (action: OperationAction, value: boolean) => {
        setCurrentActions(prev => ({ ...prev, [action]: value }));
    };

    const handleSubmit = async () => {
        if (!selectedReasonId && selectedReasonId !== 'other') return;

        const selectedReason = reasons.find(r => r.id === selectedReasonId);
        const isOther = selectedReasonId === 'other';

        if (selectedReason?.require_note && !notes.trim()) {
            toast({ title: "Erro", description: "Observação obrigatória.", variant: "destructive" });
            return;
        }
        if (isOther && !notes.trim()) {
            toast({ title: "Erro", description: "Observação obrigatória para 'Outro'.", variant: "destructive" });
            return;
        }

        setIsSubmitting(true);
        try {
            const finalReasonLabel = isOther ? "Outro" : selectedReason?.name || "Desconhecido";
            const actionFlags = {
                create_devolution: currentActions[OperationAction.GENERATE_RETURN_MOVEMENT],
                return_to_pending: currentActions[OperationAction.RETURN_TO_SANDBOX_PENDING],
                register_notes: true // Automatic
            };

            await onConfirm(finalReasonLabel, notes, actionFlags);
            onClose();
        } catch (error) {
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const selectedReason = reasons.find(r => r.id === selectedReasonId);

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="w-full max-w-3xl max-h-screen flex flex-col overflow-hidden">
                <DialogHeader>
                    <DialogTitle>Não Entregue (Rascunho)</DialogTitle>
                    <p className="text-sm text-gray-500">
                        O pedido <strong>#{order?.sales_order?.document_number || order?.document_number || ''}</strong> não foi entregue. Todo o material retornará ao estoque.
                    </p>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto py-4 pr-1">
                    <div className="grid grid-cols-1 gap-6">
                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <Label>Motivo <span className="text-red-500">*</span></Label>
                                <Select value={selectedReasonId} onValueChange={handleReasonChange} disabled={isLoadingReasons}>
                                    <SelectTrigger className={`w-full focus:ring-offset-0 ${reasonsError ? "border-red-300 bg-red-50" : ""}`}>
                                        <SelectValue placeholder={
                                            isLoadingReasons ? "Carregando motivos..." :
                                                reasonsError ? "Erro ao carregar motivos." :
                                                    "Selecione o motivo..."
                                        } />
                                    </SelectTrigger>
                                    <SelectContent className="max-h-64">
                                        {reasons.map((r) => (
                                            <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                                        ))}
                                        {(reasonsError || reasons.length === 0) && (
                                            <SelectItem value="other">Outro (Manual)</SelectItem>
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-1.5">
                                <Label>Observações {reasons.find(r => r.id === selectedReasonId)?.require_note && <span className="text-red-500">*</span>}</Label>
                                <Textarea
                                    placeholder="Detalhes adicionais..."
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    className="resize-none h-24"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Cancelar</Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={!selectedReasonId || isSubmitting}
                        className="bg-red-600 hover:bg-red-700 text-white"
                    >
                        {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Confirmar Não Entregue
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
