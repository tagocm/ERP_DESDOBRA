'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Checkbox } from '@/components/ui/Checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { ArrowRight, CheckCircle, FileText, Receipt, AlertCircle } from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'

interface ReceiptModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onConfirm: (data: ReceiptData) => Promise<void>
    purchaseOrder: any
    paymentTerms: any[]
    paymentModes: any[]
}

export interface ReceiptData {
    supplier_invoice_number: string
    supplier_invoice_series?: string
    supplier_invoice_date?: string
    payment_terms_id?: string
    payment_mode_id?: string
    generate_financial: boolean
    receipt_notes?: string
    received_at: string
}

export function ReceiptModal({
    open,
    onOpenChange,
    onConfirm,
    purchaseOrder,
    paymentTerms,
    paymentModes
}: ReceiptModalProps) {
    const [step, setStep] = useState<1 | 2>(1)
    const [loading, setLoading] = useState(false)

    // Form State
    const [invoiceNumber, setInvoiceNumber] = useState('')
    const [invoiceSeries, setInvoiceSeries] = useState('')
    const [invoiceDate, setInvoiceDate] = useState('')
    const [receivedAt, setReceivedAt] = useState(format(new Date(), 'yyyy-MM-dd'))

    // Financial State (Default to PO values)
    const [paymentTermsId, setPaymentTermsId] = useState(purchaseOrder?.payment_terms_id || '')
    const [paymentModeId, setPaymentModeId] = useState(purchaseOrder?.payment_mode_id || '')
    const [generateFinancial, setGenerateFinancial] = useState(true)
    const [notes, setNotes] = useState('')

    const handleNext = () => {
        if (!invoiceNumber || !receivedAt) return
        setStep(2)
    }

    const handleConfirm = async () => {
        if (generateFinancial && (!paymentTermsId || !paymentModeId)) return

        setLoading(true)
        try {
            await onConfirm({
                supplier_invoice_number: invoiceNumber,
                supplier_invoice_series: invoiceSeries,
                supplier_invoice_date: invoiceDate || undefined,
                payment_terms_id: paymentTermsId || undefined,
                payment_mode_id: paymentModeId || undefined,
                generate_financial: generateFinancial,
                receipt_notes: notes,
                received_at: new Date(receivedAt).toISOString()
            })
            onOpenChange(false)
        } catch (error) {
            console.error("Receipt error", error)
        } finally {
            setLoading(false)
        }
    }

    // Reset step on open
    if (!open && step !== 1) setTimeout(() => setStep(1), 300)

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden bg-white">
                <div className="bg-brand-50/50 p-6 border-b border-brand-100/50 flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-brand-100 flex items-center justify-center text-brand-700">
                        {step === 1 ? <FileText className="w-5 h-5" /> : <Receipt className="w-5 h-5" />}
                    </div>
                    <div>
                        <DialogTitle className="text-xl font-display font-semibold text-brand-950">
                            {step === 1 ? 'Dados da Nota Fiscal' : 'Financeiro & Conferência'}
                        </DialogTitle>
                        <p className="text-sm text-brand-600/80">
                            {step === 1 ? 'Informe os dados do documento fiscal.' : 'Confirme os dados financeiros para geração do AP.'}
                        </p>
                    </div>
                </div>

                <div className="p-6 space-y-4">
                    {step === 1 ? (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-brand-900 font-medium">Número da NF <span className="text-red-500">*</span></Label>
                                    <Input
                                        value={invoiceNumber}
                                        onChange={e => setInvoiceNumber(e.target.value)}
                                        placeholder="Ex: 123456"
                                        className="border-brand-200 focus:border-brand-500"
                                        autoFocus
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-brand-700">Série</Label>
                                    <Input
                                        value={invoiceSeries}
                                        onChange={e => setInvoiceSeries(e.target.value)}
                                        placeholder="Ex: 1"
                                        className="border-brand-200"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-brand-700">Data Emissão</Label>
                                    <Input
                                        type="date"
                                        value={invoiceDate}
                                        onChange={e => setInvoiceDate(e.target.value)}
                                        className="border-brand-200"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-brand-900 font-medium">Data Recebimento <span className="text-red-500">*</span></Label>
                                    <Input
                                        type="date"
                                        value={receivedAt}
                                        onChange={e => setReceivedAt(e.target.value)}
                                        className="border-brand-200"
                                    />
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* Read-only Summary */}
                            <div className="bg-brand-50/50 rounded-lg p-3 border border-brand-100 text-sm grid grid-cols-2 gap-2 text-brand-700">
                                <div><span className="font-semibold text-brand-900">Total:</span> {purchaseOrder.total_amount?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
                                <div><span className="font-semibold text-brand-900">Itens:</span> {purchaseOrder.items?.length || 0}</div>
                                <div><span className="font-semibold text-brand-900">NF:</span> {invoiceNumber}</div>
                                <div><span className="font-semibold text-brand-900">Emissão:</span> {invoiceDate ? format(new Date(invoiceDate), 'dd/MM/yyyy') : '-'}</div>
                            </div>

                            {/* Financial Toggle */}
                            <div className="flex items-center space-x-2 py-2">
                                <Checkbox
                                    id="financial"
                                    checked={generateFinancial}
                                    onCheckedChange={(c) => setGenerateFinancial(!!c)}
                                    className="data-[state=checked]:bg-brand-600 border-brand-300"
                                />
                                <Label htmlFor="financial" className="cursor-pointer text-brand-900 font-medium">
                                    Gerar Contas a Pagar (AP)
                                </Label>
                            </div>

                            {generateFinancial && (
                                <div className="space-y-3 pl-6 border-l-2 border-brand-100 bg-brand-50/20 p-3 rounded-r-md">
                                    <div className="space-y-2">
                                        <Label className="text-brand-700 text-xs uppercase tracking-wide font-semibold">Prazo de Pagamento <span className="text-red-500">*</span></Label>
                                        <Select
                                            value={paymentTermsId}
                                            onValueChange={setPaymentTermsId}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Selecione..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {paymentTerms.map(pt => (
                                                    <SelectItem key={pt.id} value={pt.id}>{pt.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-brand-700 text-xs uppercase tracking-wide font-semibold">Modalidade de Pagamento <span className="text-red-500">*</span></Label>
                                        <Select value={paymentModeId} onValueChange={setPaymentModeId}>
                                            <SelectTrigger className="h-9 bg-white border-brand-200">
                                                <SelectValue placeholder="Selecione..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {paymentModes.map(m => (
                                                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-2 pt-2">
                                <Label className="text-brand-700">Observações de Recebimento</Label>
                                <Textarea
                                    value={notes}
                                    onChange={e => setNotes(e.target.value)}
                                    placeholder="Avarias, entregador, etc."
                                    className="h-20 border-brand-200 text-sm resize-none"
                                />
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter className="p-4 bg-gray-50/50 border-t border-gray-100 flex justify-between items-center w-full">
                    {step === 2 ? (
                        <Button variant="ghost" onClick={() => setStep(1)} disabled={loading} className="text-brand-600 hover:text-brand-800 hover:bg-brand-50">
                            Voltar
                        </Button>
                    ) : (
                        <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-gray-500 hover:text-gray-700">
                            Cancelar
                        </Button>
                    )}

                    {step === 1 ? (
                        <Button
                            onClick={handleNext}
                            disabled={!invoiceNumber || !receivedAt}
                            className="bg-brand-600 hover:bg-brand-700 text-white gap-2"
                        >
                            Próximo <ArrowRight className="w-4 h-4" />
                        </Button>
                    ) : (
                        <Button
                            onClick={handleConfirm}
                            disabled={loading || (generateFinancial && (!paymentTermsId || !paymentModeId))}
                            className="bg-green-600 hover:bg-green-700 text-white gap-2 shadow-sm"
                        >
                            {loading ? 'Processando...' : 'Confirmar Entrada'}
                            {!loading && <CheckCircle className="w-4 h-4" />}
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
