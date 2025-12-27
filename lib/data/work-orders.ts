import { supabaseServer } from '@/lib/supabase/server'

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
        const { data, error } = await supabaseServer
            .from('work_orders')
            // @ts-ignore - Types will be regenerated after migration
            .insert({ ...payload, company_id: companyId })
            .select()
            .single()

        if (error) throw error
        return data as WorkOrder
    },

    async update(companyId: string, id: string, payload: Partial<WorkOrder>) {
        const { data, error } = await supabaseServer
            .from('work_orders')
            // @ts-ignore - Types will be regenerated after migration
            .update(payload)
            .eq('company_id', companyId)
            .eq('id', id)
            .select()
            .single()

        if (error) throw error
        return data as WorkOrder
    },

    async softDelete(companyId: string, id: string) {
        const { error } = await supabaseServer
            .from('work_orders')
            // @ts-ignore - Types will be regenerated after migration
            .update({ deleted_at: new Date().toISOString() })
            .eq('company_id', companyId)
            .eq('id', id)

        if (error) throw error
    },

    async updateStatus(companyId: string, id: string, status: WorkOrder['status'], additionalFields?: Partial<WorkOrder>) {
        const updateData: any = { status, ...additionalFields }

        if (status === 'in_progress' && !additionalFields?.started_at) {
            updateData.started_at = new Date().toISOString()
        }

        if (status === 'done' && !additionalFields?.finished_at) {
            updateData.finished_at = new Date().toISOString()
        }

        const { data, error } = await supabaseServer
            .from('work_orders')
            // @ts-ignore - Types will be regenerated after migration
            .update(updateData)
            .eq('company_id', companyId)
            .eq('id', id)
            .select()
            .single()

        if (error) throw error
        return data as WorkOrder
    }
}
