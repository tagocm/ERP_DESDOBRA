"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabaseBrowser"
import { Sheet } from "@/components/ui/Sheet"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Label } from "@/components/ui/Label"
import { Checkbox } from "@/components/ui/Checkbox"
import { SystemOccurrenceReasonWithDefaultsDTO } from "@/lib/types/system-preferences-dto"
import { useToast } from "@/components/ui/use-toast"
import { ScrollArea } from "@/components/ui/scroll-area"

interface SystemReasonSheetProps {
    isOpen: boolean
    onClose: () => void
    reason: SystemOccurrenceReasonWithDefaultsDTO | null
    typeCode: string
    onSaved: () => Promise<void>
}

interface FormData {
    label: string
    active: boolean
    require_note: boolean
    return_to_sandbox_pending: boolean
    register_attempt_note: boolean
    reverse_stock_and_finance: boolean
    create_devolution: boolean
    create_new_order_for_pending: boolean
    create_complement_order: boolean
    write_internal_notes: boolean
}

const DEFAULT_FORM: FormData = {
    label: "",
    active: true,
    require_note: false,
    return_to_sandbox_pending: false,
    register_attempt_note: false,
    reverse_stock_and_finance: false,
    create_devolution: false,
    create_new_order_for_pending: false,
    create_complement_order: false,
    write_internal_notes: false
}

