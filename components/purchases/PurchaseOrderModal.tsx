'use client'

import { useState, useEffect } from "react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/Dialog"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Label } from "@/components/ui/Label"
import { Textarea } from "@/components/ui/Textarea"
import { Plus, Trash2, Search, Package } from "lucide-react"
import { createPurchaseOrderAction, updatePurchaseOrderAction } from "@/app/actions/purchases"
import { useToast } from "@/components/ui/use-toast"
import { createClient } from "@/utils/supabase/client"
import { cn } from "@/lib/utils"

interface PurchaseOrderModalProps {
    isOpen: boolean
    onClose: () => void
    onSuccess: () => void
    order?: any // If provided, we are editing
}

export function PurchaseOrderModal({ isOpen, onClose, onSuccess, order }: PurchaseOrderModalProps) {
    const { toast } = useToast()
    const supabase = createClient()
    const [loading, setLoading] = useState(false)

    // Form State
    const [supplierId, setSupplierId] = useState("")
    const [suppliers, setSuppliers] = useState<any[]>([])
    const [searchSupplier, setSearchSupplier] = useState("")
    const [expectedAt, setExpectedAt] = useState("")
    const [notes, setNotes] = useState("")

    // Items State
    const [items, setItems] = useState<any[]>([])
    const [availableItems, setAvailableItems] = useState<any[]>([])
    const [searchItem, setSearchItem] = useState("")

    useEffect(() => {
        if (isOpen) {
            fetchSuppliers()
            fetchItems()
            if (order) {
                setSupplierId(order.supplier_id || "")
                setExpectedAt(order.expected_at || "")
                setNotes(order.notes || "")
                setItems(order.items?.map((item: any) => ({
                    id: item.id,
                    item_id: item.item_id,
                    name: item.item?.name,
                    uom_label: item.uom_label,
                    qty_display: item.qty_display,
                    unit_cost: item.unit_cost || 0,
                    conversion_factor: item.conversion_factor || 1
                })) || [])
            } else {
                setSupplierId("")
                setExpectedAt("")
                setNotes("")
                setItems([])
            }
        }
    }, [isOpen, order])

    const fetchSuppliers = async () => {
        const { data } = await supabase
            .from('organizations')
            .select('id, name')
            .eq('is_active', true)
            .order('name')
        setSuppliers(data || [])
    }

    const fetchItems = async () => {
        const { data } = await supabase
            .from('items')
            .select('id, name, uom')
            .eq('deleted_at', null)
            .order('name')
        setAvailableItems(data || [])
    }

    const addItem = (item: any) => {
        if (items.find(i => i.item_id === item.id)) {
            toast({ title: "Item já adicionado", variant: "destructive" })
            return
        }
        setItems([...items, {
            item_id: item.id,
            name: item.name,
            uom_label: item.uom,
            qty_display: 1,
            unit_cost: 0,
            conversion_factor: 1
        }])
        setSearchItem("")
    }

    const removeItem = (idx: number) => {
        setItems(items.filter((_, i) => i !== idx))
    }

    const updateItem = (idx: number, field: string, value: any) => {
        const newItems = [...items]
        newItems[idx] = { ...newItems[idx], [field]: value }
        setItems(newItems)
    }

    const handleSubmit = async () => {
        if (items.length === 0) {
            toast({ title: "Adicione ao menos um item", variant: "destructive" })
            return
        }

        setLoading(true)
        try {
            const payload = {
                supplier_id: supplierId || null,
                expected_at: expectedAt || null,
                notes: notes || null,
                items: items.map(item => ({
                    item_id: item.item_id,
                    qty_display: Number(item.qty_display),
                    uom_label: item.uom_label,
                    conversion_factor: item.conversion_factor || 1,
                    unit_cost: Number(item.unit_cost) || null
                }))
            }

            if (order) {
                await updatePurchaseOrderAction(order.id, payload)
                toast({ title: "Pedido atualizado com sucesso" })
            } else {
                await createPurchaseOrderAction(payload)
                toast({ title: "Pedido criado com sucesso" })
            }
            onSuccess()
            onClose()
        } catch (error: any) {
            console.error(error)
            toast({ title: "Erro ao salvar pedido", description: error.message, variant: "destructive" })
        } finally {
            setLoading(false)
        }
    }

    const filteredSuppliers = suppliers.filter(s => s.name.toLowerCase().includes(searchSupplier.toLowerCase()))
    const filteredItems = availableItems.filter(i => i.name.toLowerCase().includes(searchItem.toLowerCase()))

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0">
                <DialogHeader className="p-6 pb-2 border-b">
                    <DialogTitle className="text-xl font-bold flex items-center gap-2">
                        <Package className="w-5 h-5 text-blue-600" />
                        {order ? 'Editar Pedido de Compra' : 'Novo Pedido de Compra'}
                    </DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Header Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Fornecedor</Label>
                            <div className="relative group">
                                <select
                                    className="w-full flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    value={supplierId}
                                    onChange={(e) => setSupplierId(e.target.value)}
                                >
                                    <option value="">Selecione um fornecedor...</option>
                                    {suppliers.map(s => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Data Prevista</Label>
                            <Input
                                type="date"
                                value={expectedAt}
                                onChange={(e) => setExpectedAt(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Items Section */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-center border-b pb-2">
                            <Label className="text-base font-semibold">Itens do Pedido</Label>
                            <div className="relative w-64">
                                <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                                <Input
                                    placeholder="Buscar item..."
                                    className="pl-8"
                                    value={searchItem}
                                    onChange={(e) => setSearchItem(e.target.value)}
                                />
                                {searchItem && filteredItems.length > 0 && (
                                    <div className="absolute z-10 w-full mt-1 bg-white border rounded-2xl shadow-float max-h-48 overflow-y-auto">
                                        {filteredItems.map(item => (
                                            <button
                                                key={item.id}
                                                className="w-full text-left px-3 py-2 hover:bg-blue-50 text-sm"
                                                onClick={() => addItem(item)}
                                            >
                                                {item.name}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {items.length === 0 ? (
                            <div className="text-center py-8 border-2 border-dashed rounded-lg bg-gray-50 text-gray-400 italic">
                                Nenhum item adicionado ao pedido.
                            </div>
                        ) : (
                            <table className="w-full text-sm">
                                <thead className="text-gray-500 uppercase text-[10px] border-b">
                                    <tr>
                                        <th className="text-left pb-2 font-medium">Item</th>
                                        <th className="text-right pb-2 font-medium w-24">Qtd</th>
                                        <th className="text-left pb-2 font-medium w-20 px-2">UOM</th>
                                        <th className="text-right pb-2 font-medium w-32">Custo Unit.</th>
                                        <th className="text-right pb-2 font-medium w-32">Total</th>
                                        <th className="pb-2 w-10"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {items.map((item, idx) => (
                                        <tr key={idx} className="group">
                                            <td className="py-3 font-medium text-gray-900">{item.name}</td>
                                            <td className="py-3">
                                                <Input
                                                    type="number"
                                                    value={item.qty_display}
                                                    onChange={(e) => updateItem(idx, 'qty_display', e.target.value)}
                                                    className="h-8 text-right"
                                                />
                                            </td>
                                            <td className="py-3 px-2 text-gray-500 uppercase text-xs">{item.uom_label}</td>
                                            <td className="py-3">
                                                <Input
                                                    type="number"
                                                    value={item.unit_cost}
                                                    onChange={(e) => updateItem(idx, 'unit_cost', e.target.value)}
                                                    className="h-8 text-right"
                                                />
                                            </td>
                                            <td className="py-3 text-right font-mono text-gray-600">
                                                R$ {(item.qty_display * (item.unit_cost || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                            </td>
                                            <td className="py-3 text-right">
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    className="h-7 w-7 text-red-400 hover:text-red-600 hover:bg-red-50"
                                                    onClick={() => removeItem(idx)}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="border-t bg-gray-50">
                                    <tr>
                                        <td colSpan={4} className="py-3 text-right font-semibold">Total do Pedido:</td>
                                        <td className="py-3 text-right font-bold text-blue-600 text-lg">
                                            R$ {items.reduce((sum, i) => sum + (i.qty_display * (i.unit_cost || 0)), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </td>
                                        <td></td>
                                    </tr>
                                </tfoot>
                            </table>
                        )}
                    </div>

                    {/* Notes */}
                    <div className="space-y-2">
                        <Label>Observações</Label>
                        <Textarea
                            placeholder="Notas adicionais sobre o pedido..."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="h-20 resize-none"
                        />
                    </div>
                </div>

                <DialogFooter className="p-6 border-t bg-gray-50 gap-2 sm:gap-0">
                    <Button variant="ghost" onClick={onClose} disabled={loading}>
                        Cancelar
                    </Button>
                    <Button onClick={handleSubmit} disabled={loading} variant="primary">
                        {loading ? "Salvando..." : order ? "Atualizar Pedido" : "Criar Pedido"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
