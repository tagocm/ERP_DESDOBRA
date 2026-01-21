"use client";

import { useCompany } from "@/contexts/CompanyContext";
import { createClient } from "@/lib/supabaseBrowser";
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/Dialog";
import { Label } from "@/components/ui/Label";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/use-toast";
import { Play, Calendar as CalendarIcon, Package, Hash } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface NewProductionEntryModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export function NewProductionEntryModal({ isOpen, onClose, onSuccess }: NewProductionEntryModalProps) {
    const { selectedCompany } = useCompany();
    const supabase = createClient();
    const { toast } = useToast();

    const [isLoading, setIsLoading] = useState(false);
    const [orders, setOrders] = useState<any[]>([]);

    // Form Data
    const [selectedOrderId, setSelectedOrderId] = useState("");
    const [qtyProduced, setQtyProduced] = useState<string>("");
    const [occurredAt, setOccurredAt] = useState<string>(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
    const [notes, setNotes] = useState("");

    useEffect(() => {
        if (isOpen && selectedCompany) {
            fetchActiveOrders();
            // Reset form
            setQtyProduced("");
            setOccurredAt(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
            setNotes("");
            setSelectedOrderId("");
        }
    }, [isOpen, selectedCompany]);

    const fetchActiveOrders = async () => {
        const { data, error } = await supabase
            .from('work_orders')
            .select(`
                id,
                planned_qty,
                produced_qty,
                status,
                created_at,
                item:items (id, name, uom)
            `)
            .eq('company_id', selectedCompany!.id)
            .is('deleted_at', null)
            .in('status', ['planned', 'in_progress'])
            .order('created_at', { ascending: false });

        if (data) {
            const mappedData = data.map((o: any) => ({
                ...o,
                item: Array.isArray(o.item) ? o.item[0] : o.item
            }));
            setOrders(mappedData);
        }
    };

    const handleSubmit = async () => {
        if (!selectedOrderId || !qtyProduced || Number(qtyProduced) <= 0) {
            toast({ title: "Inválido", description: "Selecione uma OP e informe a quantidade.", variant: "destructive" });
            return;
        }

        setIsLoading(true);
        try {
            const { error } = await supabase.rpc('register_production_entry', {
                p_work_order_id: selectedOrderId,
                p_qty_produced: Number(qtyProduced),
                p_occurred_at: new Date(occurredAt || new Date()).toISOString(),
                p_notes: notes || null
            });

            if (error) throw error;

            // Validação pós-RPC: garantir que movimentos foram criados
            const { count: movementCount, error: countError } = await supabase
                .from('inventory_movements')
                .select('*', { count: 'exact', head: true })
                .eq('reference_type', 'WORK_ORDER')
                .eq('reference_id', selectedOrderId)
                .gte('created_at', new Date(Date.now() - 10000).toISOString()); // últimos 10s

            if (countError) {
                console.error('Movement validation error:', countError);
            } else if (movementCount === 0) {
                throw new Error("Movimento de estoque não foi registrado. A transação pode ter sido interrompida. Contate o suporte.");
            }

            toast({ title: "Sucesso", description: "Apontamento registrado com sucesso.", variant: "default" }); // Standard success variant is 'default' or a custom one if configured, using default for safety or success if available.
            onSuccess();
            onClose();

        } catch (error: any) {
            console.error("Error registering production:", error);
            toast({
                title: "Erro no Apontamento",
                description: error.message || "Falha ao registrar produção.",
                variant: "destructive"
            });
        } finally {
            setIsLoading(false);
        }
    };

    const selectedOrder = orders.find(o => o.id === selectedOrderId);

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-xl">
                <DialogHeader>
                    <DialogTitle>Novo Apontamento de Produção</DialogTitle>
                    <DialogDescription>
                        Registre a produção concluída para uma Ordem de Produção (OP).
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {/* Work Order Selection */}
                    <div className="space-y-2">
                        <Label>Selecione a Ordem de Produção</Label>
                        <Select value={selectedOrderId} onValueChange={setSelectedOrderId}>
                            <SelectTrigger className="h-12">
                                <SelectValue placeholder="Selecione a OP..." />
                            </SelectTrigger>
                            <SelectContent className="max-h-[300px]">
                                {orders.map(order => (
                                    <SelectItem key={order.id} value={order.id}>
                                        <div className="flex flex-col text-left">
                                            <span className="font-medium text-gray-900 line-clamp-1">
                                                ID #{order.id.slice(0, 8)} • {order.item?.name}
                                            </span>
                                            <span className="text-xs text-gray-500">
                                                Status: {order.status === 'planned' ? 'Planejada' : 'Em Produção'} •
                                                Produzido: {order.produced_qty} / {order.planned_qty} {order.item?.uom}
                                            </span>
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {selectedOrder && (
                        <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-4 flex gap-4 items-center">
                            <div className="bg-white p-2 rounded-md border border-blue-100 shadow-sm">
                                <Package className="w-5 h-5 text-blue-600" />
                            </div>
                            <div className="flex-1">
                                <h4 className="font-medium text-blue-900 text-sm">{selectedOrder.item?.name}</h4>
                                <div className="flex gap-4 mt-1 text-xs text-blue-700">
                                    <span className="flex items-center gap-1">
                                        <Hash className="w-3 h-3" />
                                        OP: {selectedOrder.id.slice(0, 8)}
                                    </span>
                                    <span>
                                        Meta: <strong>{selectedOrder.planned_qty} {selectedOrder.item?.uom}</strong>
                                    </span>
                                    <span>
                                        Atual: <strong>{selectedOrder.produced_qty} {selectedOrder.item?.uom}</strong>
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Qtd. Produzida</Label>
                            <div className="relative">
                                <Input
                                    type="number"
                                    min={0}
                                    step="0.0001"
                                    placeholder="0.00"
                                    className="pl-4 text-lg font-medium"
                                    value={qtyProduced}
                                    onChange={e => setQtyProduced(e.target.value)}
                                />
                                {selectedOrder && (
                                    <span className="absolute right-3 top-3 text-sm text-gray-400 font-medium">
                                        {selectedOrder.item?.uom}
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Data / Hora</Label>
                            <div className="relative">
                                <Input
                                    type="datetime-local"
                                    value={occurredAt}
                                    onChange={e => setOccurredAt(e.target.value)}
                                    className="pl-9"
                                />
                                <CalendarIcon className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Observações</Label>
                        <Textarea
                            placeholder="Comentários sobre este lote ou turno..."
                            className="h-20 resize-none"
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Cancelar</Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={isLoading || !selectedOrderId || !qtyProduced}
                        className="bg-brand-600 hover:bg-brand-700 text-white"
                    >
                        {isLoading && <Play className="w-4 h-4 mr-2 animate-spin" />}
                        Confirmar Apontamento
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
