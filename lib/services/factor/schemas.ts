import { z } from "zod";
import {
    dateSchema,
    factorItemActionSchema,
    factorOperationStatusSchema,
    factorResponseStatusSchema,
    uuidSchema,
} from "@/lib/repositories/factor/schemas";

export const createFactorSchema = z.object({
    name: z.string().trim().min(2).max(120),
    code: z.string().trim().max(40).optional().nullable(),
    organizationId: uuidSchema.optional().nullable(),
    defaultInterestRate: z.coerce.number().min(0).max(100).optional(),
    defaultFeeRate: z.coerce.number().min(0).max(100).optional(),
    defaultIofRate: z.coerce.number().min(0).max(100).optional(),
    defaultOtherCostRate: z.coerce.number().min(0).max(100).optional(),
    defaultGraceDays: z.coerce.number().int().min(0).max(365).optional(),
    defaultAutoSettleBuyback: z.boolean().optional(),
    notes: z.string().trim().max(1000).optional().nullable(),
});

export const createFactorOperationSchema = z.object({
    factorId: uuidSchema,
    reference: z.string().trim().min(1).max(80).optional().nullable(),
    issueDate: dateSchema.optional(),
    expectedSettlementDate: dateSchema.optional().nullable(),
    settlementAccountId: uuidSchema.optional().nullable(),
    notes: z.string().trim().max(1000).optional().nullable(),
});

export const updateFactorOperationSchema = z.object({
    notes: z.string().trim().max(1000).optional().nullable(),
    expectedSettlementDate: dateSchema.optional().nullable(),
    settlementAccountId: uuidSchema.optional().nullable(),
    status: factorOperationStatusSchema.optional(),
});

export const addFactorOperationItemSchema = z.object({
    actionType: factorItemActionSchema,
    installmentId: uuidSchema,
    proposedDueDate: dateSchema.optional().nullable(),
    buybackSettleNow: z.boolean().optional(),
    notes: z.string().trim().max(500).optional().nullable(),
});

export const applyFactorResponsesSchema = z.object({
    versionId: uuidSchema,
    responses: z
        .array(
            z.object({
                itemId: uuidSchema,
                responseStatus: factorResponseStatusSchema,
                responseCode: z.string().trim().max(40).optional().nullable(),
                responseMessage: z.string().trim().max(500).optional().nullable(),
                acceptedAmount: z.coerce.number().nonnegative().optional().nullable(),
                adjustedAmount: z.coerce.number().nonnegative().optional().nullable(),
                adjustedDueDate: dateSchema.optional().nullable(),
                feeAmount: z.coerce.number().nonnegative().optional(),
                interestAmount: z.coerce.number().nonnegative().optional(),
                iofAmount: z.coerce.number().nonnegative().optional(),
                otherCostAmount: z.coerce.number().nonnegative().optional(),
            }),
        )
        .min(1),
})
    .superRefine((value, ctx) => {
        for (const [index, item] of value.responses.entries()) {
            if (item.responseStatus === "adjusted") {
                const hasAdjustedAmount = item.adjustedAmount !== undefined && item.adjustedAmount !== null;
                const hasAdjustedDate = item.adjustedDueDate !== undefined && item.adjustedDueDate !== null;
                if (!hasAdjustedAmount && !hasAdjustedDate) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        path: ["responses", index],
                        message: "Retorno ajustado exige valor e/ou vencimento ajustado",
                    });
                }
            }
        }
    });

export const concludeFactorOperationSchema = z.object({
    settlementDate: dateSchema.optional(),
    notes: z.string().trim().max(500).optional().nullable(),
});

export const cancelFactorOperationSchema = z.object({
    reason: z.string().trim().min(3).max(500),
});
