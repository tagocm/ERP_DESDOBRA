"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select-shadcn';
import { Label } from '@/components/ui/Label';
import { createClient } from "@/utils/supabase/client";
import { getSystemReasons } from "@/lib/data/system-preferences";
import { SystemOccurrenceReasonWithDefaults } from "@/types/system-preferences";
import { OccurrenceActionsPanel, OperationAction } from "@/components/settings/system/OccurrenceActionsPanel";

interface NotDeliveredModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (reasonLabel: string, notes?: string, actionFlags?: any) => void;
    order: any;
}

export function NotDeliveredModal({ isOpen, onClose, onConfirm, order }: NotDeliveredModalProps) {
    const [supabase] = useState(() => createClient());
    const { toast } = useToast();

    // Data State
    const [reasons, setReasons] = useState<SystemOccurrenceReasonWithDefaults[]>([]);
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
                    const data = await getSystemReasons(supabase, 'RETORNO_NAO_ENTREGUE');

                    if (isMounted) {
                        if (data && data.length > 0) {
                            setReasons(data);
                        } else {
                            throw new Error("No reasons found");
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
    }, [isOpen, supabase]);

    // Handle Reason Selection & Defaults
    const handleReasonChange = (reasonId: string) => {
        setSelectedReasonId(reasonId);

        const reason = reasons.find(r => r.id === reasonId);
        if (reason?.defaults) {
            const defaults = {
                [OperationAction.GENERATE_RETURN_MOVEMENT]: reason.defaults.create_devolution ?? true,
                [OperationAction.RETURN_TO_SANDBOX_PENDING]: reason.defaults.return_to_sandbox_pending ?? false
            };
            setDefaultActions(defaults);
            setCurrentActions(defaults);
        }
    };

    const handleActionChange = (action: OperationAction, value: boolean) => {
        setCurrentActions(prev => ({ ...prev, [action]: value }));
    };

    const handleSubmit = async () => {
        if (!selectedReasonId && selectedReasonId !== 'other') return;

        const selectedReason = reasons.find(r => r.id === selectedReasonId);
        const isOther = selectedReasonId === 'other';

        if (selectedReason?.defaults?.require_note && !notes.trim()) {
            toast({ title: "Erro", description: "Observação obrigatória.", variant: "destructive" });
            return;
        }
        if (isOther && !notes.trim()) {
            toast({ title: "Erro", description: "Observação obrigatória para 'Outro'.", variant: "destructive" });
            return;
        }

        setIsSubmitting(true);
        try {
            const finalReasonLabel = isOther ? "Outro" : selectedReason?.label || "Desconhecido";
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
            <DialogContent className="max-w-3xl h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Não Entregue (Rascunho)</DialogTitle>
                    <p className="text-sm text-gray-500">
                        O pedido <strong>#{order?.sales_order?.document_number || order?.document_number || ''}</strong> não foi entregue. Todo o material retornará ao estoque.
                    </p>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto py-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <Label>Motivo <span className="text-red-500">*</span></Label>
                                <Select value={selectedReasonId} onValueChange={handleReasonChange} disabled={isLoadingReasons}>
                                    <SelectTrigger className={reasonsError ? "border-red-300 bg-red-50" : ""}>
                                        <SelectValue placeholder={
                                            isLoadingReasons ? "Carregando motivos..." :
                                                reasonsError ? "Erro ao carregar motivos." :
                                                    "Selecione o motivo..."
                                        } />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {reasons.map((r) => (
                                            <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>
                                        ))}
                                        {(reasonsError || reasons.length === 0) && (
                                            <SelectItem value="other">Outro (Manual)</SelectItem>
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-1.5">
                                <Label>Observações {reasons.find(r => r.id === selectedReasonId)?.defaults?.require_note && <span className="text-red-500">*</span>}</Label>
                                <Textarea
                                    placeholder="Detalhes adicionais..."
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    className="resize-none h-24"
                                />
                            </div>
                        </div>

                        <div>
                            <OccurrenceActionsPanel
                                mode="operation"
                                availableActions={[
                                    OperationAction.GENERATE_RETURN_MOVEMENT,
                                    OperationAction.RETURN_TO_SANDBOX_PENDING
                                ]}
                                currentActions={currentActions}
                                defaultActions={defaultActions}
                                onChange={handleActionChange}
                            />
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