export function SystemReasonSheet({
    isOpen,
    onClose,
    reason,
    typeCode,
    onSaved
}: SystemReasonSheetProps) {
    const supabase = createClient()
    const { toast } = useToast()
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [form, setForm] = useState<FormData>(DEFAULT_FORM)

    useEffect(() => {
        if (isOpen) {
            if (reason) {
                setForm({
                    label: reason.label,
                    active: reason.active,
                    require_note: reason.defaults?.require_note || false,
                    return_to_sandbox_pending: reason.defaults?.return_to_sandbox_pending || false,
                    register_attempt_note: reason.defaults?.register_attempt_note || false,
                    reverse_stock_and_finance: reason.defaults?.reverse_stock_and_finance || false,
                    create_devolution: reason.defaults?.create_devolution || false,
                    create_new_order_for_pending: reason.defaults?.create_new_order_for_pending || false,
                    create_complement_order: reason.defaults?.create_complement_order || false,
                    write_internal_notes: reason.defaults?.write_internal_notes || false
                })
            } else {
                setForm(DEFAULT_FORM)
            }
        }
    }, [isOpen, reason])

    const updateField = (key: keyof FormData, value: any) => {
        setForm(prev => ({ ...prev, [key]: value }))
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsSubmitting(true)

        try {
            let reasonId = reason?.id

            // 1. Upsert Reason
            const reasonPayload = {
                type_code: typeCode,
                label: form.label,
                active: form.active,
                // Using a simple sort order strategy (bottom of list) if new/unknown
                sort_order: reason?.sort_order ?? 999
            }

            if (reasonId) {
                const { error } = await supabase
                    .from("system_occurrence_reasons")
                    .update(reasonPayload)
                    .eq("id", reasonId)
                if (error) throw error
            } else {
                const { data: newReason, error } = await supabase
                    .from("system_occurrence_reasons")
                    .insert(reasonPayload)
                    .select("id")
                    .single()
                if (error) throw error
                reasonId = newReason.id
            }

            // 2. Upsert Defaults
            const defaultsPayload = {
                reason_id: reasonId,
                require_note: form.require_note,
                return_to_sandbox_pending: form.return_to_sandbox_pending,
                register_attempt_note: form.register_attempt_note,
                reverse_stock_and_finance: form.reverse_stock_and_finance,
                create_devolution: form.create_devolution,
                create_new_order_for_pending: form.create_new_order_for_pending,
                create_complement_order: form.create_complement_order,
                write_internal_notes: form.write_internal_notes
            }

            // Check if defaults exist
            const { data: existingDefaults } = await supabase
                .from("system_occurrence_reason_defaults")
                .select("id")
                .eq("reason_id", reasonId)
                .maybeSingle()

            if (existingDefaults) {
                const { error } = await supabase
                    .from("system_occurrence_reason_defaults")
                    .update(defaultsPayload)
                    .eq("id", existingDefaults.id)
                if (error) throw error
            } else {
                const { error } = await supabase
                    .from("system_occurrence_reason_defaults")
                    .insert(defaultsPayload)
                if (error) throw error
            }

            toast({ title: "Salvo com sucesso" })
            await onSaved()
            onClose()
        } catch (error: any) {
            console.error(error)
            toast({
                title: "Erro ao salvar",
                description: error.message,
                variant: "destructive"
            })
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <Sheet
            isOpen={isOpen}
            onClose={onClose}
            title={reason ? "Editar Motivo" : "Novo Motivo"}
        >
            <form onSubmit={handleSubmit} className="h-full flex flex-col">
                <ScrollArea className="flex-1 pr-4 -mr-4 mt-2 mb-6">
                    <div className="space-y-6">
                        {/* Basic Info */}
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label>Descrição do Motivo</Label>
                                <Input
                                    value={form.label}
                                    onChange={e => updateField("label", e.target.value)}
                                    placeholder="Ex: Cliente ausente"
                                    required
                                />
                            </div>

                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="active"
                                    checked={form.active}
                                    onCheckedChange={(c) => updateField("active", c as boolean)}
                                />
                                <Label htmlFor="active" className="cursor-pointer">Motivo Ativo</Label>
                            </div>
                        </div>

                        {/* Automation Rules */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider border-b pb-2">Regras de Automação</h3>

                            <div className="grid gap-4">
                                <div className="flex items-start space-x-3 p-3 bg-gray-50 rounded-2xl border border-gray-100">
                                    <Checkbox
                                        id="require_note"
                                        checked={form.require_note}
                                        onCheckedChange={(c) => updateField("require_note", c as boolean)}
                                    />
                                    <div className="space-y-1">
                                        <Label htmlFor="require_note" className="font-medium cursor-pointer">Exigir Observação</Label>
                                        <p className="text-xs text-gray-500">Motorista/Usuário deve escrever um justificativa.</p>
                                    </div>
                                </div>

                                <div className="flex items-start space-x-3 p-3 bg-gray-50 rounded-2xl border border-gray-100">
                                    <Checkbox
                                        id="return_to_sandbox_pending"
                                        checked={form.return_to_sandbox_pending}
                                        onCheckedChange={(c) => updateField("return_to_sandbox_pending", c as boolean)}
                                    />
                                    <div className="space-y-1">
                                        <Label htmlFor="return_to_sandbox_pending" className="font-medium cursor-pointer">Voltar para Sandbox (Pendente)</Label>
                                        <p className="text-xs text-gray-500">O pedido volta para "Pendente" na logística para ser roteirizado novamente.</p>
                                    </div>
                                </div>

                                <div className="flex items-start space-x-3 p-3 bg-gray-50 rounded-2xl border border-gray-100">
                                    <Checkbox
                                        id="reverse_stock_and_finance"
                                        checked={form.reverse_stock_and_finance}
                                        onCheckedChange={(c) => updateField("reverse_stock_and_finance", c as boolean)}
                                    />
                                    <div className="space-y-1">
                                        <Label htmlFor="reverse_stock_and_finance" className="font-medium cursor-pointer">Estornar Estoque e Financeiro</Label>
                                        <p className="text-xs text-gray-500">Cancela baixa de estoque e provisões financeiras.</p>
                                    </div>
                                </div>

                                <div className="flex items-start space-x-3 p-3 bg-gray-50 rounded-2xl border border-gray-100">
                                    <Checkbox
                                        id="create_devolution"
                                        checked={form.create_devolution}
                                        onCheckedChange={(c) => updateField("create_devolution", c as boolean)}
                                    />
                                    <div className="space-y-1">
                                        <Label htmlFor="create_devolution" className="font-medium cursor-pointer">Gerar Devolução (NF-e)</Label>
                                        <p className="text-xs text-gray-500">Inicia processo de devolução fiscal total ou parcial.</p>
                                    </div>
                                </div>

                                <div className="flex items-start space-x-3 p-3 bg-gray-50 rounded-2xl border border-gray-100">
                                    <Checkbox
                                        id="write_internal_notes"
                                        checked={form.write_internal_notes}
                                        onCheckedChange={(c) => updateField("write_internal_notes", c as boolean)}
                                    />
                                    <div className="space-y-1">
                                        <Label htmlFor="write_internal_notes" className="font-medium cursor-pointer">Escrever Notas Internas</Label>
                                        <p className="text-xs text-gray-500">Registra ocorrência na timeline do pedido.</p>
                                    </div>
                                </div>

                                <div className="flex items-start space-x-3 p-3 bg-gray-50 rounded-2xl border border-gray-100">
                                    <Checkbox
                                        id="register_attempt_note"
                                        checked={form.register_attempt_note}
                                        onCheckedChange={(c) => updateField("register_attempt_note", c as boolean)}
                                    />
                                    <div className="space-y-1">
                                        <Label htmlFor="register_attempt_note" className="font-medium cursor-pointer">Registrar Tentativa de Entrega</Label>
                                        <p className="text-xs text-gray-500">Conta como 1ª/2ª/3ª tentativa de entrega falha.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </ScrollArea>

                <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 mt-auto">
                    <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
                        Cancelar
                    </Button>
                    <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? "Salvando..." : "Salvar Configuração"}
                    </Button>
                </div>
            </form>
        </Sheet>
    )
}
