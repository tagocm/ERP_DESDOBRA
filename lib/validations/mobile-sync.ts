import { z } from 'zod'

// Basic payload for expense creation
export const expensePayloadSchema = z.object({
    id: z.string().optional(), // Mobile might send a temporary ID
    amount: z.number().positive(),
    date: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)), // ISO datetime or YYYY-MM-DD
    description: z.string().min(1),
    category_id: z.string().uuid().optional(),
    payment_method_id: z.string().uuid().optional(),
    merchant_name: z.string().optional(),
    notes: z.string().optional(),

    // Attachments (images/receipts)
    attachments: z.array(z.object({
        id: z.string().uuid(),
        url: z.string().url(),
        type: z.string()
    })).optional()
})

export const expensePayloadV2 = z.object({
    draft_id: z.string().uuid(),
    amount_cents: z.number().int().positive(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}/), // YYYY-MM-DD
    category_code: z.string().min(1),
    account_code: z.string().min(1),
    description: z.string().optional(),
    merchant_name: z.string().optional(),
    notes: z.string().optional()
})

// The sync request body
export const syncRequestSchema = z.object({
    events: z.array(z.object({
        event_id: z.string().uuid(),
        type: z.enum(['CREATE_EXPENSE']),
        payload: z.record(z.string(), z.unknown()) // We validate payload deeply later
    })).min(1).max(50)
})

// Refined schema to validate payload specific to type
export const eventItemSchema = z.object({
    event_id: z.string().uuid(),
    type: z.enum(['CREATE_EXPENSE']),
    payload: z.record(z.string(), z.unknown())
}).transform((data, ctx) => {
    if (data.type === 'CREATE_EXPENSE') {
        const resultV2 = expensePayloadV2.safeParse(data.payload)
        if (resultV2.success) {
            return { ...data, payload_version: 'v2' as const }
        }

        const resultV1 = expensePayloadSchema.safeParse(data.payload)
        if (resultV1.success) {
            return { ...data, payload_version: 'v1' as const }
        }

        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Invalid payload for CREATE_EXPENSE',
            path: ['payload']
        })
        return z.NEVER
    }
    return data
})
