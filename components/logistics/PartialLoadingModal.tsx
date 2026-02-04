"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Label";
import { Textarea } from "@/components/ui/Textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { Card, CardContent } from "@/components/ui/Card";
import { DeliveryReason } from "@/types/reasons";
import { createClient } from "@/lib/supabaseBrowser";
import { getDeliveryReasons } from "@/lib/data/reasons";
import { useToast } from "@/components/ui/use-toast";
import { Loader2 } from "lucide-react";

interface PartialLoadingModalProps {
    isOpen: boolean;
    onClose: () => void;
    order: any;
    companyId: string;
    onSuccess: (payload: any) => void;
}

export function PartialLoadingModal({ isOpen, onClose, order, companyId, onSuccess }: PartialLoadingModalProps) {
    const { toast } = useToast();
    const supabase = createClient();

    const [reasons, setReasons] = useState<DeliveryReason[]>([]);
    const [loadingReasons, setLoadingReasons] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Form State
    const [selectedReasonId, setSelectedReasonId] = useState<string>("");
    const [note, setNote] = useState("");
    const [itemsState, setItemsState] = useState<any[]>([]);

    useEffect(() => {
        if (isOpen && companyId) {
            fetchReasons();
            if (order?.items) {
                setItemsState(order.items.map((item: any) => ({
                    orderItemId: item.id,
                    productName: item.product?.name || 'Produto',
                    packagingLabel: item.packaging?.label,
                    qtyOrdered: item.balance !== undefined ? item.balance : item.quantity,
                    qtyLoaded: item.balance !== undefined ? item.balance : item.quantity
                })));
            }
            setSelectedReasonId("");
            setNote("");
        }
    }, [isOpen, companyId, order]);

    const fetchReasons = async () => {
        setLoadingReasons(true);
        try {
            const data = await getDeliveryReasons(supabase, companyId, 'EXPEDICAO_CARREGADO_PARCIAL');
            setReasons(data);
        } catch (error) {
            console.error(error);
            toast({ title: "Erro", description: "Falha ao carregar motivos.", variant: "destructive" });
        } finally {
            setLoadingReasons(false);
        }
    };

    const handleQuantityChange = (orderItemId: string, newValue: string) => {
        const val = parseFloat(newValue);
        if (isNaN(val)) return;

        setItemsState(prev => prev.map(item =>
            item.orderItemId === orderItemId
                ? { ...item, qtyLoaded: val }
                : item
        ));
    };

    const handleConfirm = async () => {
        if (!selectedReasonId) {
            toast({ title: "Selecione um motivo", variant: "destructive" });
            return;
        }

        const reason = reasons.find(r => r.id === selectedReasonId);
        if (reason?.require_note && !note.trim()) {
            toast({ title: "Observação obrigatória", description: "Este motivo exige uma observação.", variant: "destructive" });
            return;
        }

        const invalidItem = itemsState.find(item => item.qtyLoaded > item.qtyOrdered || item.qtyLoaded < 0);
        if (invalidItem) {
            toast({ title: "Quantidade inválida", description: `Verifique o item ${invalidItem.productName}.`, variant: "destructive" });
            return;
        }

        const payload = {
            reasonId: selectedReasonId,
            reasonName: reason?.name || 'Motivo',
            note,
            items: itemsState.map(i => ({
                orderItemId: i.orderItemId,
                qtyOrdered: i.qtyOrdered,
                qtyLoaded: i.qtyLoaded
            }))
        };

        onSuccess(payload);
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>Registrar Carregamento Parcial</DialogTitle>
                    <DialogDescription>
                        Informe o motivo e as quantidades efetivamente carregadas.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    <div className="space-y-2">
                        <Label>Motivo</Label>
                        <Select value={selectedReasonId} onValueChange={setSelectedReasonId} disabled={loadingReasons}>
                            <SelectTrigger>
                                <SelectValue placeholder="Selecione o motivo..." />
                            </SelectTrigger>
                            <SelectContent>
                                {reasons.map(r => (
                                    <SelectItem key={r.id} value={r.id}>
                                        {r.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Observação {reasons.find(r => r.id === selectedReasonId)?.require_note && <span className="text-red-500">*</span>}</Label>
                        <Textarea
                            value={note}
                            onChange={e => setNote(e.target.value)}
                            placeholder="Detalhes adicionais..."
                            className="h-20 resize-none"
                        />
                    </div>

                    <div className="space-y-3 pt-2">
                        <Label>Itens do Pedido</Label>
                        <div className="bg-gray-50 border rounded-2xl p-3 space-y-3 max-h-72 overflow-y-auto">
                            {itemsState.map(item => (
                                <Card key={item.orderItemId}>
                                    <CardContent className="p-2 flex items-center justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-gray-900 truncate" title={item.productName}>
                                                {item.productName}
                                            </p>
                                            <p className="text-xs text-gray-500">
                                                Saldo Pendente: <span className="font-semibold">{item.qtyOrdered} {item.packagingLabel || 'un'}</span>
                                            </p>
                                        </div>
                                        <div className="w-24">
                                            <label className="text-[10px] text-gray-500 uppercase font-bold text-center block mb-1">Carregado</label>
                                            <Input
                                                type="number"
                                                value={item.qtyLoaded}
                                                onChange={e => handleQuantityChange(item.orderItemId, e.target.value)}
                                                className="h-8 text-center"
                                                min={0}
                                                max={item.qtyOrdered}
                                            />
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={submitting}>
                        Cancelar
                    </Button>
                    <Button onClick={handleConfirm} disabled={submitting}>
                        {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Confirmar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
