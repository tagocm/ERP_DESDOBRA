import { supabaseServer } from '@/lib/supabase/server'
import { Address } from '@/lib/clients-db'

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
        const { data, error } = await supabaseServer
            .from('addresses')
            // @ts-ignore - Types will be regenerated after migration
            .insert({ ...payload, company_id: companyId })
            .select()
            .single()

        if (error) throw error
        return data as Address
    },

    async update(companyId: string, id: string, payload: Partial<Address>) {
        const { data, error } = await supabaseServer
            .from('addresses')
            // @ts-ignore - Types will be regenerated after migration
            .update(payload)
            .eq('company_id', companyId)
            .eq('id', id)
            .select()
            .single()

        if (error) throw error
        return data as Address
    },

    async softDelete(companyId: string, id: string) {
        const { error } = await supabaseServer
            .from('addresses')
            // @ts-ignore - Types will be regenerated after migration
            .update({ deleted_at: new Date().toISOString() })
            .eq('company_id', companyId)
            .eq('id', id)

        if (error) throw error
    },
}
