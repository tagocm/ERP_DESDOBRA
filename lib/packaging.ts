import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Resolves the default packaging ID for a given item.
 * 
 * Logic:
 * 1. Search for a packaging marked as default (is_default_sales_unit = true).
 * 2. If none, fallback to the first active packaging (sorted by creation date).
 * 3. If none, return null.
 * 
 * @param supabase Supabase Client
 * @param companyId Company ID
 * @param itemId Item ID
 * @returns Packaging ID or null
 */
export async function resolveDefaultPackagingId(
    supabase: SupabaseClient,
    companyId: string,
    itemId: string
): Promise<string | null> {
    // 1. Try finding explicit default
    const { data: defaultPkg, error: defaultError } = await supabase
        .from('item_packaging')
        .select('id')
        .eq('company_id', companyId)
        .eq('item_id', itemId)
        .eq('is_default_sales_unit', true)
        .eq('is_active', true)
        .is('deleted_at', null)
        .limit(1)
        .maybeSingle();

    if (defaultError) {
        console.error("Error resolving default packaging (explicit):", defaultError);
        throw defaultError;
    }

    if (defaultPkg) {
        return defaultPkg.id;
    }

    // 2. Fallback: First active packaging
    const { data: fallbackPkg, error: fallbackError } = await supabase
        .from('item_packaging')
        .select('id')
        .eq('company_id', companyId)
        .eq('item_id', itemId)
        .eq('is_active', true)
        .is('deleted_at', null)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

    if (fallbackError) {
        console.error("Error resolving default packaging (fallback):", fallbackError);
        throw fallbackError;
    }

    if (fallbackPkg) {
        return fallbackPkg.id;
    }

    return null;
}

/**
 * Resolves the full packaging snapshot for a sales item.
 * @returns { sales_unit_snapshot: JSONB } or null
 */
export async function resolvePackagingSnapshot(
    supabase: SupabaseClient,
    packagingId: string
) {
    if (!packagingId) return null;

    const { data: pkg, error } = await supabase
        .from('item_packaging')
        .select(`
            *,
            sell_uom:uoms!sell_uom_id(*),
            item:items!item_id(
                uom, 
                uom_id,
                base_uom:uoms!uom_id(*)
            )
        `)
        .eq('id', packagingId)
        .single();

    if (error || !pkg) return null;

    // Logic:
    // sell_uom_id: from packaging
    // base_uom_id: from item
    // sell_unit_code: sell_uom.abbrev
    // base_unit_code: base_uom.abbrev OR item.uom
    // factor: qty_in_base
    // label: "Caixa (12xPc)" or specialized

    const sellAbbrev = (pkg.sell_uom as any)?.abbrev || (pkg.type === 'BOX' ? 'Cx' : 'Un');
    const baseAbbrev = (pkg.item as any)?.base_uom?.abbrev || (pkg.item as any)?.uom || 'Un';
    const factor = pkg.qty_in_base || 1;

    // Auto Label: "Caixa (12xPc)"
    const autoLabel = `${(pkg.sell_uom as any)?.name || pkg.label || 'Unidade'} (${factor}x${baseAbbrev})`;

    return {
        packaging_id: pkg.id,
        sell_uom_id: pkg.sell_uom_id,
        base_uom_id: (pkg.item as any)?.uom_id,
        sell_unit_code: sellAbbrev,
        base_unit_code: baseAbbrev,
        factor_in_base: factor,
        auto_label: autoLabel
    };
}
