import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Label";
import { Input } from "@/components/ui/Input";
import { Switch } from "@/components/ui/Switch";
import { useState, useEffect } from "react";
import { SystemOccurrenceReasonWithDefaults, SystemOccurrenceReasonDefault } from "@/types/system-preferences";
import { createClient } from "@/lib/supabaseBrowser";
import { upsertSystemReason } from "@/lib/data/system-preferences";
import { useToast } from "@/components/ui/use-toast";
import { OccurrenceActionsPanel, OperationAction } from "@/components/settings/system/OccurrenceActionsPanel";

interface ReasonModalProps {
    isOpen: boolean;
    onClose: () => void;
    typeCode: string;
    typeLabel: string;
    editingReason?: SystemOccurrenceReasonWithDefaults | null;
    onSuccess: () => void;
}

const DEFAULT_VALUES: Partial<SystemOccurrenceReasonDefault> = {
    require_note: false,
    allow_override: true,
    return_to_sandbox_pending: false,
    register_attempt_note: false,
    reverse_stock_and_finance: false,
    create_devolution: false,
    create_new_order_for_pending: false,
    create_complement_order: false,
    write_internal_notes: false,
};

export function ReasonModal({ isOpen, onClose, typeCode, typeLabel, editingReason, onSuccess }: ReasonModalProps) {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [label, setLabel] = useState("");
    const [active, setActive] = useState(true);
    const [defaults, setDefaults] = useState<Partial<SystemOccurrenceReasonDefault>>(DEFAULT_VALUES);

    useEffect(() => {
        if (isOpen) {
            if (editingReason) {
                setLabel(editingReason.label);
                setActive(editingReason.active);
                setDefaults({
                    ...DEFAULT_VALUES,
                    ...(editingReason.defaults || {})
                });
            } else {
                setLabel("");
                setActive(true);
                setDefaults(DEFAULT_VALUES);
            }
        }
    }, [isOpen, editingReason]);

    const handleSave = async () => {
        if (!label.trim()) {
            toast({ title: "Erro", description: "O nome do motivo é obrigatório.", variant: "destructive" });
            return;
        }

        setIsLoading(true);
        try {
            const supabase = createClient();

            await upsertSystemReason(
                supabase,
                {
                    id: editingReason?.id,
                    type_code: typeCode,
                    label,
                    active
                },
                defaults
            );

            toast({ title: "Sucesso", description: "Motivo salvo com sucesso!" });
            onSuccess();
            onClose();
        } catch (error: any) {
            console.error(error);
            toast({ title: "Erro", description: "Erro ao salvar motivo.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    const handleToggle = (key: keyof SystemOccurrenceReasonDefault, value: boolean) => {
        setDefaults(prev => ({ ...prev, [key]: value }));
    };

    // Determine relevant toggles based on typeCode
    const isExpeditionNotLoaded = typeCode === 'EXPEDICAO_NAO_CARREGADO';
    const isExpeditionPartial = typeCode === 'EXPEDICAO_CARREGADO_PARCIAL';
    const isReturnNotDelivered = typeCode.includes('NAO_ENTREGUE') || typeCode.includes('DEVOLVIDO_TOTAL');
    const isReturnPartial = typeCode.includes('PARCIAL') && !typeCode.includes('CARREGADO');

    // Get available actions
    let availableActions: OperationAction[] = [];
    if (isExpeditionNotLoaded) {
        availableActions = [OperationAction.RETURN_TO_SANDBOX_PENDING, OperationAction.REGISTER_NOTE_ON_ORDER];
    } else if (isReturnNotDelivered) {
        availableActions = [OperationAction.RETURN_TO_SANDBOX_PENDING, OperationAction.GENERATE_RETURN_MOVEMENT];
    } else if (isExpeditionPartial) {
        // Map create_complement_order to GENERATE_NEW_ORDER_PENDING for consistency in UI
        availableActions = [OperationAction.GENERATE_NEW_ORDER_PENDING, OperationAction.REGISTER_NOTE_ON_ORDER];
    } else if (isReturnPartial) {
        availableActions = [OperationAction.GENERATE_RETURN_MOVEMENT, OperationAction.GENERATE_NEW_ORDER_PENDING];
    }

    // Map defaults to currentActions
    const currentActions: Record<string, boolean> = {};
    if (isExpeditionNotLoaded) {
        currentActions[OperationAction.RETURN_TO_SANDBOX_PENDING] = defaults.return_to_sandbox_pending || false;
        currentActions[OperationAction.REGISTER_NOTE_ON_ORDER] = defaults.register_attempt_note || false;
    } else if (isReturnNotDelivered) {
        currentActions[OperationAction.RETURN_TO_SANDBOX_PENDING] = defaults.return_to_sandbox_pending || false;
        currentActions[OperationAction.GENERATE_RETURN_MOVEMENT] = defaults.create_devolution || false;
    } else if (isExpeditionPartial) {
        currentActions[OperationAction.GENERATE_NEW_ORDER_PENDING] = defaults.create_complement_order || false;
        currentActions[OperationAction.REGISTER_NOTE_ON_ORDER] = defaults.write_internal_notes || false;
    } else if (isReturnPartial) {
        currentActions[OperationAction.GENERATE_RETURN_MOVEMENT] = defaults.create_devolution || false;
        currentActions[OperationAction.GENERATE_NEW_ORDER_PENDING] = defaults.create_new_order_for_pending || false;
    }

    const handleActionChange = (action: OperationAction, value: boolean) => {
        // Update specific default keys based on action and context
        if (isExpeditionNotLoaded) {
            if (action === OperationAction.RETURN_TO_SANDBOX_PENDING) handleToggle('return_to_sandbox_pending', value);
            if (action === OperationAction.REGISTER_NOTE_ON_ORDER) handleToggle('register_attempt_note', value);
        } else if (isReturnNotDelivered) {
            if (action === OperationAction.RETURN_TO_SANDBOX_PENDING) handleToggle('return_to_sandbox_pending', value);
            if (action === OperationAction.GENERATE_RETURN_MOVEMENT) handleToggle('create_devolution', value);
        } else if (isExpeditionPartial) {
            if (action === OperationAction.GENERATE_NEW_ORDER_PENDING) handleToggle('create_complement_order', value);
            if (action === OperationAction.REGISTER_NOTE_ON_ORDER) handleToggle('write_internal_notes', value);
        } else if (isReturnPartial) {
            if (action === OperationAction.GENERATE_RETURN_MOVEMENT) handleToggle('create_devolution', value);
            if (action === OperationAction.GENERATE_NEW_ORDER_PENDING) handleToggle('create_new_order_for_pending', value);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{editingReason ? 'Editar Motivo' : 'Novo Motivo'} - {typeLabel}</DialogTitle>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {/* Basic Info */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex-1 space-y-1.5">
                                <Label>Nome do Motivo</Label>
                                <Input
                                    value={label}
                                    onChange={(e) => setLabel(e.target.value)}
                                    placeholder="Ex: Cliente ausente, Avaria, etc."
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label>Ativo</Label>
                                <div className="flex items-center h-10">
                                    <Switch checked={active} onCheckedChange={setActive} />
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                            <div className="space-y-0.5">
                                <Label className="text-base">Exigir observação</Label>
                                <p className="text-sm text-gray-500">Obrigatório escrever nota ao selecionar este motivo</p>
                            </div>
                            <Switch
                                checked={defaults.require_note}
                                onCheckedChange={(v) => handleToggle('require_note', v)}
                            />
                        </div>
                    </div>

                    {availableActions.length > 0 && (
                        <div className="border-t pt-4">
                            <OccurrenceActionsPanel
                                mode="defaults"
                                availableActions={availableActions}
                                currentActions={currentActions}
                                onChange={handleActionChange}
                                // Custom label for Partial Load to match context
                                customLabels={isExpeditionPartial ? {
                                    [OperationAction.GENERATE_NEW_ORDER_PENDING]: "Gerar Pedido Complementar"
                                } : undefined}
                            />
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={isLoading}>Cancelar</Button>
                    <Button onClick={handleSave} disabled={isLoading}>
                        {isLoading ? 'Salvando...' : 'Salvar Motivo'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
