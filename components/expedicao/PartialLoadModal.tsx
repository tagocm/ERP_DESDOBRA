"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { SalesOrder } from "@/types/sales";
import { AlertCircle, Loader2, AlertTriangle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select-shadcn';
import { Label } from '@/components/ui/Label';
import { createClient } from "@/utils/supabase/client";
import { getSystemReasons } from "@/lib/data/system-preferences";
import { SystemOccurrenceReasonWithDefaults } from "@/types/system-preferences";
import { OccurrenceActionsPanel, OperationAction } from "@/components/settings/system/OccurrenceActionsPanel";

interface PartialLoadModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (loadedItems: { itemId: string; loadedQty: number }[], reasonLabel: string, details: any) => Promise<void>;
    order: SalesOrder;
}

export function PartialLoadModal({ isOpen, onClose, onConfirm, order }: PartialLoadModalProps) {
    const [supabase] = useState(() => createClient());
    const { toast } = useToast();

    // Data State
    const [reasons, setReasons] = useState<SystemOccurrenceReasonWithDefaults[]>([]);
    const [isLoadingReasons, setIsLoadingReasons] = useState(false);
    const [reasonsError, setReasonsError] = useState(false);

    // Form State
    const [loadedItems, setLoadedItems] = useState<{ [key: string]: number }>({});
    const [selectedReasonId, setSelectedReasonId] = useState("");
    const [notes, setNotes] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Actions State
    const [currentActions, setCurrentActions] = useState<Record<string, boolean>>({
        [OperationAction.GENERATE_NEW_ORDER_PENDING]: true,
        [OperationAction.REGISTER_NOTE_ON_ORDER]: true
    });
    const [defaultActions, setDefaultActions] = useState<Record<string, boolean>>({});

    // Initialize loaded items with full quantity
    useEffect(() => {
        if (order?.items) {
            const initial: { [key: string]: number } = {};
            order.items.forEach(item => {
                initial[item.id] = item.quantity;
            });
            setLoadedItems(initial);
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
                    // Try fetching with the code defined in preferences (EXPEDICAO_CARREGADO_PARCIAL)
                    // If the user insisted on CARREGAMENTO_PARCIAL, we might need to change this logic or update the types in Settings.
                    // For now, sticking to consistency with Settings.
                    const data = await getSystemReasons(supabase, 'EXPEDICAO_CARREGADO_PARCIAL');

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
                        // Validation: Use empty list to force specific error handling or allow "Other" fallback only?
                        // Providing "Other" manual fallback if backend fails
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
                [OperationAction.GENERATE_NEW_ORDER_PENDING]: true,
                [OperationAction.REGISTER_NOTE_ON_ORDER]: true
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
            // Map defaults to standard actions
            // create_complement_order -> GENERATE_NEW_ORDER_PENDING
            // write_internal_notes -> REGISTER_NOTE_ON_ORDER

            const defaults = {
                [OperationAction.GENERATE_NEW_ORDER_PENDING]: reason.defaults.create_complement_order ?? true,
                [OperationAction.REGISTER_NOTE_ON_ORDER]: reason.defaults.write_internal_notes ?? true
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
        setLoadedItems(prev => ({ ...prev, [itemId]: num }));
    };

    const handleSubmit = async () => {
        // Allow submission without reason ONLY if fallback allows it or specific error handling
        if (!selectedReasonId && selectedReasonId !== 'other') return;

        // Validations...
        let hasError = false;
        order.items?.forEach(item => {
            const loaded = loadedItems[item.id] ?? item.quantity;
            if (loaded > item.quantity) hasError = true;
        });

        if (hasError) {
            toast({ title: "Erro de Quantidade", description: "Qtd carregada > pedida.", variant: "destructive" });
            return;
        }

        const hasPending = order.items?.some(item => {
            const loaded = loadedItems[item.id] ?? item.quantity;
            return loaded < item.quantity;
        });

        if (!hasPending) {
            toast({ title: "Atenção", description: "Nenhum saldo pendente.", variant: "destructive" });
            return;
        }

        const selectedReason = reasons.find(r => r.id === selectedReasonId);
        if (selectedReason?.defaults?.require_note && !notes.trim()) {
            toast({ title: "Erro", description: "Observação obrigatória.", variant: "destructive" });
            return;
        }

        setIsSubmitting(true);
        try {
            const finalReasonLabel = selectedReason?.label || "Outro";

            const payloadItems = Object.entries(loadedItems).map(([itemId, loadedQty]) => {
                const item = order.items?.find(i => i.id === itemId);
                const qtyOrdered = item ? item.quantity : 0;
                return {
                    itemId,
                    loadedQty,
                    product_id: item?.product?.id,
                    qty_ordered: qtyOrdered,
                    qty_loaded: loadedQty,
                    qty_remaining: qtyOrdered - loadedQty
                };
            });

            const details = {
                kind: "EXPEDICAO_CARREGADO_PARCIAL",
                reason_id: selectedReasonId === 'other' ? null : selectedReasonId,
                reason_label: finalReasonLabel,
                observations: notes,
                items: payloadItems,
                actions: {
                    create_complement_order: currentActions[OperationAction.GENERATE_NEW_ORDER_PENDING],
                    register_notes: currentActions[OperationAction.REGISTER_NOTE_ON_ORDER]
                }
            };

            await onConfirm(payloadItems, finalReasonLabel, details);
            onClose();
        } catch (error) {
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const hasPendingItems = order.items?.some(item => {
        const loaded = loadedItems[item.id] || 0;
        return loaded < item.quantity;
    });

    const hasInvalidItems = order.items?.some(item => {
        const loaded = loadedItems[item.id] ?? item.quantity;
        return loaded > item.quantity;
    });

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-3xl h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Carregamento Parcial (Rascunho)</DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto space-y-4 py-2">
                    {/* Items List */}
                    <div className="border rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 border-b">
                                <tr>
                                    <th className="px-3 py-1.5 text-left font-medium text-gray-600">Produto</th>
                                    <th className="px-3 py-1.5 text-center font-medium text-gray-600">Qtd. Pedido</th>
                                    <th className="px-3 py-1.5 text-center font-medium text-gray-600 w-28">Qtd. Carregada</th>
                                    <th className="px-3 py-1.5 text-center font-medium text-gray-600">Saldo</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {order.items?.map(item => {
                                    const loaded = loadedItems[item.id] ?? item.quantity;
                                    const balance = item.quantity - loaded;
                                    const isExcess = loaded > item.quantity;

                                    return (
                                        <tr key={item.id} className={balance > 0 ? "bg-amber-50/30" : ""}>
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
                                                        value={loaded}
                                                        onChange={(e) => handleQtyChange(item.id, e.target.value)}
                                                        min={0}
                                                    />
                                                </div>
                                            </td>
                                            <td className="px-3 py-1.5 text-center">
                                                {balance > 0 ? (
                                                    <span className="text-amber-600 font-bold">{balance}</span>
                                                ) : balance < 0 ? (
                                                    <span className="text-red-500 font-bold">{balance}</span>
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
                                                reasonsError ? "Erro ao carregar motivos. Tente recarregar." :
                                                    "Selecione o motivo..."
                                        } />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {reasons.map((r) => (
                                            <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>
                                        ))}
                                        {/* Always allow fallback 'other' if needed, or if error */}
                                        {(reasonsError || reasons.length === 0) && (
                                            <SelectItem value="other">Outro (Manual)</SelectItem>
                                        )}
                                    </SelectContent>
                                </Select>
                                {reasonsError && (
                                    <p className="text-xs text-red-500">Falha ao carregar motivos. Verifique a conexão.</p>
                                )}
                            </div>

                            <div className="space-y-1.5">
                                <Label>Observações {reasons.find(r => r.id === selectedReasonId)?.defaults?.require_note && <span className="text-red-500">*</span>}</Label>
                                <Textarea
                                    value={notes}
                                    onChange={e => setNotes(e.target.value)}
                                    placeholder="Detalhes adicionais..."
                                    className="resize-none h-24"
                                />
                            </div>
                        </div>

                        <div>
                            <OccurrenceActionsPanel
                                mode="operation"
                                availableActions={[
                                    OperationAction.GENERATE_NEW_ORDER_PENDING,
                                    OperationAction.REGISTER_NOTE_ON_ORDER
                                ]}
                                currentActions={currentActions}
                                defaultActions={defaultActions}
                                onChange={handleActionChange}
                                customLabels={{
                                    [OperationAction.GENERATE_NEW_ORDER_PENDING]: "Gerar pedido complementar (saldo)"
                                }}
                            />
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Cancelar</Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={isSubmitting || !selectedReasonId || hasInvalidItems || !hasPendingItems}
                        className={hasPendingItems ? "bg-amber-600 hover:bg-amber-700 text-white" : ""}
                    >
                        {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Confirmar Parcial
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
