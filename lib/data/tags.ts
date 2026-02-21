import { supabaseServer } from '@/lib/supabase/server'
import { OrganizationTag } from '@/lib/clients-db'
import type { Database } from '@/types/supabase'

type Tag = OrganizationTag

interface TagLink {
    company_id: string
    organization_id: string
    tag_id: string
}

type OrganizationTagInsert = Database['public']['Tables']['organization_tags']['Insert']
type OrganizationTagUpdate = Database['public']['Tables']['organization_tags']['Update']
type OrganizationTagLinkInsert = Database['public']['Tables']['organization_tag_links']['Insert']

export const tagsRepo = {
    // --- Tags Management ---
    async list(companyId: string) {
        const { data, error } = await supabaseServer
            .from('organization_tags')
            .select('*')
            .eq('company_id', companyId)
            .is('deleted_at', null)
            .order('name', { ascending: true })

        if (error) throw error
        return data as Tag[]
    },

    async create(companyId: string, name: string) {
        const payload: OrganizationTagInsert = { company_id: companyId, name }
        const { data, error } = await supabaseServer
            .from('organization_tags')
            .insert(payload)
            .select()
            .single()

        if (error) throw error
        return data as Tag
    },

    async delete(companyId: string, id: string) {
        // Tags might be hard deleted if no references, or soft deleted.
        // Spec asked for soft deletions generally, sticking to soft delete column if it exists.
        // Migration has deleted_at column for tags.
        const payload: OrganizationTagUpdate = { deleted_at: new Date().toISOString() }
        const { error } = await supabaseServer
            .from('organization_tags')
            .update(payload)
            .eq('company_id', companyId)
            .eq('id', id)

        if (error) throw error
    },

    // --- Tag Linking ---
    async linkTag(companyId: string, organizationId: string, tagId: string) {
        const payload: OrganizationTagLinkInsert = {
            company_id: companyId,
            organization_id: organizationId,
            tag_id: tagId
        }
        const { data, error } = await supabaseServer
            .from('organization_tag_links')
            .insert(payload)
            .select()
            .single()

        // Tag links might not need to return the object, but consistent return is nice.
        if (error) throw error
        return data as TagLink
    },

    async unlinkTag(companyId: string, organizationId: string, tagId: string) {
        const { error } = await supabaseServer
            .from('organization_tag_links')
            .delete()
            .eq('company_id', companyId)
            .eq('organization_id', organizationId)
            .eq('tag_id', tagId)

        if (error) throw error
    },

    async getTagsForOrganization(companyId: string, organizationId: string) {
        // This requires a join. 
        // Supabase JS syntax:
        const { data, error } = await supabaseServer
            .from('organization_tag_links')
            .select('tag_id, organization_tags!inner(*)')
            .eq('company_id', companyId)
            .eq('organization_id', organizationId)
            .is('organization_tags.deleted_at', null)

        if (error) throw error
        // Flatten the result to return Tag[]
        return data.map((d: any) => d.organization_tags) as Tag[]
    }
}
