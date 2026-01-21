"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select-shadcn';
import { Label } from '@/components/ui/Label';
import { createClient } from "@/utils/supabase/client";
import { getSystemReasons } from "@/lib/data/system-preferences";
import { SystemOccurrenceReasonWithDefaults } from "@/types/system-preferences";

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
    const [deliveryData, setDeliveryData] = useState<any>(null);
    const [isLoadingDelivery, setIsLoadingDelivery] = useState(false);

    // Form State
    const [deliveredItems, setDeliveredItems] = useState<{ [key: string]: number }>({});
    const [selectedReasonId, setSelectedReasonId] = useState("");
    const [notes, setNotes] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Fetch delivery data when modal opens
    useEffect(() => {
        if (isOpen && (order?.sales_document_id || order?.sales_order?.id)) {
            const salesDocId = order?.sales_document_id || order?.sales_order?.id;
            setIsLoadingDelivery(true);

            fetch(`/api/sales-documents/${salesDocId}/deliveries`)
                .then(res => res.json())
                .then(data => {
                    // Find the latest in_route delivery
                    const activeDelivery = data?.find((d: any) => d.status === 'in_route');
                    setDeliveryData(activeDelivery);

                    // Initialize delivered items with qty_loaded from delivery
                    if (activeDelivery?.items) {
                        const initial: { [key: string]: number } = {};
                        activeDelivery.items.forEach((dItem: any) => {
                            initial[dItem.sales_document_item_id] = dItem.qty_loaded || 0;
                        });
                        setDeliveredItems(initial);
                    }
                })
                .catch(err => {
                    console.error('Failed to fetch delivery data:', err);
                    // Fallback to order quantities
                    const items = order?.items || order?.sales_order?.items;
                    if (items) {
                        const initial: { [key: string]: number } = {};
                        items.forEach((item: any) => {
                            initial[item.id] = item.quantity;
                        });
                        setDeliveredItems(initial);
                    }
                })
                .finally(() => setIsLoadingDelivery(false));
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

            return () => { isMounted = false; };
        }
    }, [isOpen, supabase]);

    const handleQtyChange = (itemId: string, val: string) => {
        const num = parseFloat(val);
        if (isNaN(num) || num < 0) return;
        setDeliveredItems(prev => ({ ...prev, [itemId]: num }));
    };

    const handleSubmit = async () => {
        if (!selectedReasonId && selectedReasonId !== 'other') return;

        const items = order?.items || order?.sales_order?.items || [];

        // Validation: delivered must be <= loaded
        let hasError = false;
        items.forEach((item: any) => {
            const deliveryItem = deliveryData?.items?.find((di: any) => di.sales_document_item_id === item.id);
            const qtyLoaded = deliveryItem?.qty_loaded || item.quantity;
            const delivered = deliveredItems[item.id] ?? qtyLoaded;

            if (delivered > qtyLoaded) {
                hasError = true;
            }
        });

        if (hasError) {
            toast({
                title: "Erro de Quantidade",
                description: "Qtd. entregue não pode ser maior que a qtd. carregada.",
                variant: "destructive"
            });
            return;
        }

        const selectedReason = reasons.find(r => r.id === selectedReasonId);
        const isOther = selectedReasonId === 'other';

        if (selectedReason?.defaults?.require_note && !notes.trim()) {
            toast({
                title: "Observação Obrigatória",
                description: `O motivo "${selectedReason.label}" exige observação.`,
                variant: "destructive"
            });
            return;
        }
        if (isOther && !notes.trim()) {
            toast({
                title: "Observação Obrigatória",
                description: "Para 'Outro', a observação é obrigatória.",
                variant: "destructive"
            });
            return;
        }

        setIsSubmitting(true);
        try {
            const finalReasonLabel = isOther ? "Outro" : selectedReason?.label || "Desconhecido";

            const payloadItems = items.map((item: any) => {
                const deliveryItem = deliveryData?.items?.find((di: any) => di.sales_document_item_id === item.id);
                const qtyLoaded = deliveryItem?.qty_loaded || item.quantity;
                const deliveredQty = deliveredItems[item.id] ?? qtyLoaded;

                return {
                    itemId: item.id,
                    deliveredQty,
                    product_id: item.product?.id,
                    qty_loaded: qtyLoaded,
                    qty_original: item.quantity,
                };
            });

            const simplifiedItems = payloadItems.map((pi: any) => ({
                itemId: pi.itemId,
                deliveredQty: pi.deliveredQty
            }));

            const details = {
                kind: "RETORNO_ENTREGA_PARCIAL",
                reason_id: isOther ? null : selectedReasonId,
                reason_label: finalReasonLabel,
                observations: notes,
                items: payloadItems,
                deliveredItems: simplifiedItems, // Add this field for finish-return API
                delivery_id: deliveryData?.id
            };

            await onConfirm(simplifiedItems, finalReasonLabel, details);
            onClose();
        } catch (error) {
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const items = order?.items || order?.sales_order?.items || [];
    const selectedReason = reasons.find(r => r.id === selectedReasonId);

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Registrar Entrega Parcial</DialogTitle>
                    <p className="text-sm text-gray-500">
                        Informe o motivo e as quantidades efetivamente entregues.
                    </p>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto space-y-4 py-2 px-1">
                    <div className="space-y-1.5">
                        <Label>Motivo <span className="text-red-500">*</span></Label>
                        <Select value={selectedReasonId} onValueChange={setSelectedReasonId} disabled={isLoadingReasons}>
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
                        <Label>Observação {selectedReason?.defaults?.require_note && <span className="text-red-500">*</span>}</Label>
                        <Textarea
                            placeholder="Detalhes adicionais..."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="resize-none h-16"
                        />
                    </div>

                    {/* Items List */}
                    <div>
                        <h3 className="text-sm font-semibold text-gray-700 mb-2">Itens do Pedido</h3>
                        <div className="border rounded-lg overflow-hidden">
                            {isLoadingDelivery ? (
                                <div className="p-8 flex justify-center">
                                    <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                                </div>
                            ) : (
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50 border-b">
                                        <tr>
                                            <th className="px-3 py-2 text-left font-medium text-gray-600">Produto</th>
                                            <th className="px-3 py-2 text-center font-medium text-gray-600 w-24">Solicitado</th>
                                            <th className="px-3 py-2 text-center font-medium text-gray-600 w-24">Carregado</th>
                                            <th className="px-3 py-2 text-center font-medium text-gray-600 w-32">Entregue</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {items.map((item: any) => {
                                            const deliveryItem = deliveryData?.items?.find((di: any) => di.sales_document_item_id === item.id);
                                            const qtyLoaded = deliveryItem?.qty_loaded || item.quantity;
                                            const delivered = deliveredItems[item.id] ?? qtyLoaded;
                                            const isExcess = delivered > qtyLoaded;

                                            return (
                                                <tr key={item.id} className="hover:bg-gray-50">
                                                    <td className="px-3 py-2">
                                                        <div className="font-medium text-gray-900">{item.product?.name}</div>
                                                        <div className="text-xs text-gray-500">{item.product?.sku}</div>
                                                    </td>
                                                    <td className="px-3 py-2 text-center text-gray-700">
                                                        {item.quantity} {item.packaging?.label || 'un'}
                                                    </td>
                                                    <td className="px-3 py-2 text-center font-semibold text-blue-600">{qtyLoaded}</td>
                                                    <td className="px-3 py-2">
                                                        <div className="flex justify-center">
                                                            <Input
                                                                type="number"
                                                                className={`w-20 text-center h-8 text-sm ${isExcess ? "border-red-500 text-red-600 focus-visible:ring-red-500" : ""}`}
                                                                value={delivered}
                                                                onChange={(e) => handleQtyChange(item.id, e.target.value)}
                                                                min={0}
                                                                max={qtyLoaded}
                                                            />
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Cancelar</Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={!selectedReasonId || isSubmitting || isLoadingDelivery}
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                        {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Confirmar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
