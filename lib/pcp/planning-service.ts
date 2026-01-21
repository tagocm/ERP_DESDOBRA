import { supabaseServer } from '@/lib/supabase/server'
import { itemsRepo } from '@/lib/data/items'
import { bomsRepo } from '@/lib/data/boms'
import { inventoryRepo } from '@/lib/data/inventory'

export interface PlanningOptions {
    includePlannedOps?: boolean
    startDate?: string
    endDate?: string
    demandSource?: 'scheduled_routes' | 'confirmed_orders'
}

export interface DailyPlan {
    date: string
    demand: number
    production: number
    accumulated_production: number // Gross planned qty accumulated
    balance_start: number
    balance_end: number
    shortage: number
    recipes_needed: number
    bom_yield: number
    bom_id?: string
    routes_count?: number
    orders_count?: number
}

export interface ItemPlan {
    item_id: string
    item_name: string
    item_sku: string
    uom: string
    current_stock: number
    days: DailyPlan[]
    total_shortage: number
    has_bom: boolean
}

export interface PlanningAlert {
    item_id: string
    item_name: string
    item_sku: string
    uom: string
    date: string
    quantity: number
    type: 'no_bom' | 'not_finished_good'
}

export const planningService = {
    async rolloverOverdueOrders(companyId: string) {
        // Rule: "toda a OP que vencer o dia da iniciação da operação altere o planejamento dessa OP para o dia seguinte"
        // Interpretation: If scheduled_date < TODAY and status is 'planned', move to TODAY.
        // This ensures pending items roll forward to the current day's attention.

        // Get Today in YYYY-MM-DD (Brasilia Time ideally, but server UTC usually implies rolling UTC to UTC)
        // Let's rely on standard ISO string (UTC) or adjust for timezone if needed. 
        // Assuming simple string comparison is sufficient for date-only fields.
        const today = new Date().toISOString().split('T')[0]

        const { error } = await supabaseServer
            .from('work_orders')
            .update({ scheduled_date: today })
            .eq('company_id', companyId)
            .eq('status', 'planned')
            .lt('scheduled_date', today)
            .is('deleted_at', null)

        if (error) {
            console.error("Failed to rollover overdue orders:", error)
        }
    },

    async getPlanningData(companyId: string, startDate: string, endDate: string, options: PlanningOptions = { includePlannedOps: true }) {
        // 1. Get Eligible Items (Finished Goods with Production Profiles)
        // Simplified approach to avoid PostgREST join issues
        const items = await itemsRepo.list(companyId, { is_active: true })

        // Filter for finished goods only
        const finishedGoods = items.filter(item => (item.type as string) === 'finished_good')

        // Get production profiles for these items
        const { data: profiles } = await supabaseServer
            .from('item_production_profiles')
            .select('item_id, is_produced, default_bom_id, batch_size')
            .eq('company_id', companyId)
            .in('item_id', finishedGoods.map(i => i.id))
            .eq('is_produced', true)

        const profileMap = new Map((profiles || []).map(p => [p.item_id, p]))

        // Filter items: must have production profile with is_produced=true AND default_bom_id
        const eligibleItemIds = finishedGoods
            .filter(item => {
                const profile = profileMap.get(item.id)
                return profile && profile.is_produced && profile.default_bom_id
            })
            .map(i => i.id)

        // Get BOMs and filter for active ones only
        const activeBomHeaders = await bomsRepo.list(companyId, { is_active: true })
        const activeBomItemIds = new Set(activeBomHeaders.map(b => b.item_id))

        // Final eligible items: has profile AND has active BOM
        const finalEligibleItems = finishedGoods.filter(item =>
            eligibleItemIds.includes(item.id) && activeBomItemIds.has(item.id)
        )

        // 2. Get Current Stock for all items
        const stocks = await inventoryRepo.getStockByItems(companyId)
        const stockMap = new Map(stocks.map(s => [s.item_id, s.current_stock]))

        const demandMap = new Map<string, Map<string, number>>() // Date -> Item -> Qty
        const dayStatsMap = new Map<string, { routes: number, orders: number }>()

        // 3. Fetch Demand (Scheduled Routes OR Confirmed Orders)
        if (options.demandSource === 'confirmed_orders') {
            // Confirmed Orders: Calculate remaining balance for undelivered/partially delivered orders
            // @ts-ignore
            const { data: orders, error: orderError } = await supabaseServer
                .from('sales_documents')
                .select(`
                    id,
                    scheduled_delivery_date,
                    status_commercial,
                    status_logistic,
                    items:sales_document_items(item_id, quantity, qty_base)
                `)
                .eq('company_id', companyId)
                .gte('scheduled_delivery_date', startDate)
                .lte('scheduled_delivery_date', endDate)
                .eq('status_commercial', 'confirmed')
                .is('deleted_at', null)
                // Include orders that are NOT fully delivered (confirmado, parcial)
                .in('status_logistic', ['confirmado', 'parcial'])

            if (orderError) throw orderError

            const anyOrders = orders as any[] || []

            anyOrders.forEach(o => {
                const date = o.scheduled_delivery_date?.split('T')[0]
                if (!date) return

                if (!dayStatsMap.has(date)) dayStatsMap.set(date, { routes: 0, orders: 0 })
                const stats = dayStatsMap.get(date)!
                stats.orders += 1

                if (!demandMap.has(date)) demandMap.set(date, new Map())
                const dayMap = demandMap.get(date)!

                const items = o.items as any[]
                items?.forEach(item => {
                    const current = dayMap.get(item.item_id) || 0

                    // Calculate remaining balance:
                    // If qty_base exists (partial delivery), remaining = quantity - qty_base
                    // Otherwise, full quantity is pending
                    const originalQty = item.quantity || 0
                    const deliveredQty = item.qty_base || 0
                    const remainingQty = originalQty - deliveredQty

                    dayMap.set(item.item_id, current + Math.max(0, remainingQty))
                })
            })
        } else {
            // Default: Scheduled Routes
            // @ts-ignore
            const { data: routeDemands, error: routeError } = await supabaseServer
                .from('delivery_route_orders')
                .select(`
                    partial_payload,
                    route:delivery_routes!inner(id, route_date, scheduled_date),
                    order:sales_documents(
                        id,
                        document_number,
                        items:sales_document_items(
                            id, 
                            item_id, 
                            quantity, 
                            qty_base, 
                            packaging:item_packaging(qty_in_base)
                        ),
                        deliveries:deliveries(
                            id, status,
                            items:delivery_items(sales_document_item_id, qty_delivered)
                        )
                    )
                `)
                .eq('route.company_id', companyId)
                .gte('route.scheduled_date', startDate)
                .lte('route.scheduled_date', endDate)
                .neq('route.status', 'cancelada')
                .neq('route.status', 'concluida')

            if (routeError) throw routeError

            const dayroutes = new Map<string, Set<string>>()
            const dayorders = new Map<string, Set<string>>()

            const anyDemands = routeDemands as any[] || []

            anyDemands.forEach(d => {
                const date = d.route?.scheduled_date?.split('T')[0]
                if (!date) return

                if (!dayroutes.has(date)) dayroutes.set(date, new Set())
                if (!dayorders.has(date)) dayorders.set(date, new Set())
                if (d.route?.id) dayroutes.get(date)!.add(d.route.id)
                if (d.order?.id) dayorders.get(date)!.add(d.order.id)

                if (!demandMap.has(date)) demandMap.set(date, new Map())
                const dayMap = demandMap.get(date)!

                const orderItems = d.order?.items as any[] || []
                const deliveries = d.order?.deliveries as any[] || []

                // Calculate Fulfilled from Deliveries
                const fulfilledMap = new Map<string, number>()
                deliveries.forEach(del => {
                    // Include Delivered, Returned Partial/Total, and 'entregue'
                    if (['delivered', 'returned_partial', 'returned_total', 'entregue', 'partial'].includes(del.status)) {
                        del.items?.forEach((di: any) => {
                            const current = fulfilledMap.get(di.sales_document_item_id) || 0
                            fulfilledMap.set(di.sales_document_item_id, current + (di.qty_delivered || 0))
                        })
                    }
                })

                // Check if this specific route has a partial partial_payload
                const partialItems = d.partial_payload?.items || []

                orderItems.forEach(item => {
                    const current = dayMap.get(item.item_id) || 0

                    let qty = 0;

                    // Helper: Get Packaging Factor
                    // @ts-ignore
                    const pkgFactor = item.packaging?.qty_in_base || 1

                    // Robustness: Determine Effective Factor
                    // If the item has a saved 'qty_base' (Snapshot), use it to derive the factor used at creation.
                    // This protects against packaging changes after order creation.
                    let effectiveFactor = pkgFactor
                    const salesQty = item.quantity || 0
                    const savedBase = item.qty_base

                    if (salesQty > 0 && savedBase && savedBase > 0) {
                        // Derive factor from snapshot (e.g. 120 / 10 = 12)
                        effectiveFactor = savedBase / salesQty
                    }

                    // 1. Try to find explicit override in partial_payload
                    // We need to match by orderItemId (sales_document_item_id)
                    const override = partialItems.find((p: any) => p.orderItemId === item.id)

                    if (override) {
                        // Use the planned partial load
                        // Partial Payload is in Sales Units (e.g. Boxes)
                        // Convert to Base
                        qty = (override.qtyLoaded || 0) * effectiveFactor
                    } else {
                        // 2. Default: Calculate remaining balance

                        // Total Demand in Base Units
                        // Prefer saved snapshot, fallback to calculation
                        const totalBase = savedBase || (salesQty * effectiveFactor)

                        // Fulfilled in Sales Units (e.g. Boxes)
                        const fulfilledSales = fulfilledMap.get(item.id) || 0

                        // Convert Fulfilled to Base
                        const fulfilledBase = fulfilledSales * effectiveFactor

                        // Remaining Balance
                        qty = Math.max(0, totalBase - fulfilledBase)
                    }

                    if (qty > 0) {
                        dayMap.set(item.item_id, current + qty)
                    }
                })
            })

            dayroutes.forEach((routes, date) => {
                if (!dayStatsMap.has(date)) dayStatsMap.set(date, { routes: 0, orders: 0 })
                dayStatsMap.get(date)!.routes = routes.size
            })
            dayorders.forEach((orders, date) => {
                if (!dayStatsMap.has(date)) dayStatsMap.set(date, { routes: 0, orders: 0 })
                dayStatsMap.get(date)!.orders = orders.size
            })
        }

        // 4. Get Supply (Work Orders)
        let supplyMap = new Map<string, Map<string, { net: number, gross: number }>>()

        if (options.includePlannedOps) {
            const { data: supplies, error: supplyError } = await supabaseServer
                .from('work_orders')
                .select('scheduled_date, item_id, planned_qty, produced_qty, status')
                .eq('company_id', companyId)
                .gte('scheduled_date', startDate)
                .lte('scheduled_date', endDate)
                .is('deleted_at', null)
                .in('status', ['planned', 'in_progress', 'confirmed'])

            if (supplyError) throw supplyError

            supplies?.forEach(s => {
                const date = s.scheduled_date?.split('T')[0]
                if (!date) return
                if (!supplyMap.has(date)) supplyMap.set(date, new Map())
                const dayMap = supplyMap.get(date)!

                const current = dayMap.get(s.item_id) || { net: 0, gross: 0 }

                // Net = Remaining to produce (Net Addition to Stock)
                const remaining = Math.max(0, (s.planned_qty || 0) - (s.produced_qty || 0))
                // Gross = Total Planned Qty (For Coverage Display)
                const gross = s.planned_qty || 0

                dayMap.set(s.item_id, {
                    net: current.net + remaining,
                    gross: current.gross + gross
                })
            })
        }

        // 5. Get BOMs
        const bomHeaders = await bomsRepo.list(companyId, { is_active: true })
        const bomMap = new Map(bomHeaders.map(b => [b.item_id, b]))

        // 6. Processing
        const result: ItemPlan[] = []
        const alerts: PlanningAlert[] = []

        const dates: string[] = []
        let curr = new Date(startDate)
        const end = new Date(endDate)
        while (curr <= end) {
            dates.push(curr.toISOString().split('T')[0])
            curr.setDate(curr.getDate() + 1)
        }

        finalEligibleItems.forEach(item => {
            const bom = bomMap.get(item.id)
            const isFinishedGood = (item.type as string) === 'finished_good'

            // STRICT FILTERING: 
            // Eligible for Plan = Type Finished Good AND Has Active BOM.
            const isEligible = isFinishedGood && !!bom

            let currentBalance = stockMap.get(item.id) || 0
            const days: DailyPlan[] = []
            let totalShortage = 0

            // Cumulative counters
            let accumulatedNetProduction = 0

            // For Alerts: check if there is ANY demand for this item
            let totalDemandPeriod = 0
            const demandDates: { date: string, qty: number }[] = []

            dates.forEach(date => {
                const demand = demandMap.get(date)?.get(item.id) || 0
                const supplyData = supplyMap.get(date)?.get(item.id) || { net: 0, gross: 0 }

                const productionNet = supplyData.net
                const productionGross = supplyData.gross

                accumulatedNetProduction += productionNet

                if (demand > 0) {
                    totalDemandPeriod += demand
                    demandDates.push({ date, qty: demand })
                }

                if (isEligible) {
                    const balanceStart = currentBalance
                    const balanceEnd = balanceStart - demand + productionNet
                    const shortage = balanceEnd < 0 ? Math.abs(balanceEnd) : 0

                    let recipes = 0
                    if (shortage > 0 && bom && bom.yield_qty > 0) {
                        recipes = Math.ceil(shortage / bom.yield_qty)
                    }

                    const stats = dayStatsMap.get(date)

                    days.push({
                        date,
                        demand,
                        production: productionNet, // Keep net for compatibility but usually standard display wants produced? No, usually planned.
                        accumulated_production: accumulatedNetProduction,
                        balance_start: balanceStart,
                        balance_end: balanceEnd,
                        shortage,
                        recipes_needed: recipes,
                        bom_yield: bom?.yield_qty || 0,
                        bom_id: bom?.id,
                        routes_count: stats?.routes || 0,
                        orders_count: stats?.orders || 0
                    })
                    currentBalance = balanceEnd
                }
            })

            // DECISION: Result vs Alert
            if (isEligible) {
                // If it's eligible, we add to result if there's any activity (stock != 0 OR demand OR production)
                // Minimizing noise: show if current_stock != 0 OR has demand OR has production
                const hasActivity = (stockMap.get(item.id) || 0) !== 0 || days.some(d => d.demand > 0 || d.production > 0)

                if (hasActivity) {
                    const minBalance = Math.min(...days.map(d => d.balance_end))
                    totalShortage = minBalance < 0 ? Math.abs(minBalance) : 0

                    result.push({
                        item_id: item.id,
                        item_name: item.name,
                        item_sku: item.sku || '',
                        uom: item.uom,
                        current_stock: stockMap.get(item.id) || 0,
                        days,
                        total_shortage: totalShortage,
                        has_bom: true
                    })
                }
            } else {
                // Not Eligible (Not Finished Good OR No BOM)
                // IF it has demand, generate ALERT
                if (totalDemandPeriod > 0) {
                    demandDates.forEach(d => {
                        alerts.push({
                            item_id: item.id,
                            item_name: item.name,
                            item_sku: item.sku || '',
                            uom: item.uom,
                            date: d.date,
                            quantity: d.qty,
                            type: !isFinishedGood ? 'not_finished_good' : 'no_bom'
                        })
                    })
                }
            }
        })

        return { items: result, alerts }
    },

    async generateWorkOrders(companyId: string, userId: string, payload: {
        date: string
        items: { item_id: string, qty: number, bom_id?: string, route_id?: string }[]
    }) {
        const results = []

        // Fetch profiles for batch logic
        const itemIds = payload.items.map(i => i.item_id)
        const { data: profiles } = await supabaseServer
            .from('item_production_profiles')
            .select('item_id, batch_size')
            .in('item_id', itemIds)
            .eq('company_id', companyId)

        const profileMap = new Map(profiles?.map(p => [p.item_id, p]) || [])

        for (const item of payload.items) {
            // Apply Batch/Rounding Logic
            const profile = profileMap.get(item.item_id)
            const batchSize = profile?.batch_size || 1
            const batches = Math.ceil(item.qty / batchSize)
            const finalQty = batches * batchSize

            let query = supabaseServer
                .from('work_orders')
                .select('*')
                .eq('company_id', companyId)
                .eq('item_id', item.item_id)
                .eq('scheduled_date', payload.date)
                .is('deleted_at', null)
                .in('status', ['planned', 'in_progress'])

            const { data: existingOps } = await query

            if (existingOps && existingOps.length > 0) {
                // Update the first one found (or prefer 'planned')
                const targetOp = existingOps.find(op => op.status === 'planned') || existingOps[0]

                // If updating, we add to existing. 
                // But wait, if we are "generating for the day", usually we pass the deficit.
                // If we add `finalQty` (which is round(deficit)), we might be double rounding if we are not careful?
                // The prompt says: "sugerida = ceil(Falta / batch)".
                // Here `item.qty` IS the Falta passed by the UI.
                // So adding it to existing `planned_qty` might be correct IF the UI sends the *increment*.
                // BUT, if there is already an OP, the Falta is likely calculated *after* that OP is considered?
                // No, "Prod. Planejada" covers existing OPs. "Falta" is what remains.
                // So yes, we simply add the new requirement.
                // Note: If we really want to enforce batching on the TOTAL, we should sum (existing + new), round that, and set the difference.
                // But simpler approach: distinct OPs or just add rounded increment.
                // Let's stick to: New Qty = Old Qty + Rounded(Shortage) 
                // This preserves manual edits on Old Qty and just adds a "batch" for the new shortage.

                const newQty = (targetOp.planned_qty || 0) + finalQty

                const { data: updated, error } = await supabaseServer
                    .from('work_orders')
                    .update({ planned_qty: newQty })
                    .eq('id', targetOp.id)
                    .select()
                    .single()

                if (error) throw error
                results.push({ op: updated, action: 'updated' })

                // @ts-ignore
                const { error: auditErr } = await supabaseServer.from('audit_logs').insert({
                    company_id: companyId,
                    user_id: userId,
                    action: 'update_work_order',
                    entity_type: 'work_orders',
                    entity_id: targetOp.id,
                    details: { old_qty: targetOp.planned_qty, new_qty: newQty, added_qty: finalQty, batch_size: batchSize }
                })
                if (auditErr) console.error("Audit Error:", auditErr)

            } else {
                // Create new
                // @ts-ignore
                const { data: created, error } = await supabaseServer
                    .from('work_orders')
                    .insert({
                        company_id: companyId,
                        item_id: item.item_id,
                        planned_qty: finalQty,
                        bom_id: item.bom_id,
                        scheduled_date: payload.date,
                        status: 'planned',
                        route_id: item.route_id || null
                    })
                    .select()
                    .single()

                if (error) throw error
                results.push({ op: created, action: 'created' })

                // @ts-ignore
                const { error: auditErr } = await supabaseServer.from('audit_logs').insert({
                    company_id: companyId,
                    user_id: userId,
                    action: 'create_work_order',
                    entity_type: 'work_orders',
                    entity_id: created.id,
                    details: { qty: finalQty, original_req: item.qty, item_id: item.item_id, batch_size: batchSize }
                })
                if (auditErr) console.error("Audit Error:", auditErr)
            }
        }
        return results
    },

    async deleteWorkOrder(companyId: string, userId: string, workOrderId: string) {
        const { data: wo, error } = await supabaseServer
            .from('work_orders')
            .select('*')
            .eq('company_id', companyId)
            .eq('id', workOrderId)
            .single()

        if (error || !wo) throw new Error("Ordem de produção não encontrada.")

        if (wo.status !== 'planned') {
            throw new Error("Apenas ordens planejadas podem ser excluídas. Use 'Cancelar' para outros status.")
        }

        if (wo.produced_qty > 0) {
            throw new Error("Não é possível excluir: existem apontamentos de produção.")
        }

        const { count: consumptionCount } = await supabaseServer
            .from('work_order_consumptions')
            .select('id', { count: 'exact', head: true })
            .eq('work_order_id', workOrderId)

        if (consumptionCount && consumptionCount > 0) {
            throw new Error("Não é possível excluir: existem consumos vinculados.")
        }

        const { error: deleteErr } = await supabaseServer
            .from('work_orders')
            // @ts-ignore
            .update({ deleted_at: new Date().toISOString() })
            .eq('company_id', companyId)
            .eq('id', workOrderId)

        if (deleteErr) throw deleteErr

        // @ts-ignore
        await supabaseServer.from('audit_logs').insert({
            company_id: companyId,
            user_id: userId,
            action: 'delete_work_order',
            entity_type: 'work_orders',
            entity_id: workOrderId,
            details: { planned_qty: wo.planned_qty, item_id: wo.item_id }
        })

        return { success: true }
    },

    async updateWorkOrder(companyId: string, userId: string, workOrderId: string, payload: {
        planned_qty?: number,
        scheduled_date?: string,
        notes?: string,
    }, reason?: string) {
        const { data: wo, error } = await supabaseServer
            .from('work_orders')
            .select('*')
            .eq('company_id', companyId)
            .eq('id', workOrderId)
            .single()

        if (error || !wo) throw new Error("Ordem de produção não encontrada.")

        const isInProgress = wo.status === 'in_progress' || wo.status === 'em_producao'
        const isDone = wo.status === 'done' || wo.status === 'concluida'
        const isCancelled = wo.status === 'cancelled' || wo.status === 'cancelada'

        const qtyChanged = payload.planned_qty !== undefined && payload.planned_qty !== wo.planned_qty
        const dateChanged = payload.scheduled_date !== undefined && payload.scheduled_date !== wo.scheduled_date

        if (isDone || isCancelled) {
            if (qtyChanged || dateChanged) {
                throw new Error("Não é possível alterar dados de uma ordem encerrada ou cancelada.")
            }
        }

        if (isInProgress) {
            if (qtyChanged) {
                if (!reason) {
                    throw new Error("Motivo obrigatório para alterar quantidade de ordem em andamento.")
                }
            }
        }

        const updates: any = {}
        if (payload.planned_qty !== undefined) updates.planned_qty = payload.planned_qty
        if (payload.scheduled_date !== undefined) updates.scheduled_date = payload.scheduled_date
        if (payload.notes !== undefined) updates.notes = payload.notes

        if (Object.keys(updates).length === 0) return { success: true }

        const { data: updated, error: updateErr } = await supabaseServer
            .from('work_orders')
            .update(updates)
            .eq('company_id', companyId)
            .eq('id', workOrderId)
            .select()
            .single()

        if (updateErr) throw updateErr

        // @ts-ignore
        await supabaseServer.from('audit_logs').insert({
            company_id: companyId,
            user_id: userId,
            action: 'update_work_order',
            entity_type: 'work_orders',
            entity_id: workOrderId,
            details: {
                changes: updates,
                reason: reason,
                reason_type: qtyChanged ? 'PLANNED_QTY_CHANGE_IN_PROGRESS' : undefined
            }
        })

        return { success: true, data: updated }
    },

    async checkNegativeStockBeforeClose(companyId: string, workOrderId: string): Promise<{ hasNegative: boolean, negativeItems: Array<{ item_id: string, item_name: string, balance_after: number, uom: string }> }> {
        // Get work order + BOM
        const { data: wo } = await supabaseServer
            .from('work_orders')
            .select('id, item_id, bom_id, produced_qty')
            .eq('company_id', companyId)
            .eq('id', workOrderId)
            .single()

        if (!wo || !wo.bom_id) {
            return { hasNegative: false, negativeItems: [] }
        }

        // Get BOM yield
        const { data: bomHeader } = await supabaseServer
            .from('bom_headers')
            .select('yield_qty')
            .eq('id', wo.bom_id)
            .single()

        const yieldQty = bomHeader?.yield_qty || 1
        const factor = wo.produced_qty / yieldQty

        // Get BOM lines (ingredients)
        const { data: bomLines } = await supabaseServer
            .from('bom_lines')
            .select('component_item_id, qty, items:items(name, uom)')
            .eq('bom_id', wo.bom_id)

        if (!bomLines || bomLines.length === 0) {
            return { hasNegative: false, negativeItems: [] }
        }

        // Get current stock for all ingredients
        const itemIds = bomLines.map(l => l.component_item_id)
        // @ts-ignore
        const { data: balances } = await supabaseServer
            .from('inventory_balances')
            .select('item_id, on_hand')
            .eq('company_id', companyId)
            .in('item_id', itemIds)

        const stockMap = new Map((balances || []).map(b => [b.item_id, b.on_hand || 0]))

        const negativeItems: Array<{ item_id: string, item_name: string, balance_after: number, uom: string }> = []

        for (const line of bomLines) {
            const currentStock = stockMap.get(line.component_item_id) || 0
            const consumedQty = line.qty * factor
            const balanceAfter = currentStock - consumedQty

            if (balanceAfter < 0) {
                // @ts-ignore
                const itemName = line.items?.name || 'Item Desconhecido'
                // @ts-ignore
                const uom = line.items?.uom || 'UN'
                negativeItems.push({
                    item_id: line.component_item_id,
                    item_name: itemName,
                    balance_after: balanceAfter,
                    uom
                })
            }
        }

        return {
            hasNegative: negativeItems.length > 0,
            negativeItems
        }
    },

    async changeWorkOrderStatus(companyId: string, userId: string, workOrderId: string, newStatus: string, reason?: string, negativeStockConfirmed?: boolean, negativeStockReason?: string, negativeStockNote?: string) {
        const { data: wo, error } = await supabaseServer
            .from('work_orders')
            .select('*')
            .eq('company_id', companyId)
            .eq('id', workOrderId)
            .single()

        if (error || !wo) throw new Error("Ordem de produção não encontrada.")

        const currentStatus = wo.status

        if (currentStatus === 'done' || currentStatus === 'cancelled') {
            throw new Error(`Não é possível alterar status de uma ordem ${currentStatus === 'done' ? 'encerrada' : 'cancelada'}.`)
        }

        const updates: any = { status: newStatus }
        let logAction = newStatus === 'done' ? 'close_work_order' :
            newStatus === 'cancelled' ? 'cancel_work_order' :
                'change_work_order_status'
        let details: any = { from: currentStatus, to: newStatus }

        if (newStatus === 'in_progress') {
            if (currentStatus !== 'planned' && currentStatus !== 'planejada') throw new Error("Apenas ordens planejadas podem ser iniciadas.")
            if (!wo.started_at) updates.started_at = new Date().toISOString()
        }
        else if (newStatus === 'done') {
            if (currentStatus !== 'in_progress' && currentStatus !== 'em_producao') throw new Error("Apenas ordens em progresso podem ser finalizadas.")
            if (!wo.finished_at) updates.finished_at = new Date().toISOString()

            // Check for negative stock BEFORE closing
            const negativeCheck = await this.checkNegativeStockBeforeClose(companyId, workOrderId)

            if (negativeCheck.hasNegative && !negativeStockConfirmed) {
                // Return error with special payload for UI to show confirmation modal
                const error: any = new Error("NEGATIVE_STOCK_DETECTED")
                error.negativeItems = negativeCheck.negativeItems
                throw error
            }

            if (wo.planned_qty !== wo.produced_qty) {
                if (!reason) {
                    throw new Error("Motivo obrigatório para finalizar com diferença entre planejado e produzido.")
                }
                details.reason = reason
                details.reason_type = wo.produced_qty > wo.planned_qty ? 'OVER_PRODUCTION' : 'UNDER_PRODUCTION'
                details.planned_qty = wo.planned_qty
                details.produced_qty = wo.produced_qty
            }

            // If confirmed with negative stock, change audit action and add details
            if (negativeStockConfirmed && negativeCheck.hasNegative) {
                logAction = 'close_work_order_with_negative_stock'
                details.negative_items = negativeCheck.negativeItems
                details.negative_stock_reason = negativeStockReason
                details.negative_stock_note = negativeStockNote
            }
        }
        else if (newStatus === 'cancelled') {
            if (wo.produced_qty > 0) {
                throw new Error("Não é possível cancelar uma ordem que já possui produção apontada.")
            }
            const { count } = await supabaseServer
                .from('work_order_consumptions')
                .select('id', { count: 'exact', head: true })
                .eq('work_order_id', workOrderId)

            if (count && count > 0) {
                throw new Error("Não é possível cancelar uma ordem que já possui consumos registrados.")
            }
        }

        const { data: updated, error: updateErr } = await supabaseServer
            .from('work_orders')
            .update(updates)
            .eq('company_id', companyId)
            .eq('id', workOrderId)
            .select()
            .single()

        if (updateErr) throw updateErr

        // @ts-ignore
        await supabaseServer.from('audit_logs').insert({
            company_id: companyId,
            user_id: userId,
            action: logAction,
            entity_type: 'work_orders',
            entity_id: workOrderId,
            details: details
        })

        return { success: true, data: updated }
    }
}
