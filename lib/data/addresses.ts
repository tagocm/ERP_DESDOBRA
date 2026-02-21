import { supabaseServer } from '@/lib/supabase/server'
import { Address } from '@/lib/clients-db'
import type { Database } from '@/types/supabase'

type AddressInsert = Database['public']['Tables']['addresses']['Insert']
type AddressUpdate = Database['public']['Tables']['addresses']['Update']

export const addressesRepo = {
    async list(companyId: string, organizationId?: string) {
        let query = supabaseServer
            .from('addresses')
            .select('*')
            .eq('company_id', companyId)
            .is('deleted_at', null)
            .order('is_default', { ascending: false })
            .order('created_at', { ascending: false })

        if (organizationId) {
            query = query.eq('organization_id', organizationId)
        }

        const { data, error } = await query
        if (error) throw error
        return data as Address[]
    },

    async getById(companyId: string, id: string) {
        const { data, error } = await supabaseServer
            .from('addresses')
            .select('*')
            .eq('company_id', companyId)
            .eq('id', id)
            .is('deleted_at', null)
            .single()

        if (error) throw error
        return data as Address
    },

    async create(companyId: string, payload: Partial<Address>) {
        const insertPayload = { ...payload, company_id: companyId } as AddressInsert
        const { data, error } = await supabaseServer
            .from('addresses')
            .insert(insertPayload)
            .select()
            .single()

        if (error) throw error
        return data as Address
    },

    async update(companyId: string, id: string, payload: Partial<Address>) {
        const updatePayload = payload as AddressUpdate
        const { data, error } = await supabaseServer
            .from('addresses')
            .update(updatePayload)
            .eq('company_id', companyId)
            .eq('id', id)
            .select()
            .single()

        if (error) throw error
        return data as Address
    },

    async softDelete(companyId: string, id: string) {
        const payload: AddressUpdate = { deleted_at: new Date().toISOString() }
        const { error } = await supabaseServer
            .from('addresses')
            .update(payload)
            .eq('company_id', companyId)
            .eq('id', id)

        if (error) throw error
    },
}
