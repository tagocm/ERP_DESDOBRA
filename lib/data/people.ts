import { supabaseServer } from '@/lib/supabase/server'
import { Person } from '@/lib/clients-db'

export const peopleRepo = {
    async list(companyId: string, organizationId?: string) {
        let query = supabaseServer
            .from('people')
            .select('*')
            .eq('company_id', companyId)
            .is('deleted_at', null)
            .order('is_primary', { ascending: false }) // Primary contacts first
            .order('created_at', { ascending: false })

        if (organizationId) {
            query = query.eq('organization_id', organizationId)
        }

        const { data, error } = await query
        if (error) throw error
        return data as any as Person[]
    },

    async getById(companyId: string, id: string) {
        const { data, error } = await supabaseServer
            .from('people')
            .select('*')
            .eq('company_id', companyId)
            .eq('id', id)
            .is('deleted_at', null)
            .single()

        if (error) throw error
        return data as any as Person
    },

    async create(companyId: string, payload: Partial<Person>) {
        const { data, error } = await supabaseServer
            .from('people')
            // @ts-ignore - Types will be regenerated after migration
            .insert({ ...payload, company_id: companyId })
            .select()
            .single()

        if (error) throw error
        return data as any as Person
    },

    async update(companyId: string, id: string, payload: Partial<Person>) {
        const { data, error } = await supabaseServer
            .from('people')
            // @ts-ignore - Types will be regenerated after migration
            .update(payload)
            .eq('company_id', companyId)
            .eq('id', id)
            .select()
            .single()

        if (error) throw error
        return data as any as Person
    },

    async softDelete(companyId: string, id: string) {
        const { error } = await supabaseServer
            .from('people')
            // @ts-ignore - Types will be regenerated after migration
            .update({ deleted_at: new Date().toISOString() })
            .eq('company_id', companyId)
            .eq('id', id)

        if (error) throw error
    },
}
