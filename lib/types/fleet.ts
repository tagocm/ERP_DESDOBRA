import { Database } from "@/types/supabase";

// Since Database types might not be regenerated yet, we define the base structure
// but we will use the Row type as soon as it becomes available.
export type VehicleType = 'car' | 'truck' | 'motorcycle' | 'other';
export type FuelType = 'gasoline' | 'ethanol' | 'diesel' | 'flex' | 'electric' | 'hybrid' | 'other';

export const vehicleTypeLabels: Record<VehicleType, string> = {
    car: 'Carro',
    truck: 'Caminhão',
    motorcycle: 'Moto',
    other: 'Outro'
};

export const fuelTypeLabels: Record<FuelType, string> = {
    gasoline: 'Gasolina',
    ethanol: 'Etanol',
    diesel: 'Diesel',
    flex: 'Flex',
    electric: 'Elétrico',
    hybrid: 'Híbrido',
    other: 'Outro'
};

export interface FleetVehicleRow {
    id: string;
    company_id: string;
    created_at: string;
    updated_at: string;
    name: string;
    plate: string | null;
    type: string | null;
    brand: string | null;
    model: string | null;
    year: number | null;
    color: string | null;
    renavam: string | null;
    chassis: string | null;
    fuel_type: string | null;
    tank_capacity_l: number | null;
    odometer_initial_km: number | null;
    odometer_current_km: number | null;
    avg_fuel_consumption_km_l: number | null;
    is_active: boolean;
    cost_center_id: string | null;
    inactivated_at: string | null;
    inactivated_by: string | null;
    updated_by: string | null;
}

export type FleetVehicleCreateInput = Omit<FleetVehicleRow, 'id' | 'company_id' | 'created_at' | 'updated_at' | 'inactivated_at' | 'inactivated_by' | 'updated_by'>;
export type FleetVehicleUpdateInput = Partial<FleetVehicleCreateInput> & { id: string };

export interface FleetVehicleListFilters {
    search?: string;
    isActive?: boolean;
    type?: VehicleType;
}

export type FleetVehicleListItem = Pick<FleetVehicleRow,
    'id' | 'name' | 'plate' | 'brand' | 'model' | 'year' | 'type' | 'is_active' | 'odometer_current_km'
>;

export type ActionResult<T = void> =
    | { ok: true; data?: T }
    | { ok: false; error: { message: string; code?: string } };
