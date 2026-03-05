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
import { Checkbox } from "@/components/ui/Checkbox"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/Tooltip"
import { Calendar as CalendarIcon, Plus, GripVertical, Play, CheckCircle2, XCircle, AlertTriangle, Pencil, Copy, ArrowUp, ChevronDown } from "lucide-react"
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
import {
    allocateOrdersWithCapacity,
    moveQueueCardBefore,
    sortUnscheduledQueueByEmission,
} from "@/lib/pcp/production-overflow"

interface WorkOrder {
    id: string
    document_number: number | null
    created_at: string
    planned_qty: number
    produced_qty: number
    status: 'planned' | 'in_progress' | 'done' | 'cancelled'
    scheduled_date: string | null
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

interface DisplayOrderCard {
    cardId: string
    sourceOrderId: string
    order: WorkOrder
    scheduledDate: string
    plannedQty: number
    recipeMetrics: RecipeCountWithFallbackResult
    allocatedRecipes: number | null
    totalRecipes: number | null
    isSplit: boolean
    startsFromPreviousDay: boolean
    continuesToNextDay: boolean
}

interface WorkOrderLink {
    id: string
    document_number: number | null
    item_name: string
    status: WorkOrder['status']
}

interface DeleteDialogState {
    orderId: string
    orderName: string
    deletableChildrenCount: number
    loadingChildrenCount: boolean
}

interface ProductionScheduleProps {
    startDate: Date
    onRefreshRequest?: () => void
    selectedWeekdays?: number[]
    onSelectedWeekdaysChange?: (weekdays: number[]) => void
}

interface WeekdayOption {
    value: number
    label: string
}

const WEEKDAY_OPTIONS: WeekdayOption[] = [
    { value: 1, label: 'Segunda-feira' },
    { value: 2, label: 'Terça-feira' },
    { value: 3, label: 'Quarta-feira' },
    { value: 4, label: 'Quinta-feira' },
    { value: 5, label: 'Sexta-feira' },
    { value: 6, label: 'Sábado' },
    { value: 0, label: 'Domingo' },
]

export function ProductionSchedule({
    startDate,
    onRefreshRequest,
    selectedWeekdays = [1, 2, 3, 4, 5],
    onSelectedWeekdaysChange,
}: ProductionScheduleProps) {
    const { selectedCompany } = useCompany()
    const supabase = createClient()
    const { toast } = useToast()

    const [orders, setOrders] = useState<WorkOrder[]>([])
    const [loading, setLoading] = useState(false)
    const [showDone, setShowDone] = useState(false)
    const [inconsistentOrders, setInconsistentOrders] = useState<Set<string>>(new Set())
    const [sectors, setSectors] = useState<SectorFilterOption[]>([])
    const [selectedSectorIds, setSelectedSectorIds] = useState<string[]>([])
    const [profileBatchByItemId, setProfileBatchByItemId] = useState<Record<string, number | null>>({})
    const [unscheduledOrderIds, setUnscheduledOrderIds] = useState<string[]>([])

    // Drag State
    const [activeId, setActiveId] = useState<string | null>(null)

    // Create Modal State
    const [isCreateOpen, setIsCreateOpen] = useState(false)
    const [createDate, setCreateDate] = useState<string>("")
    const [createSectorId, setCreateSectorId] = useState<string | null>(null)

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

    const dayRange = useMemo(() => days.map((dateObj) => toDateInputValue(dateObj)), [days])
    const visibleDays = useMemo(
        () => days.filter((day) => selectedWeekdays.includes(day.getDay())),
        [days, selectedWeekdays]
    )
    const selectedDayLabels = useMemo(
        () => WEEKDAY_OPTIONS
            .filter((day) => selectedWeekdays.includes(day.value))
            .map((day) => day.label),
        [selectedWeekdays]
    )
    const unscheduledQueueStorageKey = selectedCompany ? `pcp-unscheduled-queue:${selectedCompany.id}` : null

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
                    created_at,
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
                .is('deleted_at', null)

            if (!showDone) {
                query = query.neq('status', 'done').neq('status', 'cancelled')
            }

            query = query.or(`and(scheduled_date.gte.${startStr},scheduled_date.lte.${endStr}),scheduled_date.is.null`)

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

    useEffect(() => {
        if (!unscheduledQueueStorageKey || typeof window === 'undefined') {
            return
        }

        try {
            const raw = window.localStorage.getItem(unscheduledQueueStorageKey)
            if (!raw) {
                setUnscheduledOrderIds([])
                return
            }

            const parsed = JSON.parse(raw) as unknown
            if (!Array.isArray(parsed)) {
                setUnscheduledOrderIds([])
                return
            }

            const ids = parsed.filter((value): value is string => typeof value === 'string')
            setUnscheduledOrderIds(ids)
        } catch (error) {
            console.error('Falha ao carregar fila sem agendamento:', error)
            setUnscheduledOrderIds([])
        }
    }, [unscheduledQueueStorageKey])

    useEffect(() => {
        if (!unscheduledQueueStorageKey || typeof window === 'undefined') {
            return
        }

        window.localStorage.setItem(unscheduledQueueStorageKey, JSON.stringify(unscheduledOrderIds))
    }, [unscheduledOrderIds, unscheduledQueueStorageKey])

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

        const dayRangeSet = new Set(dayRange)
        const hasUnassigned = orders.some((order) => order.sector_id === null && order.scheduled_date !== null && dayRangeSet.has(order.scheduled_date))
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
    }, [dayRange, orders, sectors])

    useEffect(() => {
        const availableSectorIds = lanes
            .filter((lane) => lane.sectorId !== null)
            .map((lane) => lane.sectorId as string)

        setSelectedSectorIds((current) => {
            if (availableSectorIds.length === 0) {
                return []
            }

            const currentSet = new Set(current)
            const next = availableSectorIds.filter((id) => currentSet.has(id))

            if (next.length === 0) {
                return availableSectorIds
            }

            const hasChanged =
                next.length !== current.length ||
                next.some((id, index) => current[index] !== id)

            return hasChanged ? next : current
        })
    }, [lanes])

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

    const displayCardsByLaneDay = useMemo(() => {
        const map = new Map<string, DisplayOrderCard[]>()
        const orderById = new Map(orders.map((order) => [order.id, order]))

        for (const lane of lanes) {
            const laneOrders = orders.filter((order) => order.sector_id === lane.sectorId && order.scheduled_date !== null)
            const overflowCards = allocateOrdersWithCapacity({
                dayRange,
                capacityRecipes: lane.capacityRecipes,
                orders: laneOrders.map((order) => ({
                    id: order.id,
                    scheduledDate: order.scheduled_date,
                    documentNumber: order.document_number,
                    createdAt: order.created_at,
                    plannedQty: order.planned_qty,
                    recipeMetrics: recipeByOrderId.get(order.id) ?? { kind: 'unknown' },
                })),
            })

            for (const card of overflowCards) {
                const sourceOrder = orderById.get(card.orderId)
                if (!sourceOrder) {
                    continue
                }

                const key = buildProductionDropId({
                    sectorId: lane.sectorId,
                    scheduledDate: card.scheduledDate,
                })
                const bucket = map.get(key) ?? []
                bucket.push({
                    cardId: card.cardId,
                    sourceOrderId: sourceOrder.id,
                    order: sourceOrder,
                    scheduledDate: card.scheduledDate,
                    plannedQty: card.allocatedPlannedQty,
                    recipeMetrics: recipeByOrderId.get(sourceOrder.id) ?? { kind: 'unknown' },
                    allocatedRecipes: card.allocatedRecipes,
                    totalRecipes: card.totalRecipes,
                    isSplit: card.isSplit,
                    startsFromPreviousDay: card.startsFromPreviousDay,
                    continuesToNextDay: card.continuesToNextDay,
                })
                map.set(key, bucket)
            }
        }

        return map
    }, [dayRange, lanes, orders, recipeByOrderId])

    const laneDayStats = useMemo(() => {
        const map = new Map<string, LaneDayStats>()

        for (const lane of lanes) {
            for (const scheduledDate of dayRange) {
                const key = buildProductionDropId({ sectorId: lane.sectorId, scheduledDate })
                const displayCards = displayCardsByLaneDay.get(key) ?? []

                let plannedRecipesKnown = 0
                let indeterminateCount = 0

                for (const card of displayCards) {
                    if (!['planned', 'in_progress'].includes(card.order.status)) {
                        continue
                    }

                    const recipeMetrics = card.recipeMetrics
                    if (!recipeMetrics || recipeMetrics.kind === 'unknown') {
                        indeterminateCount += 1
                        continue
                    }

                    plannedRecipesKnown += card.allocatedRecipes ?? recipeMetrics.recipes
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
    }, [dayRange, displayCardsByLaneDay, lanes])

    const unscheduledQueue = useMemo(() => {
        const unscheduledOrders = orders.filter((order) => order.scheduled_date === null)
        return sortUnscheduledQueueByEmission(
            unscheduledOrders.map((order) => ({
                id: order.id,
                documentNumber: order.document_number,
                createdAt: order.created_at,
                order,
            })),
            unscheduledOrderIds
        ).map((entry) => entry.order)
    }, [orders, unscheduledOrderIds])

    useEffect(() => {
        const currentIds = unscheduledQueue.map((order) => order.id)
        const hasDifference =
            currentIds.length !== unscheduledOrderIds.length ||
            currentIds.some((id, index) => unscheduledOrderIds[index] !== id)

        if (hasDifference) {
            setUnscheduledOrderIds(currentIds)
        }
    }, [unscheduledQueue, unscheduledOrderIds])


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
        const order = orders.find(o => o.id === orderId)
        if (!order) return

        const overId = String(over.id)
        if (overId.startsWith('queue-before::') || overId === 'queue-list') {
            if (order.scheduled_date !== null) {
                toast({ title: "Bloqueado", description: "Somente OPs sem agendamento podem ser reordenadas na fila.", variant: "destructive" })
                return
            }

            const targetOrderId = overId === 'queue-list' ? unscheduledQueue[unscheduledQueue.length - 1]?.id ?? orderId : overId.replace('queue-before::', '')
            const nextQueueIds = moveQueueCardBefore({
                currentOrderIds: unscheduledQueue.map((item) => item.id),
                movingOrderId: orderId,
                targetOrderId,
            })
            setUnscheduledOrderIds(nextQueueIds)
            toast({ title: "Fila atualizada", description: "Ordem da fila sem agendamento atualizada." })
            return
        }

        const target = parseProductionDropId(overId)
        if (!target) {
            return
        }

        const currentScheduledDate = order.scheduled_date
        if (!currentScheduledDate) {
            if (order.status !== 'planned') {
                toast({ title: "Bloqueado", description: "Apenas OPs planejadas podem ser agendadas.", variant: "destructive" })
                return
            }

            const sectorById = new Map(
                sectors.map((sector) => [sector.id, { id: sector.id, name: sector.name, code: sector.code }] as const)
            )

            const originalOrder = order
            setOrders((previous) => previous.map((currentOrder) => {
                if (currentOrder.id !== order.id) {
                    return currentOrder
                }
                return {
                    ...currentOrder,
                    scheduled_date: target.scheduledDate,
                    sector_id: target.sectorId,
                    sector: target.sectorId ? (sectorById.get(target.sectorId) ?? currentOrder.sector) : null,
                }
            }))

            try {
                await updateWorkOrderAction(order.id, {
                    scheduled_date: target.scheduledDate,
                    sector_id: target.sectorId,
                })
                toast({ title: "Agendado", description: "OP adicionada na agenda semanal." })
                if (onRefreshRequest) onRefreshRequest()
            } catch (error) {
                console.error(error)
                setOrders((previous) => previous.map((currentOrder) => currentOrder.id === order.id ? originalOrder : currentOrder))
                toast({ title: "Erro", description: "Falha ao agendar OP.", variant: "destructive" })
            }
            return
        }

        let patch: { scheduledDate: string; sectorId: string | null } | null = null
        try {
            patch = computeWorkOrderMovePatch(
                {
                    id: order.id,
                    status: order.status,
                    scheduledDate: currentScheduledDate,
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
    const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState | null>(null)
    const [deletePlannedChildren, setDeletePlannedChildren] = useState(true)

    // Delete Action
    const confirmDeleteOrder = async () => {
        if (!deleteDialog) return

        const orderId = deleteDialog.orderId
        const shouldDeleteChildren = deletePlannedChildren && deleteDialog.deletableChildrenCount > 0
        setDeleteDialog(null) // Close modal immediately

        // Optimistic remove
        const previous = orders
        setOrders(prev => prev.filter((o) => {
            if (o.id === orderId) return false
            if (shouldDeleteChildren && o.parent_work_order_id === orderId && o.status === 'planned') return false
            return true
        }))

        try {
            const result = await deleteWorkOrderAction(orderId, {
                deletePlannedChildren: shouldDeleteChildren,
            })
            const deletedChildrenCount =
                typeof (result as { deleted_children_count?: unknown })?.deleted_children_count === 'number'
                    ? (result as { deleted_children_count: number }).deleted_children_count
                    : 0

            toast({
                title: "Excluído",
                description: deletedChildrenCount > 0
                    ? `Ordem removida com ${deletedChildrenCount} OP(s) filha(s) não iniciadas.`
                    : "Ordem de produção removida.",
            })
            await fetchOrders()
            if (onRefreshRequest) onRefreshRequest()
        } catch (error) {
            console.error(error)
            setOrders(previous) // Revert
            toast({ title: "Erro", description: "Falha ao excluir ordem.", variant: "destructive" })
        }
    }

    const handleDeleteClick = (orderId: string) => {
        if (!selectedCompany) return

        const targetOrder = orders.find((order) => order.id === orderId)
        setDeletePlannedChildren(true)
        setDeleteDialog({
            orderId,
            orderName: targetOrder?.item.name ?? 'Ordem de produção',
            deletableChildrenCount: 0,
            loadingChildrenCount: true,
        })

        void (async () => {
            const { count, error } = await supabase
                .from('work_orders')
                .select('id', { count: 'exact', head: true })
                .eq('company_id', selectedCompany.id)
                .eq('parent_work_order_id', orderId)
                .eq('status', 'planned')
                .is('deleted_at', null)

            if (error) {
                console.error(error)
            }

            setDeleteDialog((current) => {
                if (!current || current.orderId !== orderId) return current
                return {
                    ...current,
                    deletableChildrenCount: error ? 0 : (count ?? 0),
                    loadingChildrenCount: false,
                }
            })
        })()
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

    const handleCreateClick = (date: string, sectorId?: string | null) => {
        setCreateDate(date)
        setCreateSectorId(sectorId ?? null)
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
            const result = await updateWorkOrderAction(selectedOrder.id, {
                planned_qty: selectedOrder.status === 'planned' ? newQty : undefined,
                notes: editNotes
            })
            const childUpdatesCount =
                typeof (result as { child_updates_count?: unknown })?.child_updates_count === 'number'
                    ? ((result as { child_updates_count: number }).child_updates_count)
                    : 0

            toast({
                title: "Atualizado",
                description: childUpdatesCount > 0
                    ? `Dados salvos. ${childUpdatesCount} OP(s) filha(s) foram recalculadas.`
                    : "Dados salvos.",
            })
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
    const selectedDaysLabel = selectedDayLabels.length > 0 ? `${selectedDayLabels.length} dia(s)` : 'Nenhum dia'
    const selectableLanes = lanes.filter((lane) => lane.sectorId !== null)
    const selectedSectorsLabel = `${selectedSectorIds.length} setor(es)`
    const visibleLanes = lanes.filter((lane) => lane.sectorId === null || selectedSectorIds.includes(lane.sectorId))

    const handleToggleWeekday = (weekday: number) => {
        const current = selectedWeekdays
        const next = (() => {
            if (current.includes(weekday)) {
                if (current.length === 1) {
                    return current
                }
                return current.filter((value) => value !== weekday)
            }

            return [...current, weekday].sort((a, b) => {
                const order = [1, 2, 3, 4, 5, 6, 0]
                return order.indexOf(a) - order.indexOf(b)
            })
        })()

        if (onSelectedWeekdaysChange) {
            onSelectedWeekdaysChange(next)
        }
    }

    const handleToggleSector = (sectorId: string) => {
        setSelectedSectorIds((current) => {
            if (current.includes(sectorId)) {
                return current.filter((id) => id !== sectorId)
            }
            return [...current, sectorId]
        })
    }

    return (
        <>
            <div className="bg-white border-b border-gray-200 mt-6">
                <div className="flex items-center justify-between px-2 py-2 border-t bg-gray-50/50">
                    <h3 className="text-sm font-semibold flex items-center gap-2 text-slate-700">
                        <CalendarIcon className="w-4 h-4 text-slate-500" /> Agenda de Produção
                    </h3>
                    <div className="flex items-center gap-4">
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" size="sm" className="h-8 gap-1.5">
                                    Dias da semana
                                    <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                                        {selectedDaysLabel}
                                    </Badge>
                                    <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent align="end" className="w-64 p-3 space-y-2">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Colunas visíveis
                                </p>
                                <div className="space-y-2">
                                    {WEEKDAY_OPTIONS.map((day) => (
                                        <label key={day.value} className="flex items-center gap-2 text-sm text-slate-700">
                                            <Checkbox
                                                checked={selectedWeekdays.includes(day.value)}
                                                onCheckedChange={() => handleToggleWeekday(day.value)}
                                            />
                                            <span>{day.label}</span>
                                        </label>
                                    ))}
                                </div>
                            </PopoverContent>
                        </Popover>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" size="sm" className="h-8 gap-1.5">
                                    Setores
                                    <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                                        {selectedSectorsLabel}
                                    </Badge>
                                    <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent align="end" className="w-72 p-3 space-y-2">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Setores visíveis
                                </p>
                                <div className="space-y-2 max-h-64 overflow-auto pr-1">
                                    {selectableLanes.map((lane) => (
                                        <label key={lane.key} className="flex items-center gap-2 text-sm text-slate-700">
                                            <Checkbox
                                                checked={selectedSectorIds.includes(lane.sectorId as string)}
                                                onCheckedChange={() => handleToggleSector(lane.sectorId as string)}
                                            />
                                            <span>{lane.code} - {lane.name}</span>
                                        </label>
                                    ))}
                                    {selectableLanes.length === 0 && (
                                        <p className="text-xs text-slate-500">Nenhum setor disponível.</p>
                                    )}
                                </div>
                            </PopoverContent>
                        </Popover>
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
                        {unscheduledQueue.length > 0 && (
                            <div className="border-b border-gray-200">
                                <div className="px-3 py-2 bg-indigo-50/50 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="inline-flex items-center rounded-full border border-indigo-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
                                            FILA
                                        </span>
                                        <span className="text-sm font-semibold text-indigo-900">Sem agendamento</span>
                                    </div>
                                    <p className="text-xs text-indigo-700">Ordem por emissão. Arraste para mudar a prioridade.</p>
                                </div>
                                <UnscheduledQueue
                                    orders={unscheduledQueue}
                                    recipeByOrderId={recipeByOrderId}
                                    inconsistentOrders={inconsistentOrders}
                                    onOrderClick={handleOrderClick}
                                    onDeleteClick={handleDeleteClick}
                                />
                            </div>
                        )}

                        {visibleLanes.length === 0 && !loading && (
                            <div className="px-4 py-8 text-sm text-gray-500">Nenhum setor ativo encontrado para exibir a agenda.</div>
                        )}

                        {visibleLanes.map((lane) => (
                            <div key={lane.key} className="border-b border-gray-200 last:border-b-0">
                                <div className={cn(
                                    "px-3 py-2 flex items-center justify-between",
                                    lane.isUnassigned ? "bg-amber-50/50" : "bg-slate-50/50"
                                )}>
                                    <div className="flex items-center gap-2">
                                        <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                                            {lane.code}
                                        </span>
                                        <span className="text-sm font-semibold text-slate-800">
                                            {lane.name}
                                            {!lane.isUnassigned && (
                                                <span className="ml-2 text-xs font-medium text-slate-500">
                                                    - Capacidade {lane.capacityRecipes ?? 0} receitas/dia
                                                </span>
                                            )}
                                        </span>
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
                                        <p className="text-xs text-slate-500">{selectedDaysLabel}</p>
                                    )}
                                </div>

                                <div
                                    className="grid gap-px bg-gray-200"
                                    style={{ gridTemplateColumns: `repeat(${Math.max(visibleDays.length, 1)}, minmax(0, 1fr))` }}
                                >
                                    {visibleDays.map((dateObj) => {
                                        const scheduledDate = toDateInputValue(dateObj)
                                        const dropId = buildProductionDropId({
                                            sectorId: lane.sectorId,
                                            scheduledDate,
                                        })
                                        const dayCards = displayCardsByLaneDay.get(dropId) ?? []
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
                                                cards={dayCards}
                                                stats={stats}
                                                lane={lane}
                                                onCreate={() => handleCreateClick(scheduledDate, lane.sectorId)}
                                                onOrderClick={handleOrderClick}
                                                onDeleteClick={handleDeleteClick}
                                                inconsistentOrders={inconsistentOrders}
                                            />
                                        )
                                    })}
                                    {visibleDays.length === 0 && (
                                        <div className="bg-white px-4 py-10 text-sm text-gray-500">
                                            Selecione ao menos um dia da semana para exibir a agenda.
                                        </div>
                                    )}
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
                initialSectorId={createSectorId}
                onClose={() => {
                    setIsCreateOpen(false)
                    setCreateSectorId(null)
                }}
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
                <DialogContent className="w-[96vw] max-w-4xl max-h-[90vh] overflow-hidden">
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
                        <div className="py-2 max-h-[70vh] overflow-y-auto pr-1">
                            <div className="grid gap-4 md:grid-cols-12">
                                <div className="space-y-4 md:col-span-7">
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
                                </div>

                                <div className="space-y-4 md:col-span-5">
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
                                            className="h-28"
                                        />
                                    </div>

                                    <div className="flex flex-wrap gap-2 pt-1">
                                        {selectedOrder.status === 'planned' && (
                                            <>
                                                <Button variant="outline" size="sm" onClick={() => handleStatusParams('in_progress')} className="text-blue-600 border-blue-200 bg-blue-50/50 hover:bg-blue-100">
                                                    <Play className="w-4 h-4 mr-2" /> Iniciar
                                                </Button>
                                                <Button variant="ghost" size="sm" onClick={() => handleStatusParams('cancelled')} className="text-red-500 hover:text-red-700 hover:bg-red-50">
                                                    Cancelar
                                                </Button>
                                            </>
                                        )}
                                        {selectedOrder.status === 'in_progress' && (
                                            <>
                                                <Button variant="outline" size="sm" onClick={() => handleStatusParams('done')} className="text-green-600 border-green-200 bg-green-50/50 hover:bg-green-100">
                                                    <CheckCircle2 className="w-4 h-4 mr-2" /> Encerrar
                                                </Button>
                                                <Button variant="ghost" size="sm" onClick={() => handleStatusParams('cancelled')} className="text-red-500 hover:text-red-700 hover:bg-red-50">
                                                    Cancelar
                                                </Button>
                                            </>
                                        )}
                                    </div>
                                </div>
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
            <Dialog open={!!deleteDialog} onOpenChange={(open) => !open && setDeleteDialog(null)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-red-600 flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5" /> Confirmar Exclusão
                        </DialogTitle>
                        <DialogDescription>
                            Deseja excluir a OP <strong>{deleteDialog?.orderName ?? 'selecionada'}</strong>? Esta ação não pode ser desfeita.
                        </DialogDescription>
                    </DialogHeader>
                    {deleteDialog && (
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                            {deleteDialog.loadingChildrenCount ? (
                                <p className="text-sm text-slate-600">Verificando OPs filhas não iniciadas...</p>
                            ) : deleteDialog.deletableChildrenCount > 0 ? (
                                <label className="flex items-center gap-2 text-sm text-slate-700">
                                    <Checkbox
                                        checked={deletePlannedChildren}
                                        onCheckedChange={(checked) => setDeletePlannedChildren(Boolean(checked))}
                                    />
                                    <span>
                                        Excluir também {deleteDialog.deletableChildrenCount} OP(s) filha(s) não iniciadas
                                    </span>
                                </label>
                            ) : (
                                <p className="text-sm text-slate-600">Não há OPs filhas não iniciadas para excluir.</p>
                            )}
                        </div>
                    )}
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="ghost" onClick={() => setDeleteDialog(null)}>Cancelar</Button>
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

function DroppableDay({
    dropId,
    dateObj,
    dateStr,
    lane,
    cards,
    stats,
    onCreate,
    onOrderClick,
    onDeleteClick,
    inconsistentOrders,
}: {
    dropId: string
    dateObj: Date
    dateStr: string
    lane: ProductionLane
    cards: DisplayOrderCard[]
    stats: LaneDayStats
    onCreate: () => void
    onOrderClick: (o: WorkOrder) => void
    onDeleteClick: (id: string) => void
    inconsistentOrders: Set<string>
}) {
    const { isOver, setNodeRef } = useDroppable({ id: dropId, disabled: lane.dropDisabled })
    const isToday = todayInBrasilia() === dateStr

    const plannedLabel = stats.indeterminateCount > 0
        ? `${stats.plannedRecipesKnown}+ receitas`
        : `${stats.plannedRecipesKnown} receitas`

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
            <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500 font-medium">
                    {dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                </span>
                <div className="ml-auto flex items-center gap-2">
                    <span
                        className={cn(
                            "text-[10px] font-semibold",
                            stats.state === 'EXCEEDED' ? "text-red-600" : stats.state === 'NEAR_LIMIT' ? "text-amber-600" : "text-slate-500"
                        )}
                    >
                        Planejado {plannedLabel}
                    </span>
                    <Button size="sm" variant="ghost" onClick={onCreate} className="h-6 w-6 p-0">
                        <Plus className="h-3 w-3 text-gray-400" />
                    </Button>
                </div>
            </div>

            <div className="flex flex-col gap-1.5 flex-1 relative">
                {cards.map((card) => (
                    <DraggableOrder
                        key={card.cardId}
                        order={card.order}
                        recipeMetrics={card.recipeMetrics}
                        displayPlannedQty={card.plannedQty}
                        displayRecipeCount={card.allocatedRecipes}
                        isSplit={card.isSplit}
                        startsFromPreviousDay={card.startsFromPreviousDay}
                        continuesToNextDay={card.continuesToNextDay}
                        disableDrag={card.isSplit}
                        onClick={() => onOrderClick(card.order)}
                        onDelete={() => onDeleteClick(card.order.id)}
                        isInconsistent={inconsistentOrders.has(card.order.id)}
                    />
                ))}

                {cards.length === 0 && !isOver && (
                    <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-[10px] text-slate-300 text-center italic pointer-events-none">
                        Sem OPs
                    </div>
                )}
            </div>
        </div>
    )
}

function UnscheduledQueue({
    orders,
    recipeByOrderId,
    inconsistentOrders,
    onOrderClick,
    onDeleteClick,
}: {
    orders: WorkOrder[]
    recipeByOrderId: Map<string, RecipeCountWithFallbackResult>
    inconsistentOrders: Set<string>
    onOrderClick: (order: WorkOrder) => void
    onDeleteClick: (orderId: string) => void
}) {
    const { setNodeRef } = useDroppable({ id: 'queue-list' })

    return (
        <div ref={setNodeRef} className="px-3 py-2 bg-white space-y-2">
            {orders.map((order) => (
                <QueueOrderRow
                    key={order.id}
                    order={order}
                    recipeMetrics={recipeByOrderId.get(order.id)}
                    isInconsistent={inconsistentOrders.has(order.id)}
                    onClick={() => onOrderClick(order)}
                    onDelete={() => onDeleteClick(order.id)}
                />
            ))}
        </div>
    )
}

function QueueOrderRow({
    order,
    recipeMetrics,
    isInconsistent,
    onClick,
    onDelete,
}: {
    order: WorkOrder
    recipeMetrics?: RecipeCountWithFallbackResult
    isInconsistent?: boolean
    onClick?: () => void
    onDelete?: () => void
}) {
    const dropId = `queue-before::${order.id}`
    const { isOver, setNodeRef } = useDroppable({ id: dropId })

    return (
        <div ref={setNodeRef} className={cn(isOver ? 'ring-2 ring-indigo-300 rounded-2xl' : '')}>
            <DraggableOrder
                order={order}
                recipeMetrics={recipeMetrics}
                isInconsistent={isInconsistent}
                onClick={onClick}
                onDelete={onDelete}
                showQueueHint
            />
        </div>
    )
}

function DraggableOrder({
    order,
    recipeMetrics,
    displayPlannedQty,
    displayRecipeCount,
    isSplit,
    startsFromPreviousDay,
    continuesToNextDay,
    disableDrag,
    showQueueHint,
    onClick,
    onDelete,
    isInconsistent,
}: {
    order: WorkOrder
    recipeMetrics?: RecipeCountWithFallbackResult
    displayPlannedQty?: number
    displayRecipeCount?: number | null
    isSplit?: boolean
    startsFromPreviousDay?: boolean
    continuesToNextDay?: boolean
    disableDrag?: boolean
    showQueueHint?: boolean
    onClick?: () => void
    onDelete?: () => void
    isInconsistent?: boolean
}) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: disableDrag ? `${order.id}::locked` : order.id,
        disabled: order.status !== 'planned' || Boolean(disableDrag)
    })

    const style = transform ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        zIndex: 999
    } : undefined

    if (isDragging) {
        return (
            <div ref={setNodeRef} style={style} className="opacity-50">
                <OrderCard
                    order={order}
                    recipeMetrics={recipeMetrics}
                    displayPlannedQty={displayPlannedQty}
                    displayRecipeCount={displayRecipeCount}
                    isSplit={isSplit}
                    startsFromPreviousDay={startsFromPreviousDay}
                    continuesToNextDay={continuesToNextDay}
                    showQueueHint={showQueueHint}
                    isInconsistent={isInconsistent}
                />
            </div>
        )
    }

    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
            <OrderCard
                order={order}
                recipeMetrics={recipeMetrics}
                displayPlannedQty={displayPlannedQty}
                displayRecipeCount={displayRecipeCount}
                isSplit={isSplit}
                startsFromPreviousDay={startsFromPreviousDay}
                continuesToNextDay={continuesToNextDay}
                showQueueHint={showQueueHint}
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
    displayPlannedQty,
    displayRecipeCount,
    isSplit,
    startsFromPreviousDay,
    continuesToNextDay,
    showQueueHint,
    isOverlay,
    onClick,
    onDelete,
    isInconsistent,
}: {
    order: WorkOrder
    recipeMetrics?: RecipeCountWithFallbackResult
    displayPlannedQty?: number
    displayRecipeCount?: number | null
    isSplit?: boolean
    startsFromPreviousDay?: boolean
    continuesToNextDay?: boolean
    showQueueHint?: boolean
    isOverlay?: boolean
    onClick?: () => void
    onDelete?: () => void
    isInconsistent?: boolean
}) {
    const fallbackRecipes = calculateRecipeCount(order.planned_qty, order.bom?.yield_qty)
    const resolvedRecipeCount = displayRecipeCount !== undefined && displayRecipeCount !== null
        ? displayRecipeCount
        : recipeMetrics && recipeMetrics.kind !== 'unknown'
            ? recipeMetrics.recipes
            : fallbackRecipes
    const compactRecipeLabel = resolvedRecipeCount !== null ? `${resolvedRecipeCount}rec` : 'rec indet.'
    const recipeLabel = resolvedRecipeCount !== null ? formatRecipeCountLabel(resolvedRecipeCount) : 'Receita indeterminada'

    const statusColor = {
        planned: "bg-white border-l-4 border-l-blue-400 shadow-card",
        in_progress: "bg-blue-50 border-l-4 border-l-blue-600 shadow-card",
        done: "bg-green-50 border-1 border-green-200 opacity-60 grayscale",
        cancelled: "bg-gray-50 border-1 border-gray-200 opacity-50 line-through"
    }[order.status]

    const statusLabel: Record<WorkOrder['status'], string> = {
        planned: 'Planejada',
        in_progress: 'Em produção',
        done: 'Concluída',
        cancelled: 'Cancelada',
    }
    const scheduleLabel = order.scheduled_date
        ? new Date(`${order.scheduled_date}T00:00:00`).toLocaleDateString('pt-BR')
        : 'Sem agendamento'
    const plannedQtyLabel = `${displayPlannedQty ?? order.planned_qty} ${order.item.uom}`
    const splitLabel = isSplit
        ? startsFromPreviousDay
            ? 'Continuação do dia anterior'
            : 'Dividida'
        : 'Não'

    return (
        <TooltipProvider delayDuration={150}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <div
                        onClick={onClick}
                        className={cn(
                            "p-2 rounded-2xl text-xs border cursor-grab active:cursor-grabbing hover:shadow-card transition-shadow relative overflow-hidden",
                            statusColor,
                            isOverlay ? "shadow-float scale-105 rotate-2" : ""
                        )}
                    >
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex min-w-0 items-center gap-1.5">
                                <span className="font-semibold truncate">{order.item.name}</span>
                                <span className="shrink-0 text-[11px] font-medium text-slate-500">
                                    - {compactRecipeLabel}
                                    {continuesToNextDay ? '+' : ''}
                                </span>
                            </div>
                            <div className="flex shrink-0 gap-1 items-center">
                                {isInconsistent && (
                                    <AlertTriangle className="h-3.5 w-3.5 text-red-600" />
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
                                {order.status === 'planned' && !isSplit && <GripVertical className="w-3 h-3 text-slate-300" />}
                                {showQueueHint && order.status === 'planned' && <ArrowUp className="w-3 h-3 text-indigo-400" />}
                            </div>
                        </div>
                    </div>
                </TooltipTrigger>
                <TooltipContent
                    side="top"
                    align="start"
                    className="z-50 w-72 rounded-xl border border-slate-200 bg-white p-3 text-[11px] text-slate-700 shadow-xl"
                >
                    <div className="space-y-1">
                        <div className="text-xs font-semibold text-slate-900">{order.item.name}</div>
                        <div className="grid grid-cols-[110px_1fr] gap-x-2 gap-y-0.5">
                            <span className="text-slate-500">OP</span>
                            <span className="font-medium text-slate-800">
                                #{order.document_number ?? order.id.slice(0, 8)}
                            </span>
                            <span className="text-slate-500">Status</span>
                            <span className="font-medium text-slate-800">{statusLabel[order.status]}</span>
                            <span className="text-slate-500">Setor</span>
                            <span className="font-medium text-slate-800">{order.sector?.name ?? 'Sem setor'}</span>
                            <span className="text-slate-500">Agendamento</span>
                            <span className="font-medium text-slate-800">{scheduleLabel}</span>
                            <span className="text-slate-500">Quantidade</span>
                            <span className="font-medium text-slate-800">{plannedQtyLabel}</span>
                            <span className="text-slate-500">Receitas</span>
                            <span className="font-medium text-slate-800">{recipeLabel}</span>
                            <span className="text-slate-500">Fila</span>
                            <span className="font-medium text-slate-800">{showQueueHint ? 'Sim' : 'Não'}</span>
                            <span className="text-slate-500">Dividida</span>
                            <span className="font-medium text-slate-800">{splitLabel}</span>
                            {order.parent_work_order_id && (
                                <>
                                    <span className="text-slate-500">Vínculo</span>
                                    <span className="font-medium text-amber-700">OP filha</span>
                                </>
                            )}
                            {recipeMetrics?.kind === 'unknown' && (
                                <>
                                    <span className="text-slate-500">Observação</span>
                                    <span className="font-medium text-amber-700">
                                        Receita indeterminada (sem yield/batch)
                                    </span>
                                </>
                            )}
                        </div>
                    </div>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )
}
