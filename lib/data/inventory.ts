import { supabaseServer } from '@/lib/supabase/server'
import { itemsRepo } from './items'
import type { Database } from '@/types/supabase'

export interface InventoryMovement {
    id: string
    company_id: string
    item_id: string
    qty_in: number
    qty_out: number
    movement_type: 'ENTRADA' | 'SAIDA' | 'AJUSTE'
    qty_base: number
    reason: string
    reference_type: string | null
    reference_id: string | null
    source_ref: string | null
    notes: string | null
    created_at: string
    occurred_at: string
}

export interface StockSummary {
    item_id: string
    item_name: string
    item_sku: string | null
    item_type: string
    uom: string
    current_stock: number
    avg_cost: number
}

type InventoryMovementInsert = Database['public']['Tables']['inventory_movements']['Insert']

export const inventoryRepo = {
    async getStock(companyId: string, itemId: string): Promise<number> {
        const { data, error } = await supabaseServer
            .from('inventory_movements')
            .select('qty_in, qty_out')
            .eq('company_id', companyId)
            .eq('item_id', itemId)

        if (error) throw error

        const stock = (data as any)?.reduce((acc: number, mov: any) => acc + mov.qty_in - mov.qty_out, 0) || 0
        return stock
    },

    async getStockByItems(companyId: string): Promise<StockSummary[]> {
        // Get all items
        const items = await itemsRepo.list(companyId, { is_active: true })

        // Get stock for each item
        const stockPromises = items.map(async (item) => {
            const stock = await this.getStock(companyId, item.id)
            return {
                item_id: item.id,
                item_name: item.name,
                item_sku: item.sku,
                item_type: item.type,
                uom: item.uom,
                current_stock: stock,
                avg_cost: item.avg_cost
            }
        })

        return Promise.all(stockPromises)
    },

    async getMovements(companyId: string, filters?: { item_id?: string; reason?: string; limit?: number }) {
        let query = supabaseServer
            .from('inventory_movements')
            .select(`
                *,
                item:items(id, name, sku, uom)
            `)
            .eq('company_id', companyId)
            .order('created_at', { ascending: false })

        if (filters?.item_id) {
            query = query.eq('item_id', filters.item_id)
        }

        if (filters?.reason) {
            query = query.eq('reason', filters.reason)
        }

        if (filters?.limit) {
            query = query.limit(filters.limit)
        }

        const { data, error } = await query
        if (error) throw error
        return data as unknown as InventoryMovement[]
    },

    async createMovement(companyId: string, movement: Partial<InventoryMovement>) {
        const insertPayload = { ...movement, company_id: companyId } as InventoryMovementInsert
        const { data, error } = await supabaseServer
            .from('inventory_movements')
            .insert(insertPayload)
            .select()
            .single()

        if (error) throw error
        return data as unknown as InventoryMovement
    },

    async createPurchaseIn(companyId: string, payload: {
        item_id: string
        qty: number
        unit_cost: number
        notes?: string
    }) {
        const { item_id, qty, unit_cost, notes } = payload

        // Get current stock and avg cost
        const currentStock = await this.getStock(companyId, item_id)
        const item = await itemsRepo.getById(companyId, item_id)
        const currentAvgCost = item.avg_cost

        // Create movement
        const movement = await this.createMovement(companyId, {
            item_id,
            qty_in: qty,
            qty_out: 0,
            qty_base: qty,
            movement_type: 'ENTRADA',
            reason: 'purchase_in',
            notes,
            occurred_at: new Date().toISOString()
        })

        // Recalculate avg cost
        await this.recalcAvgCost(companyId, item_id, currentStock, currentAvgCost, qty, unit_cost)

        return movement
    },

    async recalcAvgCost(
        companyId: string,
        itemId: string,
        currentStock: number,
        currentAvgCost: number,
        qtyIn: number,
        unitCost: number
    ) {
        // Avoid division by zero
        const newStock = currentStock + qtyIn
        if (newStock <= 0) {
            await itemsRepo.updateAvgCost(companyId, itemId, 0)
            return 0
        }

        // Calculate new average cost
        const { calculateNewAverageCost } = await import('@/lib/domain/inventory/cost');
        const newAvgCost = calculateNewAverageCost(currentStock, currentAvgCost, qtyIn, unitCost);

        // Update item
        await itemsRepo.updateAvgCost(companyId, itemId, newAvgCost)

        return newAvgCost
    },

    async createAdjustment(companyId: string, payload: {
        item_id: string
        qty: number
        reason: 'adjustment_in' | 'adjustment_out'
        notes?: string
    }) {
        const { item_id, qty, reason, notes } = payload

        const movement = await this.createMovement(companyId, {
            item_id,
            qty_in: reason === 'adjustment_in' ? qty : 0,
            qty_out: reason === 'adjustment_out' ? qty : 0,
            qty_base: qty,
            movement_type: reason === 'adjustment_in' ? 'ENTRADA' : 'SAIDA',
            reason,
            notes,
            occurred_at: new Date().toISOString()
        })

        // If adjustment in, recalculate avg cost with current avg cost as unit cost
        if (reason === 'adjustment_in') {
            const currentStock = await this.getStock(companyId, item_id)
            const item = await itemsRepo.getById(companyId, item_id)
            await this.recalcAvgCost(companyId, item_id, currentStock - qty, item.avg_cost, qty, item.avg_cost)
        }

        return movement
    }
}
