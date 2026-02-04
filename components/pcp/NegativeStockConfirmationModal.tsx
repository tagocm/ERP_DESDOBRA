'use client'

import { useState } from "react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/Dialog"
import { Button } from "@/components/ui/Button"
import { Label } from "@/components/ui/Label"
import { Textarea } from "@/components/ui/Textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select"
import { Badge } from "@/components/ui/Badge"
import { AlertTriangle } from "lucide-react"

interface NegativeItem {
    item_id: string
    item_name: string
    balance_after: number
    uom: string
}

interface NegativeStockConfirmationModalProps {
    isOpen: boolean
    onClose: () => void
    onConfirm: (reason: string, note: string) => void
    negativeItems: NegativeItem[]
    isLoading?: boolean
}

const NEGATIVE_STOCK_REASONS = [
    { value: "PENDING_PURCHASE", label: "Compra/Entrada já está prevista" },
    { value: "MANUAL_ADJUSTMENT", label: "Será ajustado manualmente" },
    { value: "STOCK_ERROR", label: "Erro no saldo de estoque anterior" },
    { value: "MADE_TO_ORDER", label: "Produção sob encomenda (sem controle rígido)" },
    { value: "OTHER", label: "Outro motivo" }
]

export function NegativeStockConfirmationModal({
    isOpen,
    onClose,
    onConfirm,
    negativeItems,
    isLoading = false
}: NegativeStockConfirmationModalProps) {
    const [reason, setReason] = useState("")
    const [note, setNote] = useState("")

    const handleConfirm = () => {
        if (!reason || !note.trim()) {
            return
        }
        onConfirm(reason, note)
    }

    const handleClose = () => {
        setReason("")
        setNote("")
        onClose()
    }

    const isValid = reason && note.trim().length > 0

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-red-600">
                        <AlertTriangle className="w-5 h-5" />
                        Atenção: Estoque Negativo Detectado
                    </DialogTitle>
                    <DialogDescription>
                        O encerramento desta OP vai gerar estoque negativo para os itens abaixo.
                        Você pode prosseguir, mas precisa justificar.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Lista de itens afetados */}
                    <div className="space-y-2">
                        <Label className="text-sm font-semibold text-gray-700">Itens Afetados:</Label>
                        <div className="border rounded-2xl overflow-hidden">
                            <div className="bg-red-50 border-b border-red-100 px-4 py-2 grid grid-cols-2 gap-4 text-xs font-semibold text-red-800">
                                <div>Item</div>
                                <div className="text-right">Saldo Projetado</div>
                            </div>
                            <div className="divide-y divide-gray-100 max-h-40 overflow-y-auto">
                                {negativeItems.map((item) => (
                                    <div key={item.item_id} className="px-4 py-2 grid grid-cols-2 gap-4 items-center hover:bg-gray-50">
                                        <div>
                                            <div className="font-medium text-sm text-gray-900">{item.item_name}</div>
                                        </div>
                                        <div className="text-right">
                                            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 font-mono text-xs">
                                                {new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2, signDisplay: 'always' }).format(item.balance_after)} {item.uom}
                                            </Badge>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Motivo */}
                    <div className="space-y-2">
                        <Label htmlFor="reason" className="text-sm font-semibold text-gray-700">
                            Motivo <span className="text-red-500">*</span>
                        </Label>
                        <Select value={reason} onValueChange={setReason}>
                            <SelectTrigger id="reason">
                                <SelectValue placeholder="Selecione o motivo..." />
                            </SelectTrigger>
                            <SelectContent>
                                {NEGATIVE_STOCK_REASONS.map((r) => (
                                    <SelectItem key={r.value} value={r.value}>
                                        {r.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Observação */}
                    <div className="space-y-2">
                        <Label htmlFor="note" className="text-sm font-semibold text-gray-700">
                            Observação <span className="text-red-500">*</span>
                        </Label>
                        <Textarea
                            id="note"
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="Descreva o motivo e o que será feito para corrigir..."
                            className="h-24 resize-none"
                        />
                        <p className="text-xs text-gray-500">
                            Esta informação ficará registrada no histórico de auditoria.
                        </p>
                    </div>
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="ghost" onClick={handleClose} disabled={isLoading}>
                        Cancelar
                    </Button>
                    <Button
                        variant="danger"
                        onClick={handleConfirm}
                        disabled={!isValid || isLoading}
                        className="bg-red-600 hover:bg-red-700"
                    >
                        {isLoading ? "Processando..." : "Confirmar e Encerrar"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
