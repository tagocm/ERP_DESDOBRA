"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { useToast } from "@/components/ui/use-toast";
import { createClient } from "@/lib/supabaseBrowser";
import { inventoryService } from "@/lib/inventory-service";
import { Loader2 } from "lucide-react";
import { Textarea } from "@/components/ui/Textarea";

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    type: 'ENTRADA' | 'SAIDA' | 'AJUSTE' | null;
    onSuccess: () => void;
}

export function InventoryMovementModal({ open, onOpenChange, type, onSuccess }: Props) {
    const [isLoading, setIsLoading] = useState(false);
    const [items, setItems] = useState<any[]>([]);
    const [selectedItem, setSelectedItem] = useState<string>("");
    const [qty, setQty] = useState<string>("");
    const [notes, setNotes] = useState("");
    const { toast } = useToast();
    const supabase = createClient();

    useEffect(() => {
        if (open) {
            fetchItems();
            setQty("");
            setNotes("");
            setSelectedItem("");
        }
    }, [open]);

    const fetchItems = async () => {
        const { data } = await supabase.from('items').select('id, name, sku').eq('type', 'product').order('name');
        if (data) setItems(data);
    };

    const handleSubmit = async () => {
        if (!selectedItem || !qty || !type) return;

        try {
            setIsLoading(true);
            const qtyNum = parseFloat(qty);

            if (isNaN(qtyNum) || qtyNum <= 0) {
                toast({ title: "Erro", description: "Quantidade inválida.", variant: "destructive" });
                return;
            }

            let finalQty = qtyNum;
            // Logic: 
            // ENTRADA: Positive
            // SAIDA: Negative
            // AJUSTE: User defines sign? Usually Adjustment replaces balance or adds delta. 
            // Requirement says: "Para AJUSTE pode ser positivo ou negativo".
            // However, implementing simple Delta Adjustment here.
            // If type is SAIDA, we force negative.

            if (type === 'SAIDA') {
                finalQty = -Math.abs(qtyNum);
            } else if (type === 'ENTRADA') {
                finalQty = Math.abs(qtyNum);
            } else {
                // AJUSTE: assume user enters the delta directly or we could provide a toggle. 
                // For MVP simplicity let's assume if they selected AJUSTE they type the signed value or we provide a toggle "Adicionar / Remover".
                // But typically "Ajuste" button implies fixing.
                // Request said: "Para AJUSTE pode ser positivo ou negativo". 
                // Let's allow negative numbers in input for Adjustment, or standard input is abs and we direct sign?
                // Visual simplicity: If type is adjustment, trust the input sign? 
                // Input type="number" allows negative.
                finalQty = qtyNum;
            }

            await inventoryService.createMovement({
                item_id: selectedItem,
                movement_type: type,
                qty_base: finalQty,
                qty_display: Math.abs(qtyNum), // Display always positive
                reference_type: 'AJUSTE_MANUAL',
                notes: notes,
                occurred_at: new Date().toISOString()
            });

            toast({ title: "Sucesso", description: "Movimentação registrada." });
            onSuccess();
            onOpenChange(false);
        } catch (error) {
            console.error(error);
            toast({ title: "Erro", description: "Falha ao salvar.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    const getTypeLabel = () => {
        switch (type) {
            case 'ENTRADA': return 'Nova Entrada';
            case 'SAIDA': return 'Nova Saída';
            case 'AJUSTE': return 'Novo Ajuste';
            default: return 'Movimentação';
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>{getTypeLabel()}</DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>Produto</Label>
                        <Select value={selectedItem} onValueChange={setSelectedItem}>
                            <SelectTrigger>
                                <SelectValue placeholder="Selecione um item..." />
                            </SelectTrigger>
                            <SelectContent>
                                {items.map(item => (
                                    <SelectItem key={item.id} value={item.id}>
                                        {item.name} <span className="text-muted-foreground text-xs">({item.sku})</span>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Quantidade</Label>
                            <Input
                                type="number"
                                value={qty}
                                onChange={e => setQty(e.target.value)}
                                placeholder="0.00"
                            />
                            {type === 'SAIDA' && <p className="text-xs text-muted-foreground">Será registrado como negativo.</p>}
                        </div>
                        <div className="space-y-2">
                            <Label>Unidade</Label>
                            <Input value="UNIDADE" disabled />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Observação</Label>
                        <Textarea
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            placeholder="Motivo do ajuste..."
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                    <Button onClick={handleSubmit} disabled={isLoading || !selectedItem || !qty}>
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Confirmar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
