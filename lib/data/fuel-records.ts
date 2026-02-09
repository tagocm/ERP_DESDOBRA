'use server';

import { createClient } from '@/utils/supabase/server';
import { getActiveCompanyId } from '@/lib/auth/get-active-company';
import { FuelRecordRow, FuelRecordListFilters, FuelStats } from '@/lib/types/fuel-records';

/**
 * List fuel records for a specific vehicle with optional filters
 */
export async function listFuelRecords(
    vehicleId: string,
    filters?: FuelRecordListFilters
): Promise<FuelRecordRow[]> {
    const supabase = await createClient();
    const companyId = await getActiveCompanyId();

    let query = supabase
        .from('fleet_fuel_records')
        .select('*')
        .eq('company_id', companyId)
        .eq('vehicle_id', vehicleId)
        .order('fuel_date', { ascending: false })
        .order('created_at', { ascending: false });

    // Apply filters
    if (filters?.startDate) {
        query = query.gte('fuel_date', filters.startDate);
    }
    if (filters?.endDate) {
        query = query.lte('fuel_date', filters.endDate);
    }
    if (filters?.fuelType) {
        query = query.eq('fuel_type', filters.fuelType);
    }
    if (filters?.search) {
        query = query.ilike('gas_station', `%${filters.search}%`);
    }

    const { data, error } = await query;

    if (error) throw error;
    return (data as FuelRecordRow[]) || [];
}

/**
 * Get a single fuel record by ID
 */
export async function getFuelRecordById(id: string): Promise<FuelRecordRow | null> {
    const supabase = await createClient();
    const companyId = await getActiveCompanyId();

    const { data, error } = await supabase
        .from('fleet_fuel_records')
        .select('*')
        .eq('id', id)
        .eq('company_id', companyId)
        .maybeSingle();

    if (error) throw error;
    return data as FuelRecordRow | null;
}

/**
 * Get fuel statistics for a vehicle
 */
export async function getFuelStats(vehicleId: string): Promise<FuelStats> {
    const supabase = await createClient();
    const companyId = await getActiveCompanyId();

    const { data, error } = await supabase
        .from('fleet_fuel_records')
        .select('quantity_liters, total_amount, price_per_liter, odometer_km')
        .eq('company_id', companyId)
        .eq('vehicle_id', vehicleId);

    if (error) throw error;

    const records = data || [];

    if (records.length === 0) {
        return {
            totalRecords: 0,
            totalLiters: 0,
            totalSpent: 0,
            avgPricePerLiter: 0,
            avgConsumption: null
        };
    }

    const totalLiters = records.reduce((sum, r) => sum + (r.quantity_liters || 0), 0);
    const totalSpent = records.reduce((sum, r) => sum + (r.total_amount || 0), 0);
    const avgPricePerLiter = totalSpent / totalLiters;

    // Calculate average consumption
    let avgConsumption: number | null = null;
    if (records.length > 1) {
        const odometerValues = records.map(r => r.odometer_km).sort((a, b) => a - b);
        const kmDiff = odometerValues[odometerValues.length - 1] - odometerValues[0];
        if (kmDiff > 0 && totalLiters > 0) {
            avgConsumption = kmDiff / totalLiters;
        }
    }

    return {
        totalRecords: records.length,
        totalLiters: Math.round(totalLiters * 100) / 100,
        totalSpent: Math.round(totalSpent * 100) / 100,
        avgPricePerLiter: Math.round(avgPricePerLiter * 100) / 100,
        avgConsumption: avgConsumption ? Math.round(avgConsumption * 100) / 100 : null
    };
}
