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
    const isReturnNotDelivered = typeCode.includes('NAO_ENTREGUE') || typeCode.includes('DEVOLVIDO_TOTAL'); // Covers RETORNO_NAO_ENTREGUE
    const isReturnPartial = typeCode.includes('PARCIAL') && !typeCode.includes('CARREGADO'); // Covers RETORNO_ENTREGA_PARCIAL, DEVOLVIDO_PARCIAL

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[600px]">
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

                    <div className="border-t pt-4">
                        <h4 className="font-medium mb-3 text-sm text-gray-900 uppercase tracking-wider">Ações Padrão (Defaults)</h4>
                        <p className="text-xs text-gray-500 mb-4">
                            Estas ações virão marcadas por padrão, mas o operador pode alterar (override) no momento da ocorrência.
                        </p>

                        <div className="space-y-3">
                            {/* Actions for Not Loaded / Not Delivered */}
                            {(isExpeditionNotLoaded || isReturnNotDelivered) && (
                                <>
                                    <ToggleRow
                                        label="Voltar para Sandbox (Pendente)"
                                        description="O pedido sai da rota e volta para a lista de preparação."
                                        checked={defaults.return_to_sandbox_pending}
                                        onChange={(v) => handleToggle('return_to_sandbox_pending', v)}
                                    />
                                    <ToggleRow
                                        label="Registrar nota de tentativa"
                                        description="Adiciona observação interna automática."
                                        checked={defaults.register_attempt_note}
                                        onChange={(v) => handleToggle('register_attempt_note', v)}
                                    />
                                </>
                            )}

                            {isReturnNotDelivered && (
                                <ToggleRow
                                    label="Estornar estoque e financeiro"
                                    description="Desfaz baixas e lançamentos (se configurado)."
                                    checked={defaults.reverse_stock_and_finance}
                                    onChange={(v) => handleToggle('reverse_stock_and_finance', v)}
                                />
                            )}

                            {/* Actions for Expedition Partial */}
                            {isExpeditionPartial && (
                                <>
                                    <ToggleRow
                                        label="Gerar Pedido Complementar"
                                        description="Cria novo pedido com os itens faltantes."
                                        checked={defaults.create_complement_order}
                                        onChange={(v) => handleToggle('create_complement_order', v)}
                                    />
                                    <ToggleRow
                                        label="Anotar faltas no pedido original"
                                        description="Registra itens não carregados nas observações."
                                        checked={defaults.write_internal_notes}
                                        onChange={(v) => handleToggle('write_internal_notes', v)}
                                    />
                                </>
                            )}

                            {/* Actions for Return Partial */}
                            {isReturnPartial && (
                                <>
                                    <ToggleRow
                                        label="Gerar Devolução (Movimento)"
                                        description="Gera entrada de devolução para itens recusados."
                                        checked={defaults.create_devolution}
                                        onChange={(v) => handleToggle('create_devolution', v)}
                                    />
                                    <ToggleRow
                                        label="Gerar Novo Pedido (Pendente)"
                                        description="Cria novo pedido de venda para re-entrega dos itens."
                                        checked={defaults.create_new_order_for_pending}
                                        onChange={(v) => handleToggle('create_new_order_for_pending', v)}
                                    />
                                </>
                            )}
                        </div>
                    </div>
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

function ToggleRow({ label, description, checked, onChange }: { label: string, description: string, checked?: boolean, onChange: (v: boolean) => void }) {
    return (
        <div className="flex items-center justify-between py-2">
            <div className="flex-1 pr-4">
                <Label className="font-medium text-gray-700">{label}</Label>
                <p className="text-xs text-gray-500">{description}</p>
            </div>
            <Switch checked={checked} onCheckedChange={onChange} />
        </div>
    );
}
