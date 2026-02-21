import { supabaseServer } from '@/lib/supabase/server'
import type { Database } from '@/types/supabase'

export interface Item {
    id: string
    company_id: string
    sku: string | null
    name: string
    type: 'raw_material' | 'packaging' | 'wip' | 'finished_good' | 'service'
    uom: string
    is_active: boolean
    avg_cost: number
    created_at: string
    updated_at: string
    deleted_at: string | null
}

type ItemInsert = Database['public']['Tables']['items']['Insert']
type ItemUpdate = Database['public']['Tables']['items']['Update']

export const itemsRepo = {
    async list(companyId: string, filters?: { type?: string; is_active?: boolean; search?: string }) {
        let query = supabaseServer
            .from('items')
            .select('*')
            .eq('company_id', companyId)
            .is('deleted_at', null)
            .order('name', { ascending: true })

        if (filters?.type) {
            query = query.eq('type', filters.type)
        }

        if (filters?.is_active !== undefined) {
            query = query.eq('is_active', filters.is_active)
        }

        if (filters?.search) {
            query = query.or(`name.ilike.%${filters.search}%,sku.ilike.%${filters.search}%`)
        }

        const { data, error } = await query
        if (error) throw error
        return data as Item[]
    },

    async getById(companyId: string, id: string) {
        const { data, error } = await supabaseServer
            .from('items')
            .select('*')
            .eq('company_id', companyId)
            .eq('id', id)
            .is('deleted_at', null)
            .single()

        if (error) throw error
        return data as Item
    },

    async create(companyId: string, payload: Partial<Item>) {
        const insertPayload = { ...payload, company_id: companyId } as ItemInsert
        const { data, error } = await supabaseServer
            .from('items')
            .insert(insertPayload)
            .select()
            .single()

        if (error) throw error
        return data as Item
    },

    async update(companyId: string, id: string, payload: Partial<Item>) {
        const updatePayload = payload as ItemUpdate
        const { data, error } = await supabaseServer
            .from('items')
            .update(updatePayload)
            .eq('company_id', companyId)
            .eq('id', id)
            .select()
            .single()

        if (error) throw error
        return data as Item
    },

    async softDelete(companyId: string, id: string) {
        const payload: ItemUpdate = { deleted_at: new Date().toISOString() }
        const { error } = await supabaseServer
            .from('items')
            .update(payload)
            .eq('company_id', companyId)
            .eq('id', id)

        if (error) throw error
    },

    async updateAvgCost(companyId: string, id: string, newAvgCost: number) {
        const payload: ItemUpdate = { avg_cost: newAvgCost }
        const { error } = await supabaseServer
            .from('items')
            .update(payload)
            .eq('company_id', companyId)
            .eq('id', id)

        if (error) throw error
    }
}
