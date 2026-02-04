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
import { Card, CardContent } from "@/components/ui/Card"
import { Plus, Trash2, Search, Zap } from "lucide-react"
import { createPurchaseOrderAction, receivePurchaseOrderAction } from "@/app/actions/purchases"
import { useToast } from "@/components/ui/use-toast"
import { createClient } from "@/utils/supabase/client"

interface QuickEntryModalProps {
    isOpen: boolean
    onClose: () => void
    onSuccess: () => void
}

export function QuickEntryModal({ isOpen, onClose, onSuccess }: QuickEntryModalProps) {
    const { toast } = useToast()
    const supabase = createClient()
    const [loading, setLoading] = useState(false)

    // Form State
    const [supplierId, setSupplierId] = useState("")
    const [suppliers, setSuppliers] = useState<any[]>([])
    const [searchItem, setSearchItem] = useState("")
    const [items, setItems] = useState<any[]>([])
    const [availableItems, setAvailableItems] = useState<any[]>([])

    useEffect(() => {
        if (isOpen) {
            fetchSuppliers()
            fetchItems()
            setSupplierId("")
            setItems([])
            setSearchItem("")
        }
    }, [isOpen])

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
            // 1. Create the order
            const payload = {
                supplier_id: supplierId || null,
                notes: "Entrada Rápida",
                items: items.map(item => ({
                    item_id: item.item_id,
                    qty_display: Number(item.qty_display),
                    uom_label: item.uom_label,
                    conversion_factor: 1,
                    unit_cost: Number(item.unit_cost) || null
                }))
            }

            const { data: po } = await createPurchaseOrderAction(payload)

            // 2. Immediately receive it to generate movements
            if (po?.id) {
                await receivePurchaseOrderAction(po.id)
                toast({ title: "Entrada registrada e estoque atualizado!" })
            }

            onSuccess()
            onClose()
        } catch (error: any) {
            console.error(error)
            toast({ title: "Erro na entrada rápida", description: error.message, variant: "destructive" })
        } finally {
            setLoading(false)
        }
    }

    const filteredItems = availableItems.filter(i => i.name.toLowerCase().includes(searchItem.toLowerCase()))

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold flex items-center gap-2 text-orange-600">
                        <Zap className="w-5 h-5 fill-orange-600" />
                        Entrada Rápida (Estoque)
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>Fornecedor (Opcional)</Label>
                        <select
                            className="w-full h-10 rounded-2xl border border-input bg-background px-3 py-2 text-sm"
                            value={supplierId}
                            onChange={(e) => setSupplierId(e.target.value)}
                        >
                            <option value="">Compra Avulsa / Diversos</option>
                            {suppliers.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-4">
                        <div className="flex justify-between items-center border-b pb-2">
                            <Label className="font-semibold">Itens Recebidos</Label>
                            <div className="relative w-48">
                                <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-gray-400" />
                                <Input
                                    placeholder="Buscar item..."
                                    className="pl-7 h-8 text-xs"
                                    value={searchItem}
                                    onChange={(e) => setSearchItem(e.target.value)}
                                />
                                {searchItem && filteredItems.length > 0 && (
                                    <Card className="absolute z-10 w-full mt-1 shadow-float max-h-40 overflow-y-auto">
                                        {filteredItems.map(item => (
                                            <button
                                                key={item.id}
                                                className="w-full text-left px-2 py-1.5 hover:bg-orange-50 text-xs"
                                                onClick={() => addItem(item)}
                                            >
                                                {item.name}
                                            </button>
                                        ))}
                                    </Card>
                                )}
                            </div>
                        </div>

                        <div className="max-h-72 overflow-y-auto pr-1">
                            {items.length === 0 ? (
                                <div className="text-center py-6 text-gray-400 text-sm italic">
                                    Busque e selecione itens acima.
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {items.map((item, idx) => (
                                        <Card key={idx}>
                                            <CardContent className="p-2 flex gap-2 items-center">
                                                <div className="flex-1 font-medium text-sm truncate">{item.name}</div>
                                                <div className="w-20">
                                                    <Input
                                                        type="number"
                                                        value={item.qty_display}
                                                        onChange={(e) => updateItem(idx, 'qty_display', e.target.value)}
                                                        className="h-8 text-right text-xs"
                                                        placeholder="Qtd"
                                                    />
                                                </div>
                                                <div className="w-12 text-[10px] text-gray-500 uppercase">{item.uom_label}</div>
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    className="h-7 w-7 text-red-400 hover:text-red-600 p-0"
                                                    onClick={() => removeItem(idx)}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <DialogFooter className="bg-gray-50 p-4 rounded-2xl gap-2">
                    <Button variant="ghost" onClick={onClose} disabled={loading}>
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={loading || items.length === 0}
                        className="bg-orange-600 hover:bg-orange-700"
                    >
                        {loading ? "Processando..." : "Confirmar Entrada de Estoque"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
