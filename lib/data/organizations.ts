import { supabaseServer } from '@/lib/supabase/server'
import { Organization } from '@/lib/clients-db'
import type { Database } from '@/types/supabase'

type OrganizationInsert = Database['public']['Tables']['organizations']['Insert']
type OrganizationUpdate = Database['public']['Tables']['organizations']['Update']

export const organizationsRepo = {
    async list(companyId: string) {
        const { data, error } = await supabaseServer
            .from('organizations')
            .select('*')
            .eq('company_id', companyId)
            .is('deleted_at', null)
            .order('created_at', { ascending: false })

        if (error) throw error
        return data as any as Organization[]
    },

    async getById(companyId: string, id: string) {
        const { data, error } = await supabaseServer
            .from('organizations')
            .select('*')
            .eq('company_id', companyId)
            .eq('id', id)
            .is('deleted_at', null)
            .single()

        if (error) throw error
        return data as any as Organization
    },

    async create(companyId: string, payload: Partial<Organization>) {
        const insertPayload = { ...payload, company_id: companyId } as OrganizationInsert
        const { data, error } = await supabaseServer
            .from('organizations')
            .insert(insertPayload)
            .select()
            .single()

        if (error) throw error
        return data as any as Organization
    },

    async update(companyId: string, id: string, payload: Partial<Organization>) {
        const updatePayload = payload as OrganizationUpdate
        const { data, error } = await supabaseServer
            .from('organizations')
            .update(updatePayload)
            .eq('company_id', companyId)
            .eq('id', id)
            .select()
            .single()

        if (error) throw error
        return data as any as Organization
    },

    async softDelete(companyId: string, id: string) {
        const payload: OrganizationUpdate = { deleted_at: new Date().toISOString() }
        const { error } = await supabaseServer
            .from('organizations')
            .update(payload)
            .eq('company_id', companyId)
            .eq('id', id)

        if (error) throw error
    },
}
