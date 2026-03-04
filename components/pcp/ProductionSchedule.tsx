'use client'

import { useState, useEffect, useMemo } from "react"
import { createClient } from "@/lib/supabaseBrowser"
import { useCompany } from "@/contexts/CompanyContext"
import { Button } from "@/components/ui/Button"
import { Switch } from "@/components/ui/Switch"
import { Label } from "@/components/ui/Label"
import { useToast } from "@/components/ui/use-toast"
import { Badge } from "@/components/ui/Badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/Dialog"
import { Input } from "@/components/ui/Input"
import { Textarea } from "@/components/ui/Textarea"
import { Calendar as CalendarIcon, Plus, GripVertical, Play, CheckCircle2, XCircle, AlertTriangle, Pencil, Copy } from "lucide-react"
import { cn, todayInBrasilia, toDateInputValue } from "@/lib/utils"
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
import {
    calculateRecipeCount,
    computeCapacityState,
    computeRecipeCountWithFallback,
    formatRecipeCountLabel,
    RecipeCountWithFallbackResult,
} from "@/lib/pcp/work-order-metrics"
import {
    buildProductionDropId,
    computeWorkOrderMovePatch,
    parseProductionDropId,
} from "@/lib/pcp/production-schedule-dnd"

interface WorkOrder {
    id: string
    document_number: number | null
    planned_qty: number
    produced_qty: number
    status: 'planned' | 'in_progress' | 'done' | 'cancelled'
    scheduled_date: string
    notes?: string
    sector_id: string | null
    parent_work_order_id: string | null
    bom: {
        yield_qty: number
        yield_uom: string
        version: number
    } | null
    sector: {
        id: string
        name: string
        code: string
    } | null
    item: {
        id: string
        name: string
        uom: string
    }
}

interface WorkOrderQueryRow extends Omit<WorkOrder, 'item' | 'sector' | 'bom'> {
    item: WorkOrder['item'] | WorkOrder['item'][]
    sector: WorkOrder['sector'] | WorkOrder['sector'][]
    bom: WorkOrder['bom'] | WorkOrder['bom'][]
}

interface SectorFilterOption {
    id: string
    name: string
    code: string
    capacity_recipes: number | null
}

interface ItemProductionProfileBatchRow {
    item_id: string
    batch_size: number | null
}

interface NegativeStockItem {
    item_id: string
    item_name: string
    balance_after: number
    uom: string
}

interface ProductionLane {
    key: string
    sectorId: string | null
    name: string
    code: string
    capacityRecipes: number | null
    isUnassigned: boolean
    isInactive: boolean
    dropDisabled: boolean
}

interface LaneDayStats {
    plannedRecipesKnown: number
    indeterminateCount: number
    capacityRecipes: number | null
    percent: number | null
    state: 'OK' | 'NEAR_LIMIT' | 'EXCEEDED' | 'PARTIAL'
}

interface WorkOrderLink {
    id: string
    document_number: number | null
    item_name: string
    status: WorkOrder['status']
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
    const [sectors, setSectors] = useState<SectorFilterOption[]>([])
    const [profileBatchByItemId, setProfileBatchByItemId] = useState<Record<string, number | null>>({})

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
    const [dependencyLinks, setDependencyLinks] = useState<{ parent: WorkOrderLink | null, children: WorkOrderLink[] }>({ parent: null, children: [] })
    const [isDependencyLinksLoading, setIsDependencyLinksLoading] = useState(false)

    // Negative Stock Modal State
    const [negativeStockModal, setNegativeStockModal] = useState<{ isOpen: boolean, items: NegativeStockItem[], pendingStatus: string } | null>(null)

    // Generate dates EXACTLY like PlanningCalendar (store Date objects)
    const days = useMemo(() => {
        const weekDays: Date[] = []
        const curr = new Date(startDate)
        for (let i = 0; i < 7; i++) {
            weekDays.push(new Date(curr))
            curr.setDate(curr.getDate() + 1)
        }
        return weekDays
    }, [startDate])

