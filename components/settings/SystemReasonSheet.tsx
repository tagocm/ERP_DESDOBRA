"use client"

import { useState, useEffect } from "react"
import { useToast } from "@/components/ui/use-toast"
import { createClient } from "@/lib/supabaseBrowser"
import { Sheet } from "@/components/ui/Sheet"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Label } from "@/components/ui/Label"
import { Switch } from "@/components/ui/Switch"
import { SystemOccurrenceReasonWithDefaults } from "@/types/system-preferences"

interface SystemReasonSheetProps {
    isOpen: boolean
    onClose: () => void
    reason: SystemOccurrenceReasonWithDefaults | null
    typeCode: string
    onSaved: () => void
}

export function SystemReasonSheet({ isOpen, onClose, reason, typeCode, onSaved }: SystemReasonSheetProps) {
    const supabase = createClient()
    const { toast } = useToast()
    const [loading, setLoading] = useState(false)

    // Form State
    const [label, setLabel] = useState("")
    const [isActive, setIsActive] = useState(true)
    const [sortOrder, setSortOrder] = useState(0)

    // Defaults
    const [requireNote, setRequireNote] = useState(false)
    const allowOverride = true

    // Specific Action Toggles
    const [returnToSandbox, setReturnToSandbox] = useState(false)
    const [registerAttempt, setRegisterAttempt] = useState(false)
    const [reverseStock, setReverseStock] = useState(false)
    const [createDevolution, setCreateDevolution] = useState(false)
    const [createNewOrder, setCreateNewOrder] = useState(false)
    const [createComplement, setCreateComplement] = useState(false)
    const [writeInternal, setWriteInternal] = useState(false)

    useEffect(() => {
        if (isOpen) {
            if (reason) {
                setLabel(reason.label)
                setIsActive(reason.active)
                setSortOrder(reason.sort_order)
                if (reason.defaults) {
                    setRequireNote(reason.defaults.require_note)
                    setReturnToSandbox(reason.defaults.return_to_sandbox_pending)
                    setRegisterAttempt(reason.defaults.register_attempt_note)
                    setReverseStock(reason.defaults.reverse_stock_and_finance)
                    setCreateDevolution(reason.defaults.create_devolution)
                    setCreateNewOrder(reason.defaults.create_new_order_for_pending)
                    setCreateComplement(reason.defaults.create_complement_order)
                    setWriteInternal(reason.defaults.write_internal_notes)
                } else {
                    setRequireNote(false)
                    resetActionToggles()
                }
            } else {
                setLabel("")
                setIsActive(true)
                setSortOrder(0)
                setRequireNote(false)
                resetActionToggles()
            }
        }
    }, [isOpen, reason])

    const resetActionToggles = () => {
        setReturnToSandbox(false)
        setRegisterAttempt(false)
        setReverseStock(false)
        setCreateDevolution(false)
        setCreateNewOrder(false)
        setCreateComplement(false)
        setWriteInternal(false)
    }

    const handleSave = async () => {
        if (!label.trim()) {
            toast({
                title: "Atenção",
                description: "O nome do motivo é obrigatório.",
                variant: "destructive",
            })
            return
        }

        setLoading(true)
        try {
            let reasonId = reason?.id

            if (reasonId) {
                // Update
                const { error: rError } = await supabase
                    .from("system_occurrence_reasons")
                    .update({
                        label,
                        active: isActive,
                        sort_order: sortOrder,
                        updated_at: new Date().toISOString(),
                    })
                    .eq("id", reasonId)

                if (rError) throw rError
            } else {
                // Create
                const { data, error: rError } = await supabase
                    .from("system_occurrence_reasons")
                    .insert({
                        type_code: typeCode,
                        label,
                        active: isActive,
                        sort_order: sortOrder,
                    })
                    .select("id")
                    .single()

                if (rError) throw rError
                reasonId = data.id
            }

            // Upsert Defaults
            const { data: existingDefaults } = await supabase
                .from("system_occurrence_reason_defaults")
                .select("id")
                .eq("reason_id", reasonId)
                .maybeSingle()

            const defaultPayload = {
                require_note: requireNote,
                allow_override: allowOverride,
                return_to_sandbox_pending: returnToSandbox,
                register_attempt_note: registerAttempt,
                reverse_stock_and_finance: reverseStock,
                create_devolution: createDevolution,
                create_new_order_for_pending: createNewOrder,
                create_complement_order: createComplement,
                write_internal_notes: writeInternal,
                updated_at: new Date().toISOString()
            }

            if (existingDefaults) {
                const { error: dError } = await supabase
                    .from("system_occurrence_reason_defaults")
                    .update(defaultPayload)
                    .eq("id", existingDefaults.id)
                if (dError) throw dError
            } else {
                const { error: dError } = await supabase
                    .from("system_occurrence_reason_defaults")
                    .insert({
                        reason_id: reasonId,
                        ...defaultPayload
                    })
                if (dError) throw dError
            }

            toast({
                title: "Salvo",
                description: "Motivo atualizado com sucesso.",
            })
            onSaved()
            onClose()
        } catch (error: any) {
            console.error(error)
            toast({
                title: "Erro",
                description: error.message || "Falha ao salvar motivo.",
                variant: "destructive",
            })
        } finally {
            setLoading(false)
        }
    }

    const isExpedition = typeCode?.includes("EXPEDICAO")
    const isReturn = typeCode?.includes("RETORNO")

    return (
        <Sheet isOpen={isOpen} onClose={onClose} title={reason ? "Editar Motivo" : "Novo Motivo"}>
            <div className="space-y-6">
                <p className="text-sm text-gray-500">
                    Configure as ações padrão. O operador poderá ajustar na operação.
                </p>

                {/* Basic Info */}
                <div className="space-y-4">
                    <div className="grid w-full items-center gap-1.5">
                        <Label htmlFor="label">Nome do Motivo</Label>
                        <Input
                            id="label"
                            value={label}
                            onChange={(e) => setLabel(e.target.value)}
                            placeholder="Ex: Cliente fechado"
                        />
                    </div>

                    <div className="flex items-center justify-between">
                        <Label htmlFor="active">Ativo</Label>
                        <Switch id="active" checked={isActive} onCheckedChange={setIsActive} />
                    </div>

                    <div className="flex items-center justify-between">
                        <Label htmlFor="req-note">Exigir Observação</Label>
                        <Switch id="req-note" checked={requireNote} onCheckedChange={setRequireNote} />
                    </div>

                    <div className="grid w-full items-center gap-1.5">
                        <Label htmlFor="sort">Ordem (Sort Order)</Label>
                        <Input
                            id="sort"
                            type="number"
                            value={sortOrder}
                            onChange={(e) => setSortOrder(Number(e.target.value))}
                            className="w-24"
                        />
                    </div>
                </div>

                <div className="border-t border-gray-100 my-4" />

                {/* Actions */}
                <div className="space-y-4">
                    <h4 className="font-medium text-sm text-gray-900">Ações Padrão (Defaults)</h4>

                    {/* Common / Return Actions */}
                    {isReturn && (
                        <>
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label htmlFor="ret-sandbox">Voltar para Sandbox (Pendente)</Label>
                                    <p className="text-xs text-gray-500">O pedido volta a ficar disponível para roteirização</p>
                                </div>
                                <Switch id="ret-sandbox" checked={returnToSandbox} onCheckedChange={setReturnToSandbox} />
                            </div>

                            <div className="flex items-center justify-between">
                                <Label htmlFor="reg-attempt">Registrar Tentativa (Log)</Label>
                                <Switch id="reg-attempt" checked={registerAttempt} onCheckedChange={setRegisterAttempt} />
                            </div>

                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label htmlFor="rev-stock">Estornar Estoque/Financeiro</Label>
                                    <p className="text-xs text-gray-500">Cancela a baixa e estorna faturamento</p>
                                </div>
                                <Switch id="rev-stock" checked={reverseStock} onCheckedChange={setReverseStock} />
                            </div>

                            <div className="flex items-center justify-between">
                                <Label htmlFor="create-dev">Gerar Devolução (Movimento)</Label>
                                <Switch id="create-dev" checked={createDevolution} onCheckedChange={setCreateDevolution} />
                            </div>

                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label htmlFor="new-order">Gerar Novo Pedido (Pendência)</Label>
                                    <p className="text-xs text-gray-500">Cria um novo pedido com os itens faltantes</p>
                                </div>
                                <Switch id="new-order" checked={createNewOrder} onCheckedChange={setCreateNewOrder} />
                            </div>
                        </>
                    )}

                    {/* Expedition Actions */}
                    {isExpedition && (
                        <>
                            <div className="flex items-center justify-between">
                                <Label htmlFor="ret-sandbox-exp">Voltar para Sandbox</Label>
                                <Switch id="ret-sandbox-exp" checked={returnToSandbox} onCheckedChange={setReturnToSandbox} />
                            </div>

                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label htmlFor="complement">Gerar Pedido Complementar</Label>
                                    <p className="text-xs text-gray-500">Para itens que faltaram no carregamento</p>
                                </div>
                                <Switch id="complement" checked={createComplement} onCheckedChange={setCreateComplement} />
                            </div>

                            <div className="flex items-center justify-between">
                                <Label htmlFor="notes">Escrever Notas Internas</Label>
                                <Switch id="notes" checked={writeInternal} onCheckedChange={setWriteInternal} />
                            </div>
                        </>
                    )}

                    {/* Fallback if neither (rare) or generic */}
                    {!isExpedition && !isReturn && (
                        <p className="text-sm text-gray-500 italic">Selecione um tipo válido para ver as opções.</p>
                    )}
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
    )
}
