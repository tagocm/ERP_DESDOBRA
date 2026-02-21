import { supabaseServer } from '@/lib/supabase/server'
import { bomsRepo } from './boms'
import { itemsRepo } from './items'
import { inventoryRepo } from './inventory'
import type { Database } from '@/types/supabase'

export interface WorkOrder {
    id: string
    company_id: string
    item_id: string
    bom_id: string | null
    planned_qty: number
    produced_qty: number
    status: 'planned' | 'in_progress' | 'done' | 'cancelled'
    notes: string | null
    started_at: string | null
    finished_at: string | null
    created_at: string
    updated_at: string
    deleted_at: string | null
}

export interface WorkOrderWithDetails extends WorkOrder {
    item?: {
        id: string
        name: string
        sku: string | null
        uom: string
    }
    bom?: {
        id: string
        version: number
        yield_qty: number
        yield_uom: string
    }
}

type WorkOrderInsert = Database['public']['Tables']['work_orders']['Insert']
type WorkOrderUpdate = Database['public']['Tables']['work_orders']['Update']

export const workOrdersRepo = {
    async list(companyId: string, filters?: { status?: string; item_id?: string }) {
        let query = supabaseServer
            .from('work_orders')
            .select(`
                *,
                item:items!work_orders_item_id_fkey(id, name, sku, uom),
                bom:bom_headers(id, version, yield_qty, yield_uom)
            `)
            .eq('company_id', companyId)
            .is('deleted_at', null)
            .order('created_at', { ascending: false })

        if (filters?.status) {
            query = query.eq('status', filters.status)
        }

        if (filters?.item_id) {
            query = query.eq('item_id', filters.item_id)
        }

        const { data, error } = await query
        if (error) throw error
        return data as WorkOrderWithDetails[]
    },

    async getById(companyId: string, id: string) {
        const { data, error } = await supabaseServer
            .from('work_orders')
            .select(`
                *,
                item:items!work_orders_item_id_fkey(id, name, sku, uom),
                bom:bom_headers(id, version, yield_qty, yield_uom)
            `)
            .eq('company_id', companyId)
            .eq('id', id)
            .is('deleted_at', null)
            .single()

        if (error) throw error
        return data as WorkOrderWithDetails
    },

    async create(companyId: string, payload: Partial<WorkOrder>) {
        const insertPayload = { ...payload, company_id: companyId } as WorkOrderInsert
        const { data, error } = await supabaseServer
            .from('work_orders')
            .insert(insertPayload)
            .select()
            .single()

        if (error) throw error
        return data as WorkOrder
    },

    async update(companyId: string, id: string, payload: Partial<WorkOrder>) {
        const updatePayload = payload as WorkOrderUpdate
        const { data, error } = await supabaseServer
            .from('work_orders')
            .update(updatePayload)
            .eq('company_id', companyId)
            .eq('id', id)
            .select()
            .single()

        if (error) throw error
        return data as WorkOrder
    },

    async softDelete(companyId: string, id: string) {
        const payload: WorkOrderUpdate = { deleted_at: new Date().toISOString() }
        const { error } = await supabaseServer
            .from('work_orders')
            .update(payload)
            .eq('company_id', companyId)
            .eq('id', id)

        if (error) throw error
    },

    async updateStatus(companyId: string, id: string, status: WorkOrder['status'], additionalFields?: Partial<WorkOrder>) {
        const updateData: WorkOrderUpdate = { ...(additionalFields || {}), status }

        if (status === 'in_progress' && !additionalFields?.started_at) {
            updateData.started_at = new Date().toISOString()
        }

        if (status === 'done' && !additionalFields?.finished_at) {
            updateData.finished_at = new Date().toISOString()
        }

        const { data, error } = await supabaseServer
            .from('work_orders')
            .update(updateData)
            .eq('company_id', companyId)
            .eq('id', id)
            .select()
            .single()

        if (error) throw error
        return data as WorkOrder
    },

    async applyWorkOrderStockMovements(companyId: string, workOrderId: string) {
        // 1. Idempotency Check
        const existingMovements = await inventoryRepo.getMovements(companyId, {})

        // Direct query for idempotency to be safe
        const { count } = await supabaseServer
            .from('inventory_movements')
            .select('*', { count: 'exact', head: true })
            .eq('company_id', companyId)
            .eq('reference_type', 'work_order')
            .eq('reference_id', workOrderId)

        if (count && count > 0) {
            console.log(`[applyWorkOrderStockMovements] Movements already exist for WO ${workOrderId}. Skipping.`)
            return { skipped: true, message: 'Movements already exist' }
        }

        // 2. Fetch Work Order
        const workOrder = await this.getById(companyId, workOrderId)
        if (!workOrder) throw new Error('Work order not found')

        // 3. Determine Consumption (Real vs Calculated)
        // Check for existing consumptions
        const { data: consumptions } = await supabaseServer
            .from('work_order_consumptions')
            .select('*')
            .eq('company_id', companyId)
            .eq('work_order_id', workOrderId)

        const inputMovements = []
        let totalProductionCost = 0

        // 3a. Use Real Consumption if exists
        if (consumptions && consumptions.length > 0) {
            for (const consumption of consumptions) {
                const component = await itemsRepo.getById(companyId, consumption.component_item_id)
                const cost = consumption.qty * component.avg_cost
                totalProductionCost += cost

                inputMovements.push({
                    item_id: consumption.component_item_id,
                    qty: consumption.qty,
                    cost: cost,
                    unit_cost: component.avg_cost
                })
            }
        }
        // 3b. Fallback to BOM if no real consumption
        else if (workOrder.bom_id) {
            const bom = await bomsRepo.getById(companyId, workOrder.bom_id)
            // Use produced_qty (if done) or planned_qty
            const refQty = workOrder.produced_qty > 0 ? workOrder.produced_qty : workOrder.planned_qty
            const factor = refQty / bom.yield_qty

            for (const line of bom.lines) {
                const qtyRequired = line.qty * factor
                const component = await itemsRepo.getById(companyId, line.component_item_id)
                const cost = qtyRequired * component.avg_cost
                totalProductionCost += cost

                inputMovements.push({
                    item_id: line.component_item_id,
                    qty: qtyRequired,
                    cost: cost,
                    unit_cost: component.avg_cost
                })
            }

            // 3b.1 Check for byproducts in BOM
            if (bom.byproducts && bom.byproducts.length > 0) {
                // We handle byproducts separately below
            }
        }

        // 4. Create Input Movements (Production OUT - Consumption)
        for (const input of inputMovements) {
            await inventoryRepo.createMovement(companyId, {
                item_id: input.item_id,
                qty_in: 0,
                qty_out: input.qty,
                qty_base: input.qty,
                movement_type: 'SAIDA',
                reason: 'production_out',
                reference_type: 'work_order',
                reference_id: workOrderId,
                source_ref: `wo:${workOrderId}:out:${input.item_id}`,
                notes: `Consumo OP #${workOrderId.substring(0, 8)}`,
                occurred_at: new Date().toISOString()
            })
        }

        // 5. Create Output Movement (Production IN - Finished Good)
        const producedQty = workOrder.produced_qty > 0 ? workOrder.produced_qty : workOrder.planned_qty
        const unitCostProduced = producedQty > 0 ? (totalProductionCost / producedQty) : 0

        await inventoryRepo.createMovement(companyId, {
            item_id: workOrder.item_id,
            qty_in: producedQty,
            qty_out: 0,
            qty_base: producedQty,
            movement_type: 'ENTRADA',
            reason: 'production_in',
            reference_type: 'work_order',
            reference_id: workOrderId,
            source_ref: `wo:${workOrderId}:in:${workOrder.item_id}`,
            notes: `Produção OP #${workOrderId.substring(0, 8)}`,
            occurred_at: new Date().toISOString()
        })

        // 6. Handle Byproducts (if using BOM)
        if (workOrder.bom_id) {
            const bom = await bomsRepo.getById(companyId, workOrder.bom_id)
            if (bom.byproducts && bom.byproducts.length > 0) {
                const refQty = workOrder.produced_qty > 0 ? workOrder.produced_qty : workOrder.planned_qty

                for (const byproduct of bom.byproducts) {
                    let byproductQty = Number(byproduct.qty)
                    if (byproduct.basis === 'PERCENT') {
                        byproductQty = refQty * (Number(byproduct.qty) / 100)
                    } else if (byproduct.basis === 'FIXED') {
                        // Fixed quantity per batch? Or per unit?
                        // Usually per batch (BOM yield). So we scale by batches produced.
                        // Batches = produced / bom_yield
                        const batches = refQty / bom.yield_qty
                        byproductQty = Number(byproduct.qty) * batches
                    }

                    await inventoryRepo.createMovement(companyId, {
                        item_id: byproduct.item_id,
                        qty_in: byproductQty,
                        qty_out: 0,
                        qty_base: byproductQty,
                        movement_type: 'ENTRADA',
                        reason: 'production_byproduct_in',
                        reference_type: 'work_order',
                        reference_id: workOrderId,
                        source_ref: `wo:${workOrderId}:byproduct:${byproduct.item_id}`,
                        notes: `Co-produto OP #${workOrderId.substring(0, 8)}`,
                        occurred_at: new Date().toISOString()
                    })
                }
            }
        }

        // 7. Cost Recalculation (SKIPPED FOR PHASE 1)
        // User requested NO updates to item avg_cost in this phase.
        // We only return the calculated costs for the API response.

        /* 
        const currentStock = await inventoryRepo.getStock(companyId, workOrder.item_id)
        const finishedItem = await itemsRepo.getById(companyId, workOrder.item_id)
        
        await inventoryRepo.recalcAvgCost(
            companyId,
            workOrder.item_id,
            currentStock - producedQty, 
            finishedItem.avg_cost,
            producedQty,
            unitCostProduced
        )
        */

        return {
            success: true,
            costs: {
                total: totalProductionCost,
                unit: unitCostProduced
            }
        }
    }
}
