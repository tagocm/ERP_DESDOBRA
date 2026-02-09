import { Database } from "@/types/supabase";

export type FuelType = 'gasoline' | 'ethanol' | 'diesel' | 'flex' | 'electric' | 'hybrid' | 'other';

export interface FuelRecordRow {
    id: string;
    company_id: string;
    vehicle_id: string;
    fuel_date: string;
    odometer_km: number;
    fuel_type: string;
    quantity_liters: number;
    price_per_liter: number;
    total_amount: number;
    gas_station: string | null;
    notes: string | null;
    created_at: string;
    created_by: string | null;
    updated_at: string;
    updated_by: string | null;
}

export type FuelRecordCreateInput = Omit<FuelRecordRow, 'id' | 'company_id' | 'created_at' | 'created_by' | 'updated_at' | 'updated_by'>;
export type FuelRecordUpdateInput = Partial<FuelRecordCreateInput> & { id: string };

export interface FuelRecordListFilters {
    startDate?: string;
    endDate?: string;
    fuelType?: FuelType;
    search?: string;
}

export interface FuelStats {
    totalRecords: number;
    totalLiters: number;
    totalSpent: number;
    avgPricePerLiter: number;
    avgConsumption: number | null;
}

export type ActionResult<T = void> =
    | { ok: true; data?: T }
    | { ok: false; error: { message: string; code?: string } };
