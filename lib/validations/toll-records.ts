import { z } from "zod";

const paymentMethodEnum = ['cash', 'card', 'tag', 'pix'] as const;

export const tollRecordSchema = z.object({
    id: z.string().uuid().optional(),
    vehicle_id: z.string().uuid({ message: "Veículo é obrigatório" }),
    toll_date: z.string().min(1, "Data é obrigatória"),
    toll_time: z.string().min(1, "Horário é obrigatório"),
    location: z.string().min(1, "Local é obrigatório"),
    amount: z.number().positive("Valor deve ser maior que zero"),
    payment_method: z.enum(paymentMethodEnum),
    notes: z.string().nullable().optional(),
});

export type TollRecordSchema = z.infer<typeof tollRecordSchema>;
