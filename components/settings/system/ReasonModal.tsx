"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/components/ui/use-toast";
import { createClient } from "@/lib/supabaseBrowser";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Switch } from "@/components/ui/Switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { DeliveryReason, DeliveryReasonGroup, DELIVERY_REASON_GROUPS } from "@/types/reasons";
import { upsertDeliveryReason } from "@/lib/data/reasons";

interface ReasonModalProps {
    isOpen: boolean;
    onClose: () => void;
    reason: DeliveryReason | null;
    defaultGroup?: DeliveryReasonGroup;
    companyId: string;
    onSaved: () => void;
}

export function ReasonModal({ isOpen, onClose, reason, defaultGroup, companyId, onSaved }: ReasonModalProps) {
    const supabase = createClient();
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);

    // Form State
    const [name, setName] = useState("");
    const [isActive, setIsActive] = useState(true);
    const [group, setGroup] = useState<DeliveryReasonGroup>("CARREGAMENTO_PARCIAL");
    const [requireNote, setRequireNote] = useState(false);

    useEffect(() => {
        if (isOpen) {
            if (reason) {
                setName(reason.name);
                setIsActive(reason.is_active);
                setGroup(reason.reason_group);
                setRequireNote(reason.require_note);
            } else {
                // Reset defaults
                setName("");
                setIsActive(true);
                if (defaultGroup) {
                    setGroup(defaultGroup);
                }
                setRequireNote(false);
            }
        }
    }, [isOpen, reason, defaultGroup]);

    const toTitleCase = (str: string) => {
        return str
            .toLowerCase()
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    };

    const handleSave = async () => {
        if (!name.trim()) {
            toast({ title: "Nome obrigatório", description: "Informe o nome do motivo.", variant: "destructive" });
            return;
        }

        const formattedName = toTitleCase(name.trim());

        setLoading(true);
        try {
            await upsertDeliveryReason(supabase, {
                id: reason?.id,
                company_id: companyId,
                name: formattedName,
                reason_group: group,
                is_active: isActive,
                require_note: requireNote,
            });

            toast({ title: "Salvo", description: "Motivo salvo com sucesso." });
            onSaved();
            onClose();

        } catch (err: any) {
            console.error(err);
            toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Sheet isOpen={isOpen} onClose={onClose} title={reason ? "Editar Motivo" : "Novo Motivo"}>
            <div className="space-y-6 pb-10">
                <p className="text-sm text-gray-500">
                    Cadastre motivos para justificar ocorrências logísticas.
                </p>

                {/* Basics */}
                <div className="space-y-4">
                    <div className="space-y-1.5">
                        <Label>Nome do Motivo</Label>
                        <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Avaria no produto" />
                    </div>

                    <div className="space-y-1.5">
                        <Label>Grupo</Label>
                        <Select value={group} onValueChange={(val) => setGroup(val as DeliveryReasonGroup)}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {DELIVERY_REASON_GROUPS.map(g => (
                                    <SelectItem key={g.code} value={g.code}>
                                        {g.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <Label>Ativo</Label>
                        <Switch checked={isActive} onCheckedChange={setIsActive} />
                    </div>

                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <Label>Exigir Observação</Label>
                        <Switch checked={requireNote} onCheckedChange={setRequireNote} />
                    </div>
                </div>

                <div className="flex gap-2 justify-end mt-8 pt-4 border-t border-gray-100">
                    <Button variant="outline" onClick={onClose} disabled={loading}>
                        Cancelar
                    </Button>
                    <Button onClick={handleSave} disabled={loading}>
                        {loading ? "Salvando..." : "Salvar"}
                    </Button>
                </div>

            </div>
        </Sheet>
    );
}
