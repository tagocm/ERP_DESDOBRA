'use client'

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabaseBrowser"
import { useCompany } from "@/contexts/CompanyContext"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Switch } from "@/components/ui/Switch"
import { Label } from "@/components/ui/Label"
import { useToast } from "@/components/ui/use-toast"
import { Badge } from "@/components/ui/Badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/Dialog"
import { Input } from "@/components/ui/Input"
import { Textarea } from "@/components/ui/Textarea"
import { Calendar as CalendarIcon, Plus, GripVertical, Play, CheckCircle2, XCircle, AlertTriangle, Pencil } from "lucide-react"
import { cn } from "@/lib/utils"
import {
    DndContext,
    DragOverlay,
    useDraggable,
    useDroppable,
    DragEndEvent,
    DragStartEvent,
    closestCenter
} from "@dnd-kit/core"
import { NewWorkOrderModal } from "@/components/pcp/NewWorkOrderModal"
import { NegativeStockConfirmationModal } from "@/components/pcp/NegativeStockConfirmationModal"
import { updateWorkOrderAction, changeWorkOrderStatusAction, deleteWorkOrderAction } from "@/app/actions/pcp-planning"

interface WorkOrder {
    id: string
    document_number: number
    planned_qty: number
    produced_qty: number
    status: 'planned' | 'in_progress' | 'done' | 'cancelled'
    scheduled_date: string
    notes?: string
    item: {
        id: string
        name: string
        uom: string
    }
}

interface ProductionScheduleProps {
    startDate: Date
    onRefreshRequest?: () => void
}

