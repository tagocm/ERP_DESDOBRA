
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { Loader2, AlertCircle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select-shadcn';
import { Label } from '@/components/ui/Label';
import { Switch } from "@/components/ui/Switch";
import { createClient } from "@/utils/supabase/client";
import { getOccurrenceReasons } from "@/lib/data/reasons";
import { OccurrenceReason } from "@/types/reasons";
import { useCompany } from "@/contexts/CompanyContext";

interface NotLoadedModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    order: any;
    routeId: string;
    initialData?: any;
}

export function NotLoadedModal({ isOpen, onClose, onSuccess, order, routeId, initialData }: NotLoadedModalProps) {
    const [supabase] = useState(() => createClient());
    const { toast } = useToast();
    const { selectedCompany } = useCompany();

    // Data State
    const [reasons, setReasons] = useState<OccurrenceReason[]>([]);
    const [isLoadingReasons, setIsLoadingReasons] = useState(false);
    const [reasonsError, setReasonsError] = useState(false);

    // Form State
    const [selectedReasonId, setSelectedReasonId] = useState("");
    const [notes, setNotes] = useState("");
    const [createNewOrderCopy, setCreateNewOrderCopy] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Fetch Reasons and Set Initial Data
    useEffect(() => {
        if (isOpen && selectedCompany?.id) {
            let isMounted = true;

            const loadReasons = async () => {
                setIsLoadingReasons(true);
                setReasonsError(false);

                try {
                    const data = await getOccurrenceReasons(supabase, selectedCompany.id, 'exp_nao_carregado');

                    if (isMounted) {
                        if (data && data.length > 0) {
                            setReasons(data);

                            // Pre-fill if editing
                            if (initialData) {
                                let reasonToSelect = null;
                                if (initialData.reasonId) {
                                    reasonToSelect = data.find(r => r.id === initialData.reasonId);
                                }
                                if (!reasonToSelect && initialData.reason) { // Fallback to name
                                    reasonToSelect = data.find(r => r.name === initialData.reason);
                                }

                                if (reasonToSelect) {
                                    setSelectedReasonId(reasonToSelect.id);
                                } else if (initialData.reason) {
                                    // "Other" or custom reason not in list
                                    setSelectedReasonId("other");
                                }

                                if (initialData.text_other) setNotes(initialData.text_other);
                                if (initialData.observation) setNotes(initialData.observation);

                                // Restore toggle state from payload actions
                                if (initialData.payload?.actions?.create_new_order_copy) {
                                    setCreateNewOrderCopy(true);
                                }
                            }
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

            // Reset Form (if no initialData, or cleanup)
            if (!initialData) {
                setSelectedReasonId("");
                setNotes("");
                setCreateNewOrderCopy(false);
            }

            return () => { isMounted = false; };
        }
    }, [isOpen, supabase, selectedCompany, initialData]);

    const handleSubmit = async () => {
        if (!selectedReasonId && selectedReasonId !== 'other') return;

        const selectedReason = reasons.find(r => r.id === selectedReasonId);
        const isOther = selectedReasonId === 'other';

        // Validation based on requirements
        // Note: We removed 'require_reasons' dynamic check to keep it simple as per requirement "d) Textarea Observação (Livre)"
        // But user requirement says: "Confirmar apenas registra..." 
        // User request: "b) Textarea Observação (livre)" implying optional? 
        // But usually "Livre" means free text. Let's make it optional unless 'Other' is selected or reason strictly requires it.

        if (selectedReason?.require_notes && !notes.trim()) {
            toast({ title: "Erro", description: "Observação é obrigatória para este motivo.", variant: "destructive" });
            return;
        }

        setIsSubmitting(true);
        try {
            const finalReasonLabel = isOther ? "Outro" : selectedReason?.name || "Desconhecido";

            // Call API
            const response = await fetch(`/api/logistics/routes/${routeId}/occurrences`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    salesDocumentId: order.id,
                    occurrenceType: 'NOT_LOADED_TOTAL',
                    reasonId: isOther ? null : selectedReasonId,
                    reasonNameSnapshot: finalReasonLabel,
                    observation: notes,
                    payload: {
                        reasonId: isOther ? null : selectedReasonId,
                        actions: {
                            create_new_order_copy: createNewOrderCopy
                        }
                    },
                    companyId: selectedCompany?.id
                })
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || "Falha ao registrar ocorrência");
            }

            toast({ title: "Sucesso", description: "Ocorrência registrada." });
            onSuccess();
            onClose();
        } catch (error: any) {
            console.error(error);
            toast({ title: "Erro", description: error.message, variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[500px] max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Pedido Não Carregado</DialogTitle>
                    <DialogDescription>
                        Pedido <strong>#{order?.document_number}</strong>
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    <div className="grid gap-4">
                        <div className="space-y-1.5">
                            <Label>Motivo</Label>
                            <Select value={selectedReasonId} onValueChange={setSelectedReasonId} disabled={isLoadingReasons}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione o motivo..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {reasons.map((r) => (
                                        <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                                    ))}
                                    <SelectItem value="other">Outros</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1.5">
                            <Label>Observação</Label>
                            <Textarea
                                placeholder="Descreva o ocorrido..."
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                className="resize-none h-24"
                            />
                        </div>

                        <div className="flex items-center space-x-2 pt-2">
                            <Switch
                                id="create-copy"
                                checked={createNewOrderCopy}
                                onCheckedChange={setCreateNewOrderCopy}
                            />
                            <Label htmlFor="create-copy" className="font-normal cursor-pointer">
                                Gerar novo pedido com os itens
                            </Label>
                        </div>

                        <div className="bg-amber-50 p-3 rounded-md flex gap-3 text-xs text-amber-800 border border-amber-100">
                            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                            <div>
                                <p className="font-semibold mb-0.5">Atenção</p>
                                <p>Ao processar a rota, este pedido voltará para status <strong>Pendente</strong>.</p>
                                {createNewOrderCopy && (
                                    <p className="mt-1 font-medium">+ Um novo pedido será criado idêntico a este.</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="outline" onClick={onClose} disabled={isSubmitting}>Cancelar</Button>
                    <Button
                        variant="primary" // Using primary as it's a confirmation
                        onClick={handleSubmit}
                        disabled={isSubmitting || !selectedReasonId}
                    >
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Confirmar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
