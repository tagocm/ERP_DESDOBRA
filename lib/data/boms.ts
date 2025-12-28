import { supabaseServer } from '@/lib/supabase/server'

export interface BomHeader {
    id: string
    company_id: string
    item_id: string
    version: number
    yield_qty: number
    yield_uom: string
    is_active: boolean
    created_at: string
    updated_at: string
    deleted_at: string | null
}

export interface BomLine {
    id: string
    company_id: string
    bom_id: string
    component_item_id: string
    qty: number
    uom: string
    sort_order: number
}

export interface BomWithLines extends BomHeader {
    lines: BomLine[]
    byproducts?: any[] // Support for additional outputs
    item?: {
        id: string
        name: string
        sku: string | null
    }
}

export const bomsRepo = {
    async listByItem(companyId: string, itemId: string) {
        const { data, error } = await supabaseServer
            .from('bom_headers')
            .select(`
                *,
                item:items!bom_headers_item_id_fkey(id, name, sku)
            `)
            .eq('company_id', companyId)
            .eq('item_id', itemId)
            .is('deleted_at', null)
            .order('version', { ascending: false })

        if (error) throw error
        return data as BomWithLines[]
    },

    async list(companyId: string, filters?: { is_active?: boolean }) {
        let query = supabaseServer
            .from('bom_headers')
            .select(`
                *,
                item:items!bom_headers_item_id_fkey(id, name, sku)
            `)
            .eq('company_id', companyId)
            .is('deleted_at', null)
            .order('created_at', { ascending: false })

        if (filters?.is_active !== undefined) {
            query = query.eq('is_active', filters.is_active)
        }

        const { data, error } = await query
        if (error) throw error
        return data as BomWithLines[]
    },

    async getById(companyId: string, id: string) {
        const { data: header, error: headerError } = await supabaseServer
            .from('bom_headers')
            .select(`
                *,
                item:items!bom_headers_item_id_fkey(id, name, sku)
            `)
            .eq('company_id', companyId)
            .eq('id', id)
            .is('deleted_at', null)
            .single()

        if (headerError) throw headerError

        const { data: lines, error: linesError } = await supabaseServer
            .from('bom_lines')
            .select(`
                *,
                component:items!bom_lines_component_item_id_fkey(id, name, sku, uom)
            `)
            .eq('bom_id', id)
            .order('sort_order', { ascending: true })

        if (linesError) throw linesError

        // Fetch Byproducts
        const { data: byproducts, error: byproductsError } = await supabaseServer
            .from('bom_byproduct_outputs')
            .select(`
                *,
                item:items!bom_byproduct_outputs_item_id_fkey(name, uom, sku)
            `)
            .eq('bom_id', id)

        if (byproductsError) throw byproductsError

        return {
            ...(header as any),
            lines: lines || [],
            byproducts: byproducts || []
        } as BomWithLines
    },

    async create(companyId: string, header: Partial<BomHeader>, lines: Partial<BomLine>[]) {
        // Create header
        const { data: newHeader, error: headerError } = await supabaseServer
            .from('bom_headers')
            // @ts-ignore - Types will be regenerated after migration
            .insert({ ...header, company_id: companyId })
            .select()
            .single()

        if (headerError) throw headerError

        // Create lines
        if (lines.length > 0) {
            const linesWithBomId = lines.map(line => ({
                ...line,
                company_id: companyId,
                bom_id: (newHeader as any).id
            }))

            const { error: linesError } = await supabaseServer
                .from('bom_lines')
                // @ts-ignore - Types will be regenerated after migration
                .insert(linesWithBomId)

            if (linesError) throw linesError
        }

        return newHeader as BomHeader
    },

    async update(companyId: string, id: string, header: Partial<BomHeader>, lines: Partial<BomLine>[]) {
        // Update header
        const { data: updatedHeader, error: headerError } = await supabaseServer
            .from('bom_headers')
            // @ts-ignore - Types will be regenerated after migration
            .update(header)
            .eq('company_id', companyId)
            .eq('id', id)
            .select()
            .single()

        if (headerError) throw headerError

        // Delete existing lines
        const { error: deleteError } = await supabaseServer
            .from('bom_lines')
            .delete()
            .eq('bom_id', id)

        if (deleteError) throw deleteError

        // Insert new lines
        if (lines.length > 0) {
            const linesWithBomId = lines.map(line => ({
                ...line,
                company_id: companyId,
                bom_id: id
            }))

            const { error: linesError } = await supabaseServer
                .from('bom_lines')
                // @ts-ignore - Types will be regenerated after migration
                .insert(linesWithBomId)

            if (linesError) throw linesError
        }

        return updatedHeader as BomHeader
    },

    async softDelete(companyId: string, id: string) {
        const { error } = await supabaseServer
            .from('bom_headers')
            // @ts-ignore - Types will be regenerated after migration
            .update({ deleted_at: new Date().toISOString() })
            .eq('company_id', companyId)
            .eq('id', id)

        if (error) throw error
    }
}
