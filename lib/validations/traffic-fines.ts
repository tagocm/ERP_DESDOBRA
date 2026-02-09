import { z } from "zod";

export const trafficFineSchema = z.object({
    id: z.string().uuid().optional(),
    vehicle_id: z.string().uuid({ message: "Veículo é obrigatório" }),
    fine_date: z.string().min(1, "Data é obrigatória"),
    city: z.string().min(1, "Cidade é obrigatória"),
    reason: z.string().min(1, "Motivo é obrigatório"),
    amount: z.number().positive("Valor deve ser maior que zero"),
    driver_name: z.string().min(1, "Motorista é obrigatório"),
    notes: z.string().nullable().optional(),
    deducted_from_driver: z.boolean().default(false),
});

export type TrafficFineSchema = z.infer<typeof trafficFineSchema>;
