
import { SupabaseClient } from "@supabase/supabase-js";

export interface PriceTable {
    id: string;
    company_id: string;
    name: string;
    effective_date: string; // date string YYYY-MM-DD
    valid_from: string | null;
    valid_to: string | null;
    commission_pct: number | null;
    freight_included: boolean;
    min_order_value: number | null;
    states: string[] | null;
    customer_profiles: string[] | null;
    is_active: boolean;
    internal_notes: string | null;
    created_at?: string;
    updated_at?: string;
}

export interface PriceTableItem {
    id: string;
    price_table_id: string;
    item_id: string;
    price: number | null;
    updated_at?: string;
}

export interface PriceTableWithItems extends PriceTable {
    items: PriceTableItem[];
}

// --- FETCHING ---

export async function getPriceTables(
    supabase: SupabaseClient,
    companyId: string,
    filters?: {
        search?: string;
        isActive?: boolean | null; // null = all
        state?: string;
    }
) {
    let query = supabase
        .from('price_tables')
        .select('*')
        .eq('company_id', companyId);

    if (filters?.search) {
        query = query.ilike('name', `%${filters.search}%`);
    }

    if (filters?.isActive !== undefined && filters.isActive !== null) {
        query = query.eq('is_active', filters.isActive);
    }

    if (filters?.state) {
        // Checking if state is in the array or array is null (implies all)
        // PostgreSQL array overlaps or contains check. 
        // For simplicity UI usually filters "Active in State X".
        // Here specific logic: if array is null => Valid for all states. Return it.
        // If array is not null => check if it contains the state.
        // This complex OR logic is hard with basic Supabase chaining.
        // Using 'or' with filtered query might be needed.
        // For list view: Just list tables. Client side filtering might be better for small datasets
        // Or specific complex query: is 'states' is null OR 'states' cs '{state}'
        query = query.or(`states.is.null,states.cs.{${filters.state}}`);
    }

    // Default sorting
    query = query.order('is_active', { ascending: false }).order('name', { ascending: true });

    const { data, error } = await query;
    if (error) throw error;
    return data as PriceTable[];
}

export async function getPriceTableById(
    supabase: SupabaseClient,
    id: string
) {
    const { data, error } = await supabase
        .from('price_tables')
        .select('*')
        .eq('id', id)
        .single();

    if (error) throw error;
    return data as PriceTable;
}

export async function getPriceTableItems(
    supabase: SupabaseClient,
    priceTableId: string
) {
    const { data, error } = await supabase
        .from('price_table_items')
        .select('*')
        .eq('price_table_id', priceTableId);

    if (error) throw error;
    return data as PriceTableItem[];
}

// Fetch all sellable items for the form structure
export async function getSellableItems(
    supabase: SupabaseClient,
    companyId: string
) {
    const { data, error } = await supabase
        .from('items')
        .select('id, name, sku, uom, line, brand, type, avg_cost')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .is('deleted_at', null)
        // Filter sellable types
        .in('type', ['finished_good', 'resale', 'service', 'wip', 'raw_material']) // Including raw/wip if user wants to sell them occasionally
        .order('line', { ascending: true }) // Grouping by line
        .order('name', { ascending: true });

    if (error) throw error;
    return data;
}

// --- MUTATIONS ---

export async function upsertPriceTable(
    supabase: SupabaseClient,
    tableData: Partial<PriceTable>
) {
    // If ID is provided, it updates. If not, inserts.
    const { data, error } = await supabase
        .from('price_tables')
        .upsert(tableData)
        .select()
        .single();

    if (error) throw error;
    return data as PriceTable;
}

export async function upsertPriceTableItems(
    supabase: SupabaseClient,
    items: Partial<PriceTableItem>[]
) {
    if (items.length === 0) return;

    const { data, error } = await supabase
        .from('price_table_items')
        .upsert(items, { onConflict: 'price_table_id,item_id' })
        .select();

    if (error) throw error;
    return data as PriceTableItem[];
}

export async function deletePriceTable(
    supabase: SupabaseClient,
    id: string
) {
    const { error } = await supabase
        .from('price_tables')
        .delete()
        .eq('id', id);

    if (error) throw error;
}

export async function duplicatePriceTable(
    supabase: SupabaseClient,
    originalId: string
) {
    // 1. Get original table
    const original = await getPriceTableById(supabase, originalId);

    // 2. Prepare new table data
    const { id: _, created_at: __, updated_at: ___, ...rest } = original;
    const newName = `CÓPIA - ${original.name}`.slice(0, 255); // Truncate if needed

    const newTableData = {
        ...rest,
        name: newName,
        is_active: true // Or false? User requirement didn't specify active state of copy. Default active usually fine, or draft. User said "Open in edit mode".
    };

    const newTable = await upsertPriceTable(supabase, newTableData);

    // 3. Get items
    const items = await getPriceTableItems(supabase, originalId);

    // 4. Insert items for new table
    if (items.length > 0) {
        const newItems = items.map(item => ({
            price_table_id: newTable.id,
            item_id: item.item_id,
            price: item.price
        }));
        await upsertPriceTableItems(supabase, newItems);
    }

    return newTable;
}