export function ProductionSchedule({ startDate, onRefreshRequest }: ProductionScheduleProps) {
    const { selectedCompany } = useCompany()
    const supabase = createClient()
    const { toast } = useToast()

    const [orders, setOrders] = useState<WorkOrder[]>([])
    const [loading, setLoading] = useState(false)
    const [showDone, setShowDone] = useState(false)
    const [inconsistentOrders, setInconsistentOrders] = useState<Set<string>>(new Set())

    // Drag State
    const [activeId, setActiveId] = useState<string | null>(null)

    // Create Modal State
    const [isCreateOpen, setIsCreateOpen] = useState(false)
    const [createDate, setCreateDate] = useState<string>("")

    // Edit/Action Modal State
    const [selectedOrder, setSelectedOrder] = useState<WorkOrder | null>(null)
    const [isEditOpen, setIsEditOpen] = useState(false)
    const [editPlannedQty, setEditPlannedQty] = useState<number | string>("")
    const [editNotes, setEditNotes] = useState("")

    // Negative Stock Modal State
    const [negativeStockModal, setNegativeStockModal] = useState<{ isOpen: boolean, items: any[], pendingStatus: string } | null>(null)

    // Generate dates EXACTLY like PlanningCalendar (store Date objects)
    const days: Date[] = []
    const curr = new Date(startDate)
    for (let i = 0; i < 7; i++) {
        days.push(new Date(curr))
        curr.setDate(curr.getDate() + 1)
    }

    const fetchOrders = async () => {
        if (!selectedCompany) return
        setLoading(true)
        try {
            // Use ISO string for query to match PlanningCalendar logic
            const startStr = days[0].toISOString().split('T')[0]
            const endStr = days[6].toISOString().split('T')[0]

            let query = supabase
                .from('work_orders')
                .select(`
                    id,
                    document_number,
                    planned_qty,
                    produced_qty,
                    status,
                    scheduled_date,
                    notes,
                    item:items!inner (id, name, uom, type)
                `)
                .eq('company_id', selectedCompany.id)
                .gte('scheduled_date', startStr)
                .lte('scheduled_date', endStr)
                .is('deleted_at', null)
                .eq('item.type', 'finished_good')

            if (!showDone) {
                query = query.neq('status', 'done').neq('status', 'cancelled')
            }

            const { data, error } = await query

            if (error) throw error

            // Normalize item array/object return from Supabase
            const mapped: WorkOrder[] = (data || []).map((o: any) => ({
                ...o,
                item: Array.isArray(o.item) ? o.item[0] : o.item
            }))

            setOrders(mapped)

            // Fetch audit logs to identify inconsistent orders (closed with negative stock)
            const { data: auditData } = await supabase
                .from('audit_logs')
                .select('entity_id')
                .eq('company_id', selectedCompany.id)
                .eq('entity_type', 'work_orders')
                .eq('action', 'close_work_order_with_negative_stock')
                .in('entity_id', mapped.map(o => o.id))

            const inconsistent = new Set(auditData?.map(a => a.entity_id) || [])
            setInconsistentOrders(inconsistent)
        } catch (error) {
            console.error(error)
            toast({ title: "Erro", description: "Falha ao carregar agenda.", variant: "destructive" })
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchOrders()
    }, [startDate, selectedCompany, showDone])


    // --- Actions ---

    // ... (keep actions same, just skip listing them here as they are unchanged)

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string)
    }

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event
        setActiveId(null)

        if (!over) return

        const orderId = active.id as string
        const newDate = over.id as string // Droppable ID is the date string

        const order = orders.find(o => o.id === orderId)
        if (!order) return

        if (order.scheduled_date === newDate) return
        if (order.status !== 'planned') {
            toast({ title: "Bloqueado", description: "Apenas OPs planejadas podem ser reagendadas.", variant: "destructive" })
            return
        }

        // Optimistic Update
        const originalDate = order.scheduled_date
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, scheduled_date: newDate } : o))

        try {
            await updateWorkOrderAction(orderId, { scheduled_date: newDate })
            toast({ title: "Reagendado", description: `Ordem movida para ${new Date(newDate + 'T00:00:00').toLocaleDateString()}.` })
            if (onRefreshRequest) onRefreshRequest()
        } catch (error) {
            console.error(error)
            // Revert
            setOrders(prev => prev.map(o => o.id === orderId ? { ...o, scheduled_date: originalDate } : o))
            toast({ title: "Erro", description: "Falha ao reagendar.", variant: "destructive" })
        }
    }

    // Delete State
    const [orderToDelete, setOrderToDelete] = useState<string | null>(null)

    // Delete Action
    const confirmDeleteOrder = async () => {
        if (!orderToDelete) return

        const orderId = orderToDelete
        setOrderToDelete(null) // Close modal immediately

        // Optimistic remove
        const previous = orders
        setOrders(prev => prev.filter(o => o.id !== orderId))

        try {
            await deleteWorkOrderAction(orderId)
            toast({ title: "Excluído", description: "Ordem de produção removida." })
            if (onRefreshRequest) onRefreshRequest()
        } catch (error) {
            console.error(error)
            setOrders(previous) // Revert
            toast({ title: "Erro", description: "Falha ao excluir ordem.", variant: "destructive" })
        }
    }

    const handleDeleteClick = (orderId: string) => {
        setOrderToDelete(orderId)
    }

    const handleCreateClick = (date: string) => {
        setCreateDate(date)
        setIsCreateOpen(true)
    }

    const handleOrderClick = (order: WorkOrder) => {
        setSelectedOrder(order)
        setEditPlannedQty(order.planned_qty)
        setEditNotes(order.notes || "")
        setIsEditOpen(true)
    }

    const handleUpdateOrder = async () => {
        if (!selectedOrder) return
        const newQty = Number(editPlannedQty)

        if (selectedOrder.status === 'planned' && (newQty <= 0 || isNaN(newQty))) {
            toast({ title: "Inválido", description: "Quantidade deve ser maior que zero.", variant: "destructive" })
            return
        }

        try {
            await updateWorkOrderAction(selectedOrder.id, {
                planned_qty: selectedOrder.status === 'planned' ? newQty : undefined,
                notes: editNotes
            })
            toast({ title: "Atualizado", description: "Dados salvos." })
            setIsEditOpen(false)
            fetchOrders()
            if (onRefreshRequest) onRefreshRequest()
        } catch (error) {
            console.error(error)
            toast({ title: "Erro", description: "Falha ao atualizar.", variant: "destructive" })
        }
    }

    // ... (rest of actions status params etc)

    const handleStatusParams = async (newStatus: string, reason?: string) => {
        if (!selectedOrder) return
        try {
            await changeWorkOrderStatusAction(selectedOrder.id, newStatus, reason)
            toast({ title: "Status Atualizado", description: `Ordem atualizada para ${newStatus}.` })
            setIsEditOpen(false)
            fetchOrders()
            if (onRefreshRequest) onRefreshRequest()
        } catch (error: any) {
            console.error(error)

            // Check if it's negative stock detection
            if (error.message === 'NEGATIVE_STOCK_DETECTED' && error.negativeItems) {
                setNegativeStockModal({
                    isOpen: true,
                    items: error.negativeItems,
                    pendingStatus: newStatus
                })
                return
            }

            toast({ title: "Erro", description: error.message || "Falha na transição.", variant: "destructive" })
        }
    }

    const handleNegativeStockConfirm = async (reason: string, note: string) => {
        if (!selectedOrder || !negativeStockModal) return

        try {
            await changeWorkOrderStatusAction(
                selectedOrder.id,
                negativeStockModal.pendingStatus,
                undefined,
                true, // negativeStockConfirmed
                reason,
                note
            )
            toast({ title: "Encerrado", description: "Ordem encerrada com registro de estoque negativo." })
            setNegativeStockModal(null)
            setIsEditOpen(false)
            fetchOrders()
            if (onRefreshRequest) onRefreshRequest()
        } catch (error: any) {
            console.error(error)
            toast({ title: "Erro", description: error.message || "Falha ao encerrar.", variant: "destructive" })
        }
    }

    // --- Render Helpers ---

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'planned': return 'bg-white border-slate-200 text-slate-700 hover:border-blue-300'
            case 'in_progress': return 'bg-blue-50 border-blue-200 text-blue-700'
            case 'done': return 'bg-green-50 border-green-200 text-green-700 opacity-75'
            case 'cancelled': return 'bg-red-50 border-red-200 text-red-700 opacity-60'
            default: return 'bg-gray-100'
        }
    }

    return (
        <>
            <div className="bg-white border-b border-gray-200 mt-6">
                <div className="flex items-center justify-between px-2 py-2 border-t bg-gray-50/50">
                    <h3 className="text-sm font-semibold flex items-center gap-2 text-slate-700">
                        <CalendarIcon className="w-4 h-4 text-slate-500" /> Agenda de Produção
                    </h3>
                </div>

                <DndContext
                    collisionDetection={closestCenter}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                >
                    <div className="grid grid-cols-7 gap-px bg-gray-200 border-t">
                        {days.map(date => {
                            const dateStr = date.toISOString().split('T')[0]
                            return (
                                <DroppableDay
                                    key={dateStr}
                                    dateObj={date}
                                    dateStr={dateStr}
                                    orders={orders.filter(o => o.scheduled_date === dateStr)}
                                    onCreate={() => handleCreateClick(dateStr)}
                                    onOrderClick={handleOrderClick}
                                    onDeleteClick={handleDeleteClick}
                                    inconsistentOrders={inconsistentOrders}
                                />
                            )
                        })}
                    </div>

                    <DragOverlay>
                        {activeId ? (
                            <OrderCard order={orders.find(o => o.id === activeId)!} isOverlay />
                        ) : null}
                    </DragOverlay>
                </DndContext>
            </div>

            <NewWorkOrderModal
                isOpen={isCreateOpen}
                initialDate={createDate}
                onClose={() => setIsCreateOpen(false)}
                onSuccess={() => {
                    fetchOrders()
                    if (onRefreshRequest) onRefreshRequest()
                }}
            />

            <Dialog open={isEditOpen} onOpenChange={(open) => !open && setIsEditOpen(false)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Detalhes da Ordem</DialogTitle>
                        <DialogDescription>
                            {selectedOrder?.document_number
                                ? `#${selectedOrder.document_number.toString().padStart(4, '0')}`
                                : `#${selectedOrder?.id.slice(0, 8)}`} • {selectedOrder?.item.name}
                        </DialogDescription>
                    </DialogHeader>

                    {selectedOrder && (
                        <div className="space-y-4 py-2">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label>Qtd. Planejada</Label>
                                    <Input
                                        type="number"
                                        value={editPlannedQty}
                                        onChange={e => setEditPlannedQty(e.target.value)}
                                        disabled={selectedOrder.status !== 'planned'}
                                        className="text-right"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label>Status</Label>
                                    <div className="h-10 flex items-center px-3 border rounded-2xl bg-gray-50 text-sm font-medium">
                                        {selectedOrder.status === 'planned' && "Planejada"}
                                        {selectedOrder.status === 'in_progress' && "Em Produção"}
                                        {selectedOrder.status === 'done' && "Concluída"}
                                        {selectedOrder.status === 'cancelled' && "Cancelada"}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <Label>Observações</Label>
                                <Textarea
                                    value={editNotes}
                                    onChange={e => setEditNotes(e.target.value)}
                                    placeholder="Adicionar notas..."
                                    className="h-20"
                                />
                            </div>

                            <div className="flex justify-between items-center pt-2">
                                {/* Action Buttons */}
                                {selectedOrder.status === 'planned' && (
                                    <div className="flex gap-2">
                                        <Button variant="outline" size="sm" onClick={() => handleStatusParams('in_progress')} className="text-blue-600 border-blue-200 bg-blue-50/50 hover:bg-blue-100">
                                            <Play className="w-4 h-4 mr-2" /> Iniciar
                                        </Button>
                                        <Button variant="ghost" size="sm" onClick={() => handleStatusParams('cancelled')} className="text-red-500 hover:text-red-700 hover:bg-red-50">
                                            Cancelar
                                        </Button>
                                    </div>
                                )}
                                {selectedOrder.status === 'in_progress' && (
                                    <div className="flex gap-2">
                                        <Button variant="outline" size="sm" onClick={() => handleStatusParams('done')} className="text-green-600 border-green-200 bg-green-50/50 hover:bg-green-100">
                                            <CheckCircle2 className="w-4 h-4 mr-2" /> Encerrar
                                        </Button>
                                        <Button variant="ghost" size="sm" onClick={() => handleStatusParams('cancelled')} className="text-red-500 hover:text-red-700 hover:bg-red-50">
                                            Cancelar
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setIsEditOpen(false)}>Fechar</Button>
                        <Button onClick={handleUpdateOrder}>Salvar Alterações</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Custom Delete Confirmation Modal */}
            <Dialog open={!!orderToDelete} onOpenChange={(open) => !open && setOrderToDelete(null)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-red-600 flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5" /> Confirmar Exclusão
                        </DialogTitle>
                        <DialogDescription>
                            Tem certeza que deseja excluir esta ordem de produção? Esta ação não pode ser desfeita.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="ghost" onClick={() => setOrderToDelete(null)}>Cancelar</Button>
                        <Button variant="danger" onClick={confirmDeleteOrder} className="bg-red-600 hover:bg-red-700">
                            Excluir Ordem
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Negative Stock Confirmation Modal */}
            {negativeStockModal && (
                <NegativeStockConfirmationModal
                    isOpen={negativeStockModal.isOpen}
                    onClose={() => setNegativeStockModal(null)}
                    onConfirm={handleNegativeStockConfirm}
                    negativeItems={negativeStockModal.items}
                />
            )}
        </>
    )
}

// --- Sub Components ---

function DroppableDay({ dateObj, dateStr, orders, onCreate, onOrderClick, onDeleteClick, inconsistentOrders }: {
    dateObj: Date,
    dateStr: string,
    orders: WorkOrder[],
    onCreate: () => void,
    onOrderClick: (o: WorkOrder) => void,
    onDeleteClick: (id: string) => void,
    inconsistentOrders: Set<string>
}) {
    const { isOver, setNodeRef } = useDroppable({ id: dateStr })

    // Formatting from PlanningCalendar: 
    // const isToday = new Date().toISOString().split('T')[0] === dateStr

    const isToday = new Date().toISOString().split('T')[0] === dateStr

    return (
        <div
            ref={setNodeRef}
            className={cn(
                "bg-white p-2 min-h-40 cursor-pointer transition-all flex flex-col justify-between group",
                isOver ? "bg-blue-50 ring-inset ring-2 ring-blue-300" : "",
                isToday ? "bg-slate-50/50" : ""
            )}
        >
            {/* Header matching PlanningCalendar */}
            <div className="flex items-start justify-between mb-2">
                <span className="text-xs text-gray-400">
                    {dateObj.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}
                </span>
                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button size="sm" variant="ghost" onClick={onCreate} className="h-6 w-6 p-0">
                        <Plus className="h-3 w-3 text-gray-400" />
                    </Button>
                </div>
            </div>

            <div className="flex flex-col gap-1.5 flex-1 relative">
                {orders.map(order => (
                    <DraggableOrder
                        key={order.id}
                        order={order}
                        onClick={() => onOrderClick(order)}
                        onDelete={() => onDeleteClick(order.id)}
                        isInconsistent={inconsistentOrders.has(order.id)}
                    />
                ))}

                {orders.length === 0 && !isOver && (
                    <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-[10px] text-slate-300 text-center italic pointer-events-none">
                        Sem OPs
                    </div>
                )}
            </div>
        </div>
    )
}

function DraggableOrder({ order, onClick, onDelete, isInconsistent }: { order: WorkOrder, onClick?: () => void, onDelete?: () => void, isInconsistent?: boolean }) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: order.id,
        disabled: order.status !== 'planned' // Only planned can be dragged
    })

    const style = transform ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        zIndex: 999
    } : undefined

    if (isDragging) {
        return <div ref={setNodeRef} style={style} className="opacity-50"><OrderCard order={order} isInconsistent={isInconsistent} /></div>
    }

    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
            <OrderCard order={order} onClick={onClick} onDelete={onDelete} isInconsistent={isInconsistent} />
        </div>
    )
}

