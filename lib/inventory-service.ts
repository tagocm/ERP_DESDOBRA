import { createClient } from "@/lib/supabaseBrowser";
import { InventoryMovement } from "@/types/inventory";

const supabase = createClient();

export const inventoryService = {
    async getMovements(filters?: {
        startDate?: Date;
        endDate?: Date;
        type?: string;
        itemId?: string;
        search?: string;
        referenceType?: string;
        referenceId?: string;
    }) {
        let query = supabase
            .from('inventory_movements')
            .select(`
                *,
                source_ref,
                item:items(name, sku, uom_id),
                creator:user_profiles(full_name)
            `)
            .order('occurred_at', { ascending: false });

        if (filters?.type && filters.type !== 'ALL') {
            query = query.eq('movement_type', filters.type);
        }

        if (filters?.itemId) {
            query = query.eq('item_id', filters.itemId);
        }

        if (filters?.referenceType) {
            query = query.eq('reference_type', filters.referenceType);
        }

        if (filters?.referenceId) {
            query = query.eq('reference_id', filters.referenceId);
        }

        if (filters?.startDate) {
            query = query.gte('occurred_at', filters.startDate.toISOString());
        }

        if (filters?.endDate) {
            query = query.lte('occurred_at', filters.endDate.toISOString());
        }

        if (filters?.search) {
            const term = filters.search.trim();
            if (term) {
                query = query.ilike('source_ref', `%${term}%`);
            }
        }

        const { data, error } = await query;
        if (error) throw error;
        return data as InventoryMovement[];
    },

    async createMovement(movement: Partial<InventoryMovement>) {
        const { data, error } = await supabase
            .from('inventory_movements')
            .insert(movement)
            .select()
            .single();

        if (error) throw error;
        return data;
    }
};
