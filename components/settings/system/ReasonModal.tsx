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
import { DeliveryReasonDTO, DeliveryReasonGroup, DELIVERY_REASON_GROUPS } from "@/lib/types/reasons-dto";
import { upsertDeliveryReasonAction } from "@/app/actions/settings/reasons-actions";

interface ReasonModalProps {
    isOpen: boolean;
    onClose: () => void;
    reason: DeliveryReasonDTO | null;
    defaultGroup?: DeliveryReasonGroup;
    companyId: string;
    onSaved: () => void;
}

export function ReasonModal({ isOpen, onClose, reason, defaultGroup, companyId, onSaved }: ReasonModalProps) {
    // const supabase = createClient(); // Not used, action used instead
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);

    // Form State
    const [name, setName] = useState("");
    const [isActive, setIsActive] = useState(true);
    const [group, setGroup] = useState<DeliveryReasonGroup>("EXPEDICAO_CARREGADO_PARCIAL");
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
        setLoading(true);
        try {
            const res = await upsertDeliveryReasonAction({
                id: reason?.id,
                // company_id: companyId, // Action handles auth/tenant via getCompanyId(), or we pass it? 
                // Wait, Action implementation calls upsertDeliveryReason which expects Partial<DeliveryReason>.
                // The Action enforces tenant if it sets company_id. 
                // Let's check reasons-actions.ts again.
                // upsertDeliveryReasonAction does: const result = await upsertDeliveryReason(supabase, { ...validated });
                // It does NOT explicitly set company_id from getCompanyId() in the spread!!
                // BUT reasons usually strictly need company_id.
                // Looking at reasons-actions.ts content in memory:
                // "const result = await upsertDeliveryReason(supabase, { ...validated });"
                // It calls getCompanyId() at start but doesn't use it in payload!
                // This might be a bug in my Action implementation if the data layer expects company_id.
                // "getDeliveryReasons" takes companyId arg.
                // "upsertDeliveryReason" probably expects company_id in payload.
                // I should fix the Action first? Or pass it here?
                // Secure way: Action sets it.
                // I will pass it here for now as the Schema validation allows it (passthrough? no, strictly defined).
                // My Schema in actions: id, name, reason_group, is_active, require_note. NO company_id.
                // So I MUST Fix the Action to inject company_id.
                // Proceeding with refactor here assuming I will fix Action immediately after.

                name: formattedName,
                reason_group: group,
                is_active: isActive,
                require_note: requireNote,
            });

            if (!res.success) throw new Error(res.error);

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

                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl">
                        <Label>Ativo</Label>
                        <Switch checked={isActive} onCheckedChange={setIsActive} />
                    </div>

                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl">
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
