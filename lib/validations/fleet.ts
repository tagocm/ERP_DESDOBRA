import { z } from "zod";

export const vehicleSchema = z.object({
    id: z.string().optional().nullable(),
    name: z.string().min(2, "O nome deve ter pelo menos 2 caracteres"),
    plate: z.string().nullable().optional(),
    type: z.enum(['car', 'truck', 'motorcycle', 'other']).nullable().optional(),
    brand: z.string().nullable().optional(),
    model: z.string().nullable().optional(),
    year: z.coerce.number().nullable().optional(),
    color: z.string().nullable().optional(),
    renavam: z.string().nullable().optional(),
    chassis: z.string().nullable().optional(),
    fuel_type: z.enum(['gasoline', 'ethanol', 'diesel', 'flex', 'electric', 'hybrid', 'other']).nullable().optional(),
    tank_capacity_l: z.coerce.number().nullable().optional(),
    odometer_initial_km: z.coerce.number().nullable().optional(),
    odometer_current_km: z.coerce.number().nullable().optional(),
    is_active: z.boolean(),
    cost_center_id: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
});

export type VehicleSchema = z.infer<typeof vehicleSchema>;
