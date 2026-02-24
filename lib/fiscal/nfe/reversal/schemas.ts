import { z } from "zod";

export const ReversalModeSchema = z.enum(["TOTAL", "PARCIAL"]);

export const ReversalReasonCodeSchema = z.enum([
    "MERCADORIA_NAO_ENTREGUE",
    "RECUSA_DESTINATARIO",
    "ENDERECO_INCORRETO",
    "ERRO_OPERACIONAL",
    "OUTROS",
]);

export const ReversalSelectionItemSchema = z.object({
    nItem: z.number().int().min(1),
    qty: z.number().positive(),
    isProduced: z.boolean().optional().default(false),
});

export const CreateInboundReversalRequestSchema = z.object({
    outboundEmissionId: z.string().uuid(),
    mode: ReversalModeSchema,
    reasonCode: ReversalReasonCodeSchema,
    reasonOther: z.string().trim().min(1).max(600).optional(),
    internalNotes: z.string().trim().max(2000).optional(),
    selection: z.array(ReversalSelectionItemSchema).optional(),
});

export type CreateInboundReversalRequestInput = z.infer<typeof CreateInboundReversalRequestSchema>;

export const OutboundReversalDetailsRequestSchema = z.object({
    outboundEmissionId: z.string().uuid(),
});

export type OutboundReversalDetailsRequestInput = z.infer<typeof OutboundReversalDetailsRequestSchema>;

export const OutboundReversalDetailsResponseSchema = z.object({
    emission: z.object({
        id: z.string().uuid(),
        status: z.string(),
        accessKey: z.string(),
        numero: z.number().int().nullable(),
        serie: z.number().int().nullable(),
        authorizedAt: z.string().nullable(),
        issuedAt: z.string().nullable(),
        documentNumber: z.number().int().nullable(),
        clientName: z.string().nullable(),
        totalAmount: z.number().nullable(),
    }),
    items: z.array(z.object({
        nItem: z.number().int().min(1),
        salesDocumentItemId: z.string().uuid(),
        itemId: z.string().uuid(),
        name: z.string(),
        sku: z.string().nullable(),
        quantity: z.number(),
        unitPrice: z.number().nullable(),
        total: z.number().nullable(),
        isProduced: z.boolean(),
    })),
});

export type OutboundReversalDetailsResponse = z.infer<typeof OutboundReversalDetailsResponseSchema>;

export const CreateInboundReversalResponseSchema = z.object({
    success: z.literal(true),
    reversalId: z.string().uuid(),
    existing: z.boolean(),
    jobId: z.string().uuid().nullable(),
    inboundEmissionId: z.string().uuid().nullable(),
    status: z.string(),
});

export type CreateInboundReversalResponse = z.infer<typeof CreateInboundReversalResponseSchema>;
