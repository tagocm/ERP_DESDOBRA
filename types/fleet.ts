export type VehicleType = 'car' | 'truck' | 'motorcycle' | 'other';

export const vehicleTypeLabels: Record<VehicleType, string> = {
    car: 'Carro',
    truck: 'Caminhão',
    motorcycle: 'Moto',
    other: 'Outro'
};

export type FuelType = 'gasoline' | 'ethanol' | 'diesel' | 'flex' | 'electric' | 'hybrid' | 'other';

export const fuelTypeLabels: Record<FuelType, string> = {
    gasoline: 'Gasolina',
    ethanol: 'Etanol',
    diesel: 'Diesel',
    flex: 'Flex',
    electric: 'Elétrico',
    hybrid: 'Híbrido',
    other: 'Outro'
};

export interface Vehicle {
    id: string;
    company_id: string;
    created_at: string;
    updated_at: string;
    name: string;
    plate: string | null;
    type: VehicleType | null;
    brand: string | null;
    model: string | null;
    year: number | null;
    color: string | null;
    renavam: string | null;
    chassis: string | null;
    fuel_type: FuelType | null;
    tank_capacity_l: number | null;
    odometer_initial_km: number | null;
    odometer_current_km: number | null;
    is_active: boolean;
    cost_center_id: string | null;
}

export type VehicleFormData = Omit<Vehicle, 'id' | 'company_id' | 'created_at' | 'updated_at'> & {
    id?: string;
};
