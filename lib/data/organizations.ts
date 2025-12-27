import { supabaseServer } from '@/lib/supabase/server'
import { Organization } from '@/lib/clients-db'

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
        const { data, error } = await supabaseServer
            .from('organizations')
            // @ts-ignore - Types will be regenerated after migration
            .insert({ ...payload, company_id: companyId })
            .select()
            .single()

        if (error) throw error
        return data as any as Organization
    },

    async update(companyId: string, id: string, payload: Partial<Organization>) {
        const { data, error } = await supabaseServer
            .from('organizations')
            // @ts-ignore - Types will be regenerated after migration
            .update(payload)
            .eq('company_id', companyId)
            .eq('id', id)
            .select()
            .single()

        if (error) throw error
        return data as any as Organization
    },

    async softDelete(companyId: string, id: string) {
        const { error } = await supabaseServer
            .from('organizations')
            // @ts-ignore - Types will be regenerated after migration
            .update({ deleted_at: new Date().toISOString() })
            .eq('company_id', companyId)
            .eq('id', id)

        if (error) throw error
    },
}
