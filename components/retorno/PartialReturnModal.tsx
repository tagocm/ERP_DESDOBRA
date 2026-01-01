"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { AlertCircle, Loader2, AlertTriangle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select-shadcn';
import { Label } from '@/components/ui/Label';
import { createClient } from "@/utils/supabase/client";
import { getSystemReasons } from "@/lib/data/system-preferences";
import { SystemOccurrenceReasonWithDefaults } from "@/types/system-preferences";
import { OccurrenceActionsPanel, OperationAction } from "@/components/settings/system/OccurrenceActionsPanel";

interface PartialReturnModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (deliveredItems: { itemId: string; deliveredQty: number }[], reasonLabel: string, details: any) => Promise<void>;
    order: any;
}

export function PartialReturnModal({ isOpen, onClose, onConfirm, order }: PartialReturnModalProps) {
    const [supabase] = useState(() => createClient());
    const { toast } = useToast();

    // Data State
    const [reasons, setReasons] = useState<SystemOccurrenceReasonWithDefaults[]>([]);
    const [isLoadingReasons, setIsLoadingReasons] = useState(false);
    const [reasonsError, setReasonsError] = useState(false);

    // Form State
    const [deliveredItems, setDeliveredItems] = useState<{ [key: string]: number }>({});
    const [selectedReasonId, setSelectedReasonId] = useState("");
    const [notes, setNotes] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Actions State
    const [currentActions, setCurrentActions] = useState<Record<string, boolean>>({
        [OperationAction.GENERATE_RETURN_MOVEMENT]: true,
        [OperationAction.GENERATE_NEW_ORDER_PENDING]: false
    });
    const [defaultActions, setDefaultActions] = useState<Record<string, boolean>>({});

    // Initialize items
    useEffect(() => {
        if (isOpen && (order?.items || order?.sales_order?.items)) {
            const items = order?.items || order?.sales_order?.items;
            const initial: { [key: string]: number } = {};
            items.forEach((item: any) => {
                initial[item.id] = item.quantity;
            });
            setDeliveredItems(initial);
        }
    }, [order, isOpen]);

    // Fetch Reasons
    useEffect(() => {
        if (isOpen) {
            let isMounted = true;

            const loadReasons = async () => {
                setIsLoadingReasons(true);
                setReasonsError(false);

                try {
                    const data = await getSystemReasons(supabase, 'RETORNO_ENTREGA_PARCIAL');

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
                [OperationAction.GENERATE_NEW_ORDER_PENDING]: false
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
                [OperationAction.GENERATE_NEW_ORDER_PENDING]: reason.defaults.create_new_order_for_pending ?? false
            };
            setDefaultActions(defaults);
            setCurrentActions(defaults);
        }
    };

    const handleActionChange = (action: OperationAction, value: boolean) => {
        setCurrentActions(prev => ({ ...prev, [action]: value }));
    };

    const handleQtyChange = (itemId: string, val: string) => {
        const num = parseFloat(val);
        if (isNaN(num)) return;
        setDeliveredItems(prev => ({ ...prev, [itemId]: num }));
    };

    const handleSubmit = async () => {
        // Allow fallback submission or check logic
        if (!selectedReasonId && selectedReasonId !== 'other') return;

        const items = order?.items || order?.sales_order?.items || [];
        let hasError = false;

        items.forEach((item: any) => {
            const delivered = deliveredItems[item.id] ?? item.quantity;
            if (delivered > item.quantity) hasError = true;
        });

        if (hasError) {
            toast({ title: "Erro de Quantidade", description: "Qtd. entregue > original.", variant: "destructive" });
            return;
        }

        const hasAnyDeliveredItem = items.some((item: any) => {
            const delivered = deliveredItems[item.id] ?? item.quantity;
            return delivered > 0;
        });

        if (!hasAnyDeliveredItem) {
            toast({ title: "Atenção", description: "Use 'Não Entregue' se nada foi entregue.", variant: "destructive" });
            return;
        }

        const isActuallyPartial = items.some((item: any) => {
            const delivered = deliveredItems[item.id] ?? item.quantity;
            return delivered < item.quantity;
        });

        if (!isActuallyPartial) {
            toast({ title: "Atenção", description: "Use 'Entregue' (Verde) se tudo foi entregue.", variant: "destructive" });
            return;
        }

        const selectedReason = reasons.find(r => r.id === selectedReasonId);
        const isOther = selectedReasonId === 'other';

        if (selectedReason?.defaults?.require_note && !notes.trim()) {
            toast({ title: "Observação Obrigatória", description: `O motivo "${selectedReason.label}" exige observação.`, variant: "destructive" });
            return;
        }
        if (isOther && !notes.trim()) {
            toast({ title: "Observação Obrigatória", description: "Para 'Outro', a observação é obrigatória.", variant: "destructive" });
            return;
        }

        setIsSubmitting(true);
        try {
            const finalReasonLabel = isOther ? "Outro" : selectedReason?.label || "Desconhecido";

            const payloadItems = items.map((item: any) => {
                const deliveredQty = deliveredItems[item.id] ?? item.quantity;
                const returnedQty = item.quantity - deliveredQty;
                return {
                    itemId: item.id,
                    deliveredQty,
                    returnedQty,
                    product_id: item.product?.id,
                    qty_original: item.quantity,
                };
            });

            const details = {
                kind: "RETORNO_ENTREGA_PARCIAL",
                reason_id: isOther ? null : selectedReasonId,
                reason_label: finalReasonLabel,
                observations: notes,
                items: payloadItems,
                actions: {
                    create_devolution: currentActions[OperationAction.GENERATE_RETURN_MOVEMENT],
                    create_new_order_for_pending: currentActions[OperationAction.GENERATE_NEW_ORDER_PENDING],
                    register_notes: true // Always true per requirements
                }
            };

            const simplifiedItems = payloadItems.map((pi: any) => ({
                itemId: pi.itemId,
                deliveredQty: pi.deliveredQty
            }));

            await onConfirm(simplifiedItems, finalReasonLabel, details);
            onClose();
        } catch (error) {
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const items = order?.items || order?.sales_order?.items || [];
    const hasInvalidItems = items.some((item: any) => {
        const delivered = deliveredItems[item.id] ?? item.quantity;
        return delivered > item.quantity;
    });
    const hasReturnedItems = items.some((item: any) => {
        const delivered = deliveredItems[item.id] || 0;
        return delivered < item.quantity;
    });
    const selectedReason = reasons.find(r => r.id === selectedReasonId);

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-3xl h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Entrega Parcial (Rascunho)</DialogTitle>
                    <p className="text-sm text-gray-500">
                        Confirme os itens entregues. Saldo será tratado como devolução.
                    </p>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto space-y-4 py-2">
                    {/* Items List */}
                    <div className="border rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 border-b">
                                <tr>
                                    <th className="px-3 py-1.5 text-left font-medium text-gray-600">Produto</th>
                                    <th className="px-3 py-1.5 text-center font-medium text-gray-600">Qtd. Enviada</th>
                                    <th className="px-3 py-1.5 text-center font-medium text-gray-600 w-28">Qtd. Entregue</th>
                                    <th className="px-3 py-1.5 text-center font-medium text-gray-600">Devolução</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {items.map((item: any) => {
                                    const delivered = deliveredItems[item.id] ?? item.quantity;
                                    const returned = item.quantity - delivered;
                                    const isExcess = delivered > item.quantity;

                                    return (
                                        <tr key={item.id} className={returned > 0 ? "bg-amber-50/30" : ""}>
                                            <td className="px-3 py-1.5">
                                                <div className="font-medium text-gray-900">{item.product?.name}</div>
                                                <div className="text-xs text-gray-500">{item.product?.sku}</div>
                                            </td>
                                            <td className="px-3 py-1.5 text-center text-gray-600">
                                                {item.quantity}
                                            </td>
                                            <td className="px-3 py-1.5">
                                                <div className="flex justify-center">
                                                    <Input
                                                        type="number"
                                                        className={`w-20 text-center h-7 text-xs ${isExcess ? "border-red-500 text-red-600 focus-visible:ring-red-500" : ""}`}
                                                        value={delivered}
                                                        onChange={(e) => handleQtyChange(item.id, e.target.value)}
                                                        min={0}
                                                    />
                                                </div>
                                            </td>
                                            <td className="px-3 py-1.5 text-center">
                                                {returned > 0 ? (
                                                    <span className="text-amber-600 font-bold">{returned}</span>
                                                ) : returned < 0 ? (
                                                    <span className="text-red-500 font-bold">Erro</span>
                                                ) : (
                                                    <span className="text-gray-400 font-medium">-</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

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
                                    OperationAction.GENERATE_NEW_ORDER_PENDING
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
                        disabled={!selectedReasonId || isSubmitting || hasInvalidItems || !hasReturnedItems}
                        className={hasReturnedItems ? "bg-amber-600 hover:bg-amber-700 text-white" : ""}
                    >
                        {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Confirmar Parcial
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
