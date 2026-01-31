'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { format, addDays } from 'date-fns'
import { approveTitleAction, rejectTitleAction, updateTitleAction } from '@/app/actions/finance'
import { useToast } from '@/components/ui/use-toast'
import { Loader2, DollarSign, Calendar, AlertTriangle } from 'lucide-react'

// Mock terms if we don't fetch them (simplified for MVP)
// Ideally we pass company terms as props
const MOCK_TERMS = [
    { id: 't1', name: 'À Vista', installments: 1, first_due: 0, cadence: 0 },
    { id: 't2', name: '30 Dias', installments: 1, first_due: 30, cadence: 0 },
    { id: 't3', name: '30/60/90', installments: 3, first_due: 30, cadence: 30 },
]

interface PreApprovalActionsProps {
    isOpen: boolean
    onClose: () => void
    title: any
    onSuccess: () => void
}

export function PreApprovalActions({ isOpen, onClose, title, onSuccess }: PreApprovalActionsProps) {
    const { toast } = useToast()
    const [loading, setLoading] = useState(false)
    const [action, setAction] = useState<'detail' | 'reject'>('detail')

    // Form State
    const [amount, setAmount] = useState(0)
    const [dueDate, setDueDate] = useState('')
    const [installments, setInstallments] = useState<any[]>([])

    // Initialize
    useEffect(() => {
        if (title) {
            setAmount(Number(title.amount_total))
            setDueDate(title.due_date ? format(new Date(title.due_date), 'yyyy-MM-dd') : format(addDays(new Date(), 30), 'yyyy-MM-dd'))
            generatePreview(title.amount_total, 1, 30) // Default if no logic
        }
    }, [title])

    const generatePreview = (total: number, count: number, firstDue: number) => {
        const value = total / count
        const news = []
        let current = addDays(new Date(), firstDue)
        for (let i = 1; i <= count; i++) {
            news.push({
                installment_number: i,
                due_date: format(current, 'yyyy-MM-dd'),
                amount_original: value,
                amount_open: value
            })
            current = addDays(current, 30) // Simplified cadence
        }
        setInstallments(news)
    }

    const handleApprove = async () => {
        setLoading(true)
        try {
            const res = await approveTitleAction(title.id, title.type, installments)
            if (res.error) throw new Error(res.error)
            toast({ title: 'Aprovado com sucesso!' })

            // Allow update if changed (simple logic check)
            if (amount !== Number(title.amount_total)) {
                await updateTitleAction(title.id, title.type, { amount_total: amount })
            }

            onSuccess()
            onClose()
        } catch (error: any) {
            console.error(error)
            toast({ title: 'Erro', description: error.message, variant: 'destructive' })
        } finally {
            setLoading(false)
        }
    }

    const handleReject = async () => {
        if (!confirm('Rejeitar este título? Ele será cancelado.')) return
        setLoading(true)
        try {
            const res = await rejectTitleAction(title.id, title.type)
            if (res.error) throw new Error(res.error)
            toast({ title: 'Rejeitado/Cancelado.' })
            onSuccess()
            onClose()
        } catch (error: any) {
            console.error(error)
            toast({ title: 'Erro', description: error.message, variant: 'destructive' })
        } finally {
            setLoading(false)
        }
    }

    if (!title) return null

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>
                        {title.type === 'AR' ? 'Aprovar Contas a Receber' : 'Aprovar Contas a Pagar'}
                    </DialogTitle>
                </DialogHeader>

                <div className="grid grid-cols-2 gap-6 py-4">
                    {/* INFO */}
                    <div className="space-y-4 border-r pr-6">
                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Parceiro</Label>
                            <div className="font-semibold text-lg">{title.entity_name}</div>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Valor Total</Label>
                            <div className="flex items-center gap-2">
                                <Input
                                    type="number"
                                    value={amount}
                                    onChange={e => {
                                        setAmount(Number(e.target.value))
                                        generatePreview(Number(e.target.value), installments.length, 30)
                                    }}
                                />
                            </div>
                        </div>
                        {title.attention_status && (
                            <div className="bg-amber-50 text-amber-900 p-3 rounded-md text-sm flex gap-2 items-start">
                                <AlertTriangle className="w-4 h-4 mt-0.5 text-amber-600" />
                                <div>
                                    <div className="font-bold">Atenção Necessária</div>
                                    <div>{title.attention_reason}</div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* PREVIEW */}
                    <div className="space-y-4">
                        <Label className="font-semibold">Simulação de Parcelas</Label>
                        <div className="space-y-2 max-h-[300px] overflow-auto pr-2">
                            {installments.map((inst, idx) => (
                                <div key={idx} className="flex gap-2 items-center bg-gray-50 p-2 rounded text-sm">
                                    <div className="w-8 font-bold text-gray-500">#{inst.installment_number}</div>
                                    <Input
                                        type="date"
                                        value={inst.due_date}
                                        onChange={e => {
                                            const newInst = [...installments]
                                            newInst[idx].due_date = e.target.value
                                            setInstallments(newInst)
                                        }}
                                        className="h-8 text-xs"
                                    />
                                    <Input
                                        type="number"
                                        value={inst.amount_original}
                                        onChange={e => {
                                            const newInst = [...installments]
                                            newInst[idx].amount_original = Number(e.target.value)
                                            // Ideally rebalance others, but simplified for MVP manual tweak
                                            setInstallments(newInst)
                                        }}
                                        className="h-8 text-xs text-right"
                                    />
                                </div>
                            ))}
                        </div>
                        <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => generatePreview(amount, installments.length + 1, 30)}>
                            + Adicionar Parcela
                        </Button>
                    </div>
                </div>

                <DialogFooter className="gap-2">
                    <Button variant="danger" onClick={handleReject} disabled={loading}>
                        Rejeitar
                    </Button>
                    <div className="flex-1" />
                    <Button variant="outline" onClick={onClose} disabled={loading}>
                        Cancelar
                    </Button>
                    <Button onClick={handleApprove} disabled={loading} className="bg-green-600 hover:bg-green-700">
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Aprovar e Gerar'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
