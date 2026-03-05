"use client";

import { useCompany } from "@/contexts/CompanyContext";
import { createClient } from "@/lib/supabaseBrowser";
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/Dialog";
import { Label } from "@/components/ui/Label";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/use-toast";
import { Play, Calendar as CalendarIcon, Package, Hash } from "lucide-react";
import { format } from "date-fns";

interface NewProductionEntryModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

type DivergenceType = "PARTIAL_EXECUTION" | "LOW_YIELD";

interface WorkOrderItemSummary {
    id: string;
    name: string;
    uom: string;
}

interface WorkOrderSummary {
    id: string;
    document_number: number | null;
    planned_qty: number;
    produced_qty: number;
    status: "planned" | "in_progress" | "done" | "cancelled";
    created_at: string;
    item: WorkOrderItemSummary | null;
}

interface WorkOrderResponseRow {
    id: string;
    document_number: number | null;
    planned_qty: number;
    produced_qty: number;
    status: "planned" | "in_progress" | "done" | "cancelled";
    created_at: string;
    item: WorkOrderItemSummary | WorkOrderItemSummary[] | null;
}

interface EntryApiSuccessResponse {
    posting?: {
        expected_output_qty?: number;
        loss_qty?: number;
    };
}

interface EntryApiErrorResponse {
    error?: string;
}

function isDivergenceType(value: string): value is DivergenceType {
    return value === "PARTIAL_EXECUTION" || value === "LOW_YIELD";
}

export function NewProductionEntryModal({ isOpen, onClose, onSuccess }: NewProductionEntryModalProps) {
    const { selectedCompany } = useCompany();
    const supabase = createClient();
    const { toast } = useToast();

    const [isLoading, setIsLoading] = useState(false);
    const [orders, setOrders] = useState<WorkOrderSummary[]>([]);

    // Form Data
    const [selectedOrderId, setSelectedOrderId] = useState("");
    const [qtyProduced, setQtyProduced] = useState<string>("");
    const [executedBatches, setExecutedBatches] = useState<string>("");
    const [divergenceType, setDivergenceType] = useState<DivergenceType>("PARTIAL_EXECUTION");
    const [occurredAt, setOccurredAt] = useState<string>(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
    const [notes, setNotes] = useState("");

    useEffect(() => {
        if (isOpen && selectedCompany) {
            fetchActiveOrders();
            // Reset form
            setQtyProduced("");
            setExecutedBatches("");
            setDivergenceType("PARTIAL_EXECUTION");
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
                document_number,
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

        if (error) {
            toast({
                title: "Erro",
                description: `Falha ao carregar OPs: ${error.message}`,
                variant: "destructive",
            });
            return;
        }

        if (data) {
            const mappedData = (data as WorkOrderResponseRow[]).map((order) => ({
                id: order.id,
                document_number: order.document_number ?? null,
                planned_qty: Number(order.planned_qty ?? 0),
                produced_qty: Number(order.produced_qty ?? 0),
                status: order.status,
                created_at: order.created_at,
                item: Array.isArray(order.item) ? order.item[0] ?? null : order.item,
            }));
            setOrders(mappedData);
        }
    };

    const handleSubmit = async () => {
        if (!selectedOrderId || !qtyProduced || Number(qtyProduced) <= 0 || !executedBatches || Number(executedBatches) <= 0) {
            toast({ title: "Inválido", description: "Selecione uma OP e informe quantidade produzida e receitas executadas.", variant: "destructive" });
            return;
        }

        setIsLoading(true);
        try {
            const response = await fetch(`/api/work-orders/${selectedOrderId}/entries`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    produced_qty: Number(qtyProduced),
                    executed_batches: Number(executedBatches),
                    divergence_type: divergenceType,
                    occurred_at: new Date(occurredAt || new Date()).toISOString(),
                    notes: notes || undefined,
                })
            });

            if (!response.ok) {
                const payload = (await response.json().catch(() => ({}))) as EntryApiErrorResponse;
                throw new Error(payload.error || "Falha ao registrar apontamento.");
            }

            const payload = (await response.json()) as EntryApiSuccessResponse;
            const expectedOutputQty = payload.posting?.expected_output_qty;
            const lossQty = payload.posting?.loss_qty;

            toast({ title: "Sucesso", description: "Apontamento registrado com sucesso.", variant: "default" }); // Standard success variant is 'default' or a custom one if configured, using default for safety or success if available.
            if (typeof expectedOutputQty === "number" && typeof lossQty === "number" && lossQty > 0) {
                toast({
                    title: "Rendimento abaixo do esperado",
                    description: `Esperado: ${expectedOutputQty.toLocaleString("pt-BR")} • Perda: ${lossQty.toLocaleString("pt-BR")}`,
                    variant: "default",
                });
            }
            onSuccess();
            onClose();

        } catch (error: unknown) {
            console.error("Error registering production:", error);
            const message = error instanceof Error ? error.message : "Falha ao registrar produção.";
            toast({
                title: "Erro no Apontamento",
                description: message,
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
                            <SelectContent className="max-h-72">
                                {orders.map(order => (
                                    <SelectItem key={order.id} value={order.id}>
                                        <div className="flex flex-col text-left">
                                            <span className="font-medium text-gray-900 line-clamp-1">
                                                OP #{order.document_number ?? order.id.slice(0, 8)} • {order.item?.name}
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
                        <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-4 flex gap-4 items-center">
                            <Card className="p-2 border-blue-100 bg-white">
                                <Package className="w-5 h-5 text-blue-600" />
                            </Card>
                            <div className="flex-1">
                                <h4 className="font-medium text-blue-900 text-sm">{selectedOrder.item?.name}</h4>
                                <div className="flex gap-4 mt-1 text-xs text-blue-700">
                                    <span className="flex items-center gap-1">
                                        <Hash className="w-3 h-3" />
                                        OP: {selectedOrder.document_number ?? selectedOrder.id.slice(0, 8)}
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
                            <Label>Receitas Executadas</Label>
                            <Input
                                type="number"
                                min={1}
                                step="1"
                                placeholder="1"
                                value={executedBatches}
                                onChange={e => setExecutedBatches(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Tipo de Divergência</Label>
                            <Select
                                value={divergenceType}
                                onValueChange={(value) => {
                                    if (isDivergenceType(value)) setDivergenceType(value);
                                }}
                            >
                                <SelectTrigger className="h-12">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="PARTIAL_EXECUTION">Execução Parcial</SelectItem>
                                    <SelectItem value="LOW_YIELD">Rendimento Menor</SelectItem>
                                </SelectContent>
                            </Select>
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
                        disabled={isLoading || !selectedOrderId || !qtyProduced || !executedBatches}
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
