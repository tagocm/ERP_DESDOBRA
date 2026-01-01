import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select-shadcn';
import { Label } from '@/components/ui/Label';
import { Textarea } from '@/components/ui/Textarea';

interface TotalReturnModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (reason: string, notes?: string) => void;
    order: any;
}

const REASONS = [
    { value: 'client_refused', label: 'Cliente recusou receber' },
    { value: 'quality_issue', label: 'Problema de qualidade' },
    { value: 'wrong_product', label: 'Produto incorreto' },
    { value: 'damaged', label: 'Produto avariado' },
    { value: 'client_absent', label: 'Cliente ausente (devolução programada)' },
    { value: 'other', label: 'Outro' }
];

export function TotalReturnModal({ isOpen, onClose, onConfirm, order }: TotalReturnModalProps) {
    const [reason, setReason] = useState<string>('');
    const [notes, setNotes] = useState<string>('');

    const handleSubmit = () => {
        if (!reason) return;
        const selectedLabel = REASONS.find(r => r.value === reason)?.label || reason;
        const finalReason = reason === 'other' ? (notes ? `${selectedLabel}: ${notes}` : selectedLabel) : selectedLabel;
        onConfirm(finalReason, notes);
        // Reset state
        setReason('');
        setNotes('');
        onClose();
    };

    const handleClose = () => {
        setReason('');
        setNotes('');
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Devolução Total</DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <p className="text-sm text-gray-500">
                        O pedido <strong>#{order?.sales_order?.document_number || order?.document_number}</strong> foi devolvido totalmente. Informe o motivo para que o pedido retorne à Sandbox.
                    </p>

                    <div className="space-y-2">
                        <Label>Motivo <span className="text-red-500">*</span></Label>
                        <Select value={reason} onValueChange={setReason}>
                            <SelectTrigger>
                                <SelectValue placeholder="Selecione um motivo" />
                            </SelectTrigger>
                            <SelectContent>
                                {REASONS.map((r) => (
                                    <SelectItem key={r.value} value={r.value}>
                                        {r.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {reason === 'other' && (
                        <div className="space-y-2">
                            <Label>Observações</Label>
                            <Textarea
                                placeholder="Descreva o motivo..."
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                className="h-24"
                            />
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={handleClose}>Cancelar</Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={!reason || (reason === 'other' && !notes.trim())}
                        className="bg-red-700 hover:bg-red-800 text-white"
                    >
                        Confirmar Devolução Total
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
