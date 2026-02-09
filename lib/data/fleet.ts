import { createClient } from '@/utils/supabase/server';
import {
    FleetVehicleListFilters,
    FleetVehicleListItem,
    FleetVehicleRow
} from '@/lib/types/fleet';

/**
 * Lists vehicles based on filters.
 * Uses optimized trigram search if search term is provided.
 */
export async function listVehicles(filters?: FleetVehicleListFilters): Promise<FleetVehicleListItem[]> {
    const supabase = await createClient();

    let query = supabase
        .from('fleet_vehicles')
        .select(`
            id, 
            name, 
            plate, 
            brand, 
            model, 
            year, 
            type, 
            is_active, 
            odometer_current_km
        `)
        .order('name');

    if (filters?.search) {
        // We can use the trigram index logic by using a raw text search if needed, 
        // but for now ILIKE will benefit from the trigram index idx_fleet_vehicles_search_trgm.
        // The index is built on a concatenation, so we can use a similar pattern if we want full optimization.
        const search = `%${filters.search}%`;
        query = query.or(`name.ilike.${search},plate.ilike.${search},model.ilike.${search}`);
    }

    if (filters?.isActive !== undefined) {
        query = query.eq('is_active', filters.isActive);
    }

    if (filters?.type) {
        query = query.eq('type', filters.type);
    }

    const { data, error } = await query;
    if (error) {
        console.error('Error listing vehicles:', error);
        throw new Error('Erro ao listar veículos');
    }

    return data as FleetVehicleListItem[];
}

/**
 * Fetches a single vehicle by ID.
 */
export async function getVehicleById(id: string): Promise<FleetVehicleRow | null> {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('fleet_vehicles')
        .select('*')
        .eq('id', id)
        .maybeSingle();

    if (error) {
        console.error('Error fetching vehicle:', error);
        throw new Error('Erro ao buscar veículo');
    }

    return data as FleetVehicleRow | null;
}
