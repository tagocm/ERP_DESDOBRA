import { z } from "zod";

const fuelTypeEnum = ['gasoline', 'ethanol', 'diesel', 'flex', 'electric', 'hybrid', 'other'] as const;

export const fuelRecordSchema = z.object({
    id: z.string().uuid().optional(),
    vehicle_id: z.string().uuid({ message: "Veículo é obrigatório" }),
    fuel_date: z.string().min(1, "Data é obrigatória"),
    odometer_km: z.number().int().min(0, "Odômetro deve ser maior ou igual a zero"),
    fuel_type: z.enum(fuelTypeEnum),
    quantity_liters: z.number().positive("Quantidade deve ser maior que zero"),
    price_per_liter: z.number().positive("Preço por litro deve ser maior que zero"),
    total_amount: z.number().positive("Valor total deve ser maior que zero"),
    gas_station: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
}).refine(
    (data) => {
        // Validate that total_amount = quantity_liters * price_per_liter (with tolerance for rounding)
        const calculated = data.quantity_liters * data.price_per_liter;
        const diff = Math.abs(calculated - data.total_amount);
        return diff < 0.01; // Allow 1 cent difference for rounding
    },
    {
        message: "O valor total deve ser igual a quantidade × preço por litro",
        path: ["total_amount"]
    }
);

export type FuelRecordSchema = z.infer<typeof fuelRecordSchema>;
