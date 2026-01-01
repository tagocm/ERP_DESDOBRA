import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select-shadcn';
import { Label } from '@/components/ui/Label';
import { Textarea } from '@/components/ui/Textarea';
import { Switch } from '@/components/ui/Switch';

interface DeliveredModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (reason: string, notes?: string) => void;
    order: any;
}

const REASONS = [
    { value: 'normal', label: 'Entregue normalmente' },
    { value: 'third_party', label: 'Recebido por terceiro' },
    { value: 'off_hours', label: 'Entrega fora do horário' },
    { value: 'with_notes', label: 'Entregue com ressalva (avaria)' },
    { value: 'other', label: 'Outro' }
];

export function DeliveredModal({ isOpen, onClose, onConfirm, order }: DeliveredModalProps) {
    const [reason, setReason] = useState<string>('');
    const [notes, setNotes] = useState<string>('');

    const handleSubmit = () => {
        const selectedLabel = reason ? (REASONS.find(r => r.value === reason)?.label || reason) : '';
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
                    <DialogTitle>Confirmar Entrega</DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <p className="text-sm text-gray-500">
                        Confirmar entrega do pedido <strong>#{order?.sales_order?.document_number || order?.document_number}</strong>?
                    </p>

                    <div className="space-y-2">
                        <Label>Motivo (Opcional)</Label>
                        <Select value={reason} onValueChange={setReason}>
                            <SelectTrigger>
                                <SelectValue placeholder="Entregue normalmente" />
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

                    {(reason === 'other' || reason === 'with_notes') && (
                        <div className="space-y-2">
                            <Label>Observação</Label>
                            <Textarea
                                placeholder="Detalhes..."
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                className="h-20"
                            />
                        </div>
                    )}

                    {/* Toggle */}
                    <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 flex items-center justify-between gap-2 mt-2">
                        <Label className="text-xs text-gray-700 font-medium">Confirmar entrega no pedido</Label>
                        <Switch checked={true} disabled aria-readonly />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={handleClose}>Cancelar</Button>
                    <Button
                        onClick={handleSubmit}
                        className="bg-green-600 hover:bg-green-700 text-white"
                    >
                        Confirmar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