    const fetchOrders = async () => {
        if (!selectedCompany) return
        setLoading(true)
        try {
            // Use ISO string for query to match PlanningCalendar logic
            const startStr = toDateInputValue(days[0])
            const endStr = toDateInputValue(days[6])

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
                    sector_id,
                    parent_work_order_id,
                    bom:bom_headers(yield_qty, yield_uom, version),
                    item:items!inner (id, name, uom),
                    sector:production_sectors(id, name, code, capacity_recipes)
                `)
                .eq('company_id', selectedCompany.id)
                .gte('scheduled_date', startStr)
                .lte('scheduled_date', endStr)
                .is('deleted_at', null)

            if (!showDone) {
                query = query.neq('status', 'done').neq('status', 'cancelled')
            }

            const [{ data, error }, { data: sectorsData, error: sectorsError }] = await Promise.all([
                query,
                supabase
                    .from('production_sectors')
                    .select('id, name, code, capacity_recipes')
                    .eq('company_id', selectedCompany.id)
                    .is('deleted_at', null)
                    .eq('is_active', true)
                    .order('name'),
            ])

            if (error) throw error
            if (sectorsError) throw sectorsError

            // Normalize item array/object return from Supabase
            const mapped: WorkOrder[] = ((data || []) as WorkOrderQueryRow[]).map((o) => ({
                ...o,
                item: Array.isArray(o.item) ? o.item[0] : o.item
                ,
                sector: Array.isArray(o.sector) ? o.sector[0] : o.sector,
                bom: Array.isArray(o.bom) ? o.bom[0] : o.bom
            }))

            setOrders(mapped)
            setSectors((sectorsData || []) as SectorFilterOption[])

            const itemIds = Array.from(new Set(mapped.map((order) => order.item.id)))
            if (itemIds.length > 0) {
                const { data: profilesData, error: profilesError } = await supabase
                    .from('item_production_profiles')
                    .select('item_id, batch_size')
                    .eq('company_id', selectedCompany.id)
                    .in('item_id', itemIds)

                if (profilesError) {
                    throw profilesError
                }

                const profileMap: Record<string, number | null> = {}
                for (const profile of (profilesData ?? []) as ItemProductionProfileBatchRow[]) {
                    profileMap[profile.item_id] = profile.batch_size
                }
                setProfileBatchByItemId(profileMap)
            } else {
                setProfileBatchByItemId({})
            }

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

    const lanes = useMemo<ProductionLane[]>(() => {
        const activeLanes: ProductionLane[] = sectors.map((sector) => ({
            key: sector.id,
            sectorId: sector.id,
            name: sector.name,
            code: sector.code,
            capacityRecipes: sector.capacity_recipes,
            isUnassigned: false,
            isInactive: false,
            dropDisabled: false,
        }))

        const activeSectorIds = new Set(activeLanes.map((lane) => lane.sectorId))
        const inactiveLanesMap = new Map<string, ProductionLane>()

        for (const order of orders) {
            if (!order.sector_id || activeSectorIds.has(order.sector_id)) {
                continue
            }
            if (!inactiveLanesMap.has(order.sector_id)) {
                inactiveLanesMap.set(order.sector_id, {
                    key: order.sector_id,
                    sectorId: order.sector_id,
                    name: order.sector?.name ?? 'Setor inativo',
                    code: order.sector?.code ?? 'INATIVO',
                    capacityRecipes: null,
                    isUnassigned: false,
                    isInactive: true,
                    dropDisabled: true,
                })
            }
        }

        const hasUnassigned = orders.some((order) => order.sector_id === null)
        const unassignedLane: ProductionLane[] = hasUnassigned
            ? [{
                key: 'unassigned',
                sectorId: null,
                name: 'Sem Setor',
                code: 'LEGADO',
                capacityRecipes: null,
                isUnassigned: true,
                isInactive: false,
                dropDisabled: false,
            }]
            : []

        return [...activeLanes, ...inactiveLanesMap.values(), ...unassignedLane]
    }, [orders, sectors])

    const recipeByOrderId = useMemo(() => {
        const map = new Map<string, RecipeCountWithFallbackResult>()
        for (const order of orders) {
            const metrics = computeRecipeCountWithFallback({
                plannedQty: order.planned_qty,
                bomYieldQty: order.bom?.yield_qty,
                profileBatchSize: profileBatchByItemId[order.item.id] ?? null,
            })
            map.set(order.id, metrics)
        }
        return map
    }, [orders, profileBatchByItemId])

    const ordersByLaneDay = useMemo(() => {
        const map = new Map<string, WorkOrder[]>()
        for (const order of orders) {
            const key = buildProductionDropId({
                sectorId: order.sector_id,
                scheduledDate: order.scheduled_date,
            })
            const bucket = map.get(key)
            if (bucket) {
                bucket.push(order)
            } else {
                map.set(key, [order])
            }
        }
        return map
    }, [orders])

    const laneDayStats = useMemo(() => {
        const map = new Map<string, LaneDayStats>()

        for (const lane of lanes) {
            for (const dateObj of days) {
                const scheduledDate = toDateInputValue(dateObj)
                const key = buildProductionDropId({ sectorId: lane.sectorId, scheduledDate })
                const laneOrders = ordersByLaneDay.get(key) ?? []

                let plannedRecipesKnown = 0
                let indeterminateCount = 0

                for (const order of laneOrders) {
                    if (!['planned', 'in_progress'].includes(order.status)) {
                        continue
                    }

                    const recipeMetrics = recipeByOrderId.get(order.id)
                    if (!recipeMetrics || recipeMetrics.kind === 'unknown') {
                        indeterminateCount += 1
                        continue
                    }

                    plannedRecipesKnown += recipeMetrics.recipes
                }

                const state = computeCapacityState({
                    plannedRecipesKnown,
                    capacityRecipes: lane.capacityRecipes,
                    indeterminateCount,
                })

                map.set(key, {
                    plannedRecipesKnown,
                    indeterminateCount,
                    capacityRecipes: lane.capacityRecipes,
                    percent: state.percent,
                    state: state.state,
                })
            }
        }

        return map
    }, [days, lanes, ordersByLaneDay, recipeByOrderId])


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
        const target = parseProductionDropId(String(over.id))
        if (!target) {
            return
        }

        const order = orders.find(o => o.id === orderId)
        if (!order) return

        let patch: { scheduledDate: string; sectorId: string | null } | null = null
        try {
            patch = computeWorkOrderMovePatch(
                {
                    id: order.id,
                    status: order.status,
                    scheduledDate: order.scheduled_date,
                    sectorId: order.sector_id,
                },
                target
            )
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Falha ao mover OP.'
            toast({ title: "Bloqueado", description: message, variant: "destructive" })
            return
        }

        if (!patch) return

        const sectorById = new Map(
            sectors.map((sector) => [sector.id, { id: sector.id, name: sector.name, code: sector.code }] as const)
        )

        // Optimistic Update
        const originalOrder = order
        setOrders(prev => prev.map((currentOrder) => {
            if (currentOrder.id !== orderId) {
                return currentOrder
            }

            return {
                ...currentOrder,
                scheduled_date: patch.scheduledDate,
                sector_id: patch.sectorId,
                sector: patch.sectorId ? (sectorById.get(patch.sectorId) ?? currentOrder.sector) : null,
            }
        }))

        try {
            await updateWorkOrderAction(orderId, {
                scheduled_date: patch.scheduledDate,
                sector_id: patch.sectorId,
            })
            const sectorMessage = patch.sectorId ? ' e setor atualizado' : ''
            toast({
                title: "Reagendado",
                description: `Ordem movida para ${new Date(patch.scheduledDate + 'T00:00:00').toLocaleDateString()}${sectorMessage}.`,
            })
            if (onRefreshRequest) onRefreshRequest()
        } catch (error) {
            console.error(error)
            // Revert
            setOrders(prev => prev.map(o => o.id === orderId ? originalOrder : o))
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

    const handleCopyTechnicalId = async (id: string) => {
        try {
            await navigator.clipboard.writeText(id)
            toast({ title: "Copiado", description: "ID técnico copiado para a área de transferência." })
        } catch (error) {
            console.error(error)
            toast({ title: "Erro", description: "Não foi possível copiar o ID técnico.", variant: "destructive" })
        }
    }

    const handleCreateClick = (date: string) => {
        setCreateDate(date)
        setIsCreateOpen(true)
    }

    const handleOrderClick = (order: WorkOrder) => {
        setSelectedOrder(order)
        setEditPlannedQty(order.planned_qty)
        setEditNotes(order.notes || "")
        void loadDependencyLinks(order.id)
        setIsEditOpen(true)
    }

    const loadDependencyLinks = async (workOrderId: string) => {
        if (!selectedCompany) return

        setIsDependencyLinksLoading(true)
        try {
            const [{ data: currentOrder, error: currentOrderError }, { data: childrenData, error: childrenError }] = await Promise.all([
                supabase
                    .from('work_orders')
                    .select(`
                        id,
                        document_number,
                        status,
                        parent_work_order_id,
                        item:items!work_orders_item_id_fkey(name)
                    `)
                    .eq('company_id', selectedCompany.id)
                    .eq('id', workOrderId)
                    .maybeSingle(),
                supabase
                    .from('work_orders')
                    .select(`
                        id,
                        document_number,
                        status,
                        item:items!work_orders_item_id_fkey(name)
                    `)
                    .eq('company_id', selectedCompany.id)
                    .eq('parent_work_order_id', workOrderId)
                    .is('deleted_at', null)
                    .order('created_at', { ascending: true }),
            ])

            if (currentOrderError) throw currentOrderError
            if (childrenError) throw childrenError
            if (!currentOrder) {
                setDependencyLinks({ parent: null, children: [] })
                return
            }

            const currentOrderParentId = currentOrder?.parent_work_order_id ?? null

            const parentLink = currentOrderParentId
                ? await supabase
                    .from('work_orders')
                    .select(`
                        id,
                        document_number,
                        status,
                        item:items!work_orders_item_id_fkey(name)
                    `)
                    .eq('company_id', selectedCompany.id)
                    .eq('id', currentOrderParentId)
                    .is('deleted_at', null)
                    .maybeSingle()
                : null

            if (parentLink?.error) throw parentLink.error

            const mapLink = (
                row: {
                    id: string
                    document_number: number | null
                    status: WorkOrder['status']
                    item: { name: string } | { name: string }[] | null
                }
            ): WorkOrderLink => ({
                id: row.id,
                document_number: row.document_number,
                status: row.status,
                item_name: Array.isArray(row.item) ? (row.item[0]?.name ?? '-') : (row.item?.name ?? '-'),
            })

            setDependencyLinks({
                parent: parentLink?.data ? mapLink(parentLink.data) : null,
                children: (childrenData || []).map((row) =>
                    mapLink(row as {
                        id: string
                        document_number: number | null
                        status: WorkOrder['status']
                        item: { name: string } | { name: string }[] | null
                    })
                ),
            })
        } catch (error) {
            console.error(error)
            setDependencyLinks({ parent: null, children: [] })
        } finally {
            setIsDependencyLinksLoading(false)
        }
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
            const normalizedReason =
                (reason && reason.trim()) ||
                (newStatus === 'done' ? editNotes.trim() : undefined)

            await changeWorkOrderStatusAction(selectedOrder.id, newStatus, normalizedReason)
            toast({ title: "Status Atualizado", description: `Ordem atualizada para ${newStatus}.` })
            setIsEditOpen(false)
            fetchOrders()
            if (onRefreshRequest) onRefreshRequest()
        } catch (error: unknown) {
            console.error(error)

            // Check if it's negative stock detection
            if (error instanceof Error && error.message === 'NEGATIVE_STOCK_DETECTED') {
                const maybeNegativeItems = (error as Error & { negativeItems?: NegativeStockItem[] }).negativeItems
                if (maybeNegativeItems) {
                    setNegativeStockModal({
                        isOpen: true,
                        items: maybeNegativeItems,
                        pendingStatus: newStatus
                    })
                    return
                }
            }

            const message = error instanceof Error ? error.message : "Falha na transição."
            toast({ title: "Erro", description: message, variant: "destructive" })
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
        } catch (error: unknown) {
            console.error(error)
            const message = error instanceof Error ? error.message : "Falha ao encerrar."
            toast({ title: "Erro", description: message, variant: "destructive" })
        }
    }

    // --- Render Helpers ---

    const activeOrder = activeId ? orders.find((order) => order.id === activeId) ?? null : null

    return (
        <>
            <div className="bg-white border-b border-gray-200 mt-6">
                <div className="flex items-center justify-between px-2 py-2 border-t bg-gray-50/50">
                    <h3 className="text-sm font-semibold flex items-center gap-2 text-slate-700">
                        <CalendarIcon className="w-4 h-4 text-slate-500" /> Agenda de Produção
                    </h3>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <Label htmlFor="show-done" className="text-xs text-slate-600">Exibir concluídas</Label>
                            <Switch id="show-done" checked={showDone} onCheckedChange={setShowDone} />
                        </div>
                    </div>
                </div>

                <DndContext
                    collisionDetection={closestCenter}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                >
                    <div className="flex flex-col border-t border-gray-200">
                        {lanes.length === 0 && !loading && (
                            <div className="px-4 py-8 text-sm text-gray-500">Nenhum setor ativo encontrado para exibir a agenda.</div>
                        )}

                        {lanes.map((lane) => (
                            <div key={lane.key} className="border-b border-gray-200 last:border-b-0">
                                <div className={cn(
                                    "px-3 py-2 flex items-center justify-between",
                                    lane.isUnassigned ? "bg-amber-50/50" : "bg-slate-50/50"
                                )}>
                                    <div className="flex items-center gap-2">
                                        <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                                            {lane.code}
                                        </span>
                                        <span className="text-sm font-semibold text-slate-800">{lane.name}</span>
                                        {lane.isUnassigned && (
                                            <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700 bg-amber-100/70">
                                                Legado sem setor
                                            </Badge>
                                        )}
                                        {lane.isInactive && (
                                            <Badge variant="outline" className="text-[10px] border-red-300 text-red-700 bg-red-100/70">
                                                Setor inativo
                                            </Badge>
                                        )}
                                    </div>
                                    {lane.isUnassigned ? (
                                        <p className="text-xs text-amber-700">Corrija atribuindo setor nas OPs legadas.</p>
                                    ) : (
                                        <p className="text-xs text-slate-500">Capacidade diária em receitas.</p>
                                    )}
                                </div>

                                <div className="grid grid-cols-7 gap-px bg-gray-200">
                                    {days.map((dateObj) => {
                                        const scheduledDate = toDateInputValue(dateObj)
                                        const dropId = buildProductionDropId({
                                            sectorId: lane.sectorId,
                                            scheduledDate,
                                        })
                                        const dayOrders = ordersByLaneDay.get(dropId) ?? []
                                        const stats = laneDayStats.get(dropId) ?? {
                                            plannedRecipesKnown: 0,
                                            indeterminateCount: 0,
                                            capacityRecipes: lane.capacityRecipes,
                                            percent: null,
                                            state: 'PARTIAL',
                                        }

                                        return (
                                            <DroppableDay
                                                key={`${lane.key}-${scheduledDate}`}
                                                dropId={dropId}
                                                dateObj={dateObj}
                                                dateStr={scheduledDate}
                                                orders={dayOrders}
                                                stats={stats}
                                                lane={lane}
                                                recipeByOrderId={recipeByOrderId}
                                                onCreate={() => handleCreateClick(scheduledDate)}
                                                onOrderClick={handleOrderClick}
                                                onDeleteClick={handleDeleteClick}
                                                inconsistentOrders={inconsistentOrders}
                                            />
                                        )
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>

                    <DragOverlay>
                        {activeOrder ? (
                            <OrderCard order={activeOrder} recipeMetrics={recipeByOrderId.get(activeOrder.id)} isOverlay />
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

            <Dialog open={isEditOpen} onOpenChange={(open) => {
                if (!open) {
                    setIsEditOpen(false)
                    setDependencyLinks({ parent: null, children: [] })
                }
            }}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>
                            {selectedOrder?.document_number
                                ? `OP #${selectedOrder.document_number}`
                                : `OP #${selectedOrder?.id.slice(0, 8)}`}
                        </DialogTitle>
                        <DialogDescription>
                            {selectedOrder?.item.name}
                        </DialogDescription>
                    </DialogHeader>

                    {selectedOrder && (
                        <div className="space-y-4 py-2">
                            <div className="space-y-1">
                                <Label>ID técnico (UUID)</Label>
                                <div className="h-10 flex items-center justify-between px-3 border rounded-2xl bg-gray-50 text-xs font-mono text-gray-700">
                                    <span className="truncate pr-2">{selectedOrder.id}</span>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 w-7 p-0"
                                        onClick={() => handleCopyTechnicalId(selectedOrder.id)}
                                        title="Copiar ID técnico"
                                    >
                                        <Copy className="w-3.5 h-3.5" />
                                    </Button>
                                </div>
                            </div>

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
                                    <Label>Nº de Receitas</Label>
                                    <div className="h-10 flex items-center px-3 border rounded-2xl bg-gray-50 text-sm font-medium">
                                        {formatRecipeCountLabel(calculateRecipeCount(Number(editPlannedQty || 0), selectedOrder.bom?.yield_qty))}
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label>Status</Label>
                                    <div className="h-10 flex items-center px-3 border rounded-2xl bg-gray-50 text-sm font-medium">
                                        {selectedOrder.status === 'planned' && "Planejada"}
                                        {selectedOrder.status === 'in_progress' && "Em Produção"}
                                        {selectedOrder.status === 'done' && "Concluída"}
                                        {selectedOrder.status === 'cancelled' && "Cancelada"}
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <Label>Rendimento da Receita</Label>
                                    <div className="h-10 flex items-center px-3 border rounded-2xl bg-gray-50 text-sm font-medium text-gray-700">
                                        {selectedOrder.bom
                                            ? `${selectedOrder.bom.yield_qty} ${selectedOrder.bom.yield_uom}`
                                            : "Sem receita"}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <Label>Setor</Label>
                                <div className="h-10 flex items-center px-3 border rounded-2xl bg-gray-50 text-sm font-medium text-gray-700">
                                    {selectedOrder.sector ? `${selectedOrder.sector.code} - ${selectedOrder.sector.name}` : "Sem setor"}
                                </div>
                            </div>

                            <div className="space-y-1 rounded-2xl border border-gray-200 bg-gray-50 p-3">
                                <Label>Dependências de OP</Label>
                                {isDependencyLinksLoading ? (
                                    <div className="text-xs text-gray-500">Carregando vínculos...</div>
                                ) : (
                                    <div className="space-y-1 text-xs text-gray-700">
                                        <div>
                                            OP mãe: {dependencyLinks.parent
                                                ? `#${dependencyLinks.parent.document_number ?? dependencyLinks.parent.id.slice(0, 8)} • ${dependencyLinks.parent.item_name}`
                                                : "Não possui"}
                                        </div>
                                        <div>
                                            OPs dependentes: {dependencyLinks.children.length > 0
                                                ? dependencyLinks.children
                                                    .map((child) => `#${child.document_number ?? child.id.slice(0, 8)} • ${child.item_name}`)
                                                    .join(' | ')
                                                : "Nenhuma"}
                                        </div>
                                    </div>
                                )}
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

function formatPercent(value: number | null): string {
    if (value === null) {
        return '-'
    }
    return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(value * 100)}%`
}

function DroppableDay({
    dropId,
    dateObj,
    dateStr,
    lane,
    orders,
    stats,
    recipeByOrderId,
    onCreate,
    onOrderClick,
    onDeleteClick,
    inconsistentOrders,
}: {
    dropId: string
    dateObj: Date
    dateStr: string
    lane: ProductionLane
    orders: WorkOrder[]
    stats: LaneDayStats
    recipeByOrderId: Map<string, RecipeCountWithFallbackResult>
    onCreate: () => void
    onOrderClick: (o: WorkOrder) => void
    onDeleteClick: (id: string) => void
    inconsistentOrders: Set<string>
}) {
    const { isOver, setNodeRef } = useDroppable({ id: dropId, disabled: lane.dropDisabled })
    const isToday = todayInBrasilia() === dateStr

    const stateBadgeClass = {
        OK: 'border-emerald-200 bg-emerald-50 text-emerald-700',
        NEAR_LIMIT: 'border-amber-200 bg-amber-50 text-amber-700',
        EXCEEDED: 'border-red-200 bg-red-50 text-red-700',
        PARTIAL: 'border-slate-200 bg-slate-100 text-slate-700',
    }[stats.state]

    return (
        <div
            ref={setNodeRef}
            className={cn(
                "bg-white p-2 min-h-44 cursor-pointer transition-all flex flex-col justify-between group",
                isOver && !lane.dropDisabled ? "bg-blue-50 ring-inset ring-2 ring-blue-300" : "",
                lane.dropDisabled ? "bg-slate-50/50" : "",
                isToday ? "bg-slate-50/50" : ""
            )}
        >
            <div className="flex items-start justify-between mb-2">
                <span className="text-xs text-gray-500 font-medium">
                    {dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                </span>
                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button size="sm" variant="ghost" onClick={onCreate} className="h-6 w-6 p-0">
                        <Plus className="h-3 w-3 text-gray-400" />
                    </Button>
                </div>
            </div>

            <div className="mb-2 rounded-xl border border-slate-200 bg-slate-50/70 px-2 py-1.5">
                <div className="text-[10px] text-slate-600">
                    Planejado <span className="font-semibold">{stats.plannedRecipesKnown}</span> / Capacidade{' '}
                    <span className="font-semibold">
                        {stats.capacityRecipes ?? '-'}
                    </span>
                </div>
                <div className="mt-1 flex items-center justify-between gap-2">
                    <Badge variant="outline" className={cn("h-4 px-1 text-[9px] font-semibold", stateBadgeClass)}>
                        {stats.state === 'OK' && 'OK'}
                        {stats.state === 'NEAR_LIMIT' && 'No limite'}
                        {stats.state === 'EXCEEDED' && 'Excedido'}
                        {stats.state === 'PARTIAL' && 'Parcial'}
                    </Badge>
                    <span className="text-[10px] font-semibold text-slate-600">{formatPercent(stats.percent)}</span>
                </div>
                {stats.indeterminateCount > 0 && (
                    <div className="mt-1 text-[9px] text-slate-500">
                        Indeterminadas: {stats.indeterminateCount}
                    </div>
                )}
            </div>

            <div className="flex flex-col gap-1.5 flex-1 relative">
                {orders.map((order) => (
                    <DraggableOrder
                        key={order.id}
                        order={order}
                        recipeMetrics={recipeByOrderId.get(order.id)}
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

function DraggableOrder({
    order,
    recipeMetrics,
    onClick,
    onDelete,
    isInconsistent,
}: {
    order: WorkOrder
    recipeMetrics?: RecipeCountWithFallbackResult
    onClick?: () => void
    onDelete?: () => void
    isInconsistent?: boolean
}) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: order.id,
        disabled: order.status !== 'planned' // Only planned can be dragged
    })

    const style = transform ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        zIndex: 999
    } : undefined

    if (isDragging) {
        return (
            <div ref={setNodeRef} style={style} className="opacity-50">
                <OrderCard order={order} recipeMetrics={recipeMetrics} isInconsistent={isInconsistent} />
            </div>
        )
    }

    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
            <OrderCard
                order={order}
                recipeMetrics={recipeMetrics}
                onClick={onClick}
                onDelete={onDelete}
                isInconsistent={isInconsistent}
            />
        </div>
    )
}

function OrderCard({
    order,
    recipeMetrics,
    isOverlay,
    onClick,
    onDelete,
    isInconsistent,
}: {
    order: WorkOrder
    recipeMetrics?: RecipeCountWithFallbackResult
    isOverlay?: boolean
    onClick?: () => void
    onDelete?: () => void
    isInconsistent?: boolean
}) {
    const recipeLabel = recipeMetrics && recipeMetrics.kind !== 'unknown'
        ? formatRecipeCountLabel(recipeMetrics.recipes)
        : formatRecipeCountLabel(calculateRecipeCount(order.planned_qty, order.bom?.yield_qty))

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
            <div className="mt-0.5 flex items-center gap-1 text-[10px] text-slate-500">
                {order.sector && <span className="inline-flex rounded-full bg-slate-100 px-1.5 py-0.5">{order.sector.code}</span>}
                {order.parent_work_order_id && <span className="inline-flex rounded-full bg-amber-50 px-1.5 py-0.5 text-amber-700">Filha</span>}
                {recipeMetrics?.kind === 'unknown' && (
                    <span className="inline-flex rounded-full bg-slate-100 px-1.5 py-0.5 text-slate-600">Receita indeterminada</span>
                )}
            </div>
            <div className="flex justify-between items-center text-[10px] text-slate-500 mt-1">
                <span>{order.planned_qty} {order.item.uom}</span>
                <span className="font-medium text-slate-600">{recipeLabel}</span>
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