function OrderCard({ order, isOverlay, onClick, onDelete, isInconsistent }: { order: WorkOrder, isOverlay?: boolean, onClick?: () => void, onDelete?: () => void, isInconsistent?: boolean }) {
    const statusColor = {
        planned: "bg-white border-l-4 border-l-blue-400 shadow-card",
        in_progress: "bg-blue-50 border-l-4 border-l-blue-600 shadow-card",
        done: "bg-green-50 border-1 border-green-200 opacity-60 grayscale",
        cancelled: "bg-gray-50 border-1 border-gray-200 opacity-50 line-through"
    }[order.status]

    return (
        <div
            onClick={onClick}
            className={cn(
                "p-2 rounded-2xl text-xs border cursor-grab active:cursor-grabbing hover:shadow-card transition-shadow relative overflow-hidden",
                statusColor,
                isOverlay ? "shadow-float scale-105 rotate-2" : ""
            )}
        >
            <div className="font-semibold truncate pr-4">{order.item.name}</div>
            <div className="flex justify-between items-center text-[10px] text-slate-500 mt-1">
                <span>{order.planned_qty} {order.item.uom}</span>
                <div className="flex gap-1 items-center">
                    {isInconsistent && (
                        <Badge variant="outline" className="text-[8px] h-4 px-1 border-red-500 text-red-700 bg-red-50 font-bold">
                            INCONSISTENTE
                        </Badge>
                    )}
                    <button
                        className="bg-transparent text-slate-400 hover:text-blue-500 rounded-2xl p-0.5 hover:bg-slate-100 transition-colors z-10"
                        onPointerDown={e => e.stopPropagation()}
                        onClick={(e) => {
                            e.stopPropagation()
                            if (onClick) onClick()
                        }}
                    >
                        <Pencil className="w-3.5 h-3.5" />
                    </button>
                    {order.status === 'planned' && onDelete && (
                        <button
                            className="bg-transparent text-slate-400 hover:text-red-500 rounded-2xl p-0.5 hover:bg-slate-100 transition-colors z-10"
                            onPointerDown={e => e.stopPropagation()}
                            onClick={(e) => {
                                e.stopPropagation()
                                onDelete()
                            }}
                        >
                            <XCircle className="w-3.5 h-3.5" />
                        </button>
                    )}
                    {order.status === 'planned' && <GripVertical className="w-3 h-3 text-slate-300" />}
                </div>
            </div>
        </div>
    )
}
