/**
 * Commission Server Actions
 * 
 * All actions use Zod validation and return ActionResult
 */

'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import {
    previewClosing,
    createClosingDraft,
    closeClosing,
    listClosings,
    getClosingById,
    reopenClosing,
} from '@/lib/data/commissions';
import type {
    CommissionPreviewDTO,
    CommissionClosingDTO,
    CommissionLineDTO,
} from '@/lib/domain/commission/types';

// ============================================================================
// ACTION RESULT TYPE
// ============================================================================

export type ActionResult<T = void> =
    | { success: true; data: T }
    | { success: false; error: string };

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const PreviewClosingSchema = z.object({
    companyId: z.string().uuid('ID da empresa inválido'),
    periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data de início inválida (formato: YYYY-MM-DD)'),
    periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data de fim inválida (formato: YYYY-MM-DD)'),
    defaultRate: z.number().min(0, 'Taxa deve ser >= 0').max(100, 'Taxa deve ser <= 100'),
});

const CreateClosingDraftSchema = z.object({
    companyId: z.string().uuid('ID da empresa inválido'),
    periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data de início inválida'),
    periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data de fim inválida'),
    defaultRate: z.number().min(0).max(100),
    notes: z.string().optional(),
});

const CloseClosingSchema = z.object({
    closingId: z.string().uuid('ID do fechamento inválido'),
    userId: z.string().uuid('ID do usuário inválido'),
});

const ListClosingsSchema = z.object({
    companyId: z.string().uuid('ID da empresa inválido'),
});

const GetClosingByIdSchema = z.object({
    closingId: z.string().uuid('ID do fechamento inválido'),
});

const ReopenClosingSchema = z.object({
    closingId: z.string().uuid('ID do fechamento inválido'),
    userId: z.string().uuid('ID do usuário inválido'),
    reason: z.string().min(1, 'Motivo é obrigatório'),
});

// ============================================================================
// ACTIONS
// ============================================================================

/**
 * Preview commission closing without saving
 */
export async function previewClosingAction(
    input: z.infer<typeof PreviewClosingSchema>
): Promise<ActionResult<CommissionPreviewDTO>> {
    try {
        const validated = PreviewClosingSchema.parse(input);

        const preview = await previewClosing(
            validated.companyId,
            validated.periodStart,
            validated.periodEnd,
            validated.defaultRate
        );

        return { success: true, data: preview };
    } catch (error) {
        if (error instanceof z.ZodError) {
            return { success: false, error: error.issues[0].message };
        }
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Erro ao gerar prévia',
        };
    }
}

/**
 * Create commission closing draft
 */
export async function createClosingDraftAction(
    input: z.infer<typeof CreateClosingDraftSchema>
): Promise<ActionResult<{ closingId: string }>> {
    try {
        const validated = CreateClosingDraftSchema.parse(input);

        const result = await createClosingDraft(
            validated.companyId,
            validated.periodStart,
            validated.periodEnd,
            validated.defaultRate,
            validated.notes
        );

        revalidatePath('/comissoes/fechamentos');

        return { success: true, data: result };
    } catch (error) {
        if (error instanceof z.ZodError) {
            return { success: false, error: error.issues[0].message };
        }
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Erro ao criar rascunho',
        };
    }
}

/**
 * Close commission period (insert lines + update status)
 */
export async function closeClosingAction(
    input: z.infer<typeof CloseClosingSchema>
): Promise<ActionResult<{ linesCount: number }>> {
    try {
        const validated = CloseClosingSchema.parse(input);

        const result = await closeClosing(
            validated.closingId,
            validated.userId
        );

        revalidatePath('/comissoes/fechamentos');
        revalidatePath(`/comissoes/fechamentos/${validated.closingId}`);

        return { success: true, data: result };
    } catch (error) {
        if (error instanceof z.ZodError) {
            return { success: false, error: error.issues[0].message };
        }
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Erro ao fechar período',
        };
    }
}

/**
 * List all commission closings for a company
 */
export async function listClosingsAction(
    input: z.infer<typeof ListClosingsSchema>
): Promise<ActionResult<CommissionClosingDTO[]>> {
    try {
        const validated = ListClosingsSchema.parse(input);

        const closings = await listClosings(validated.companyId);

        return { success: true, data: closings };
    } catch (error) {
        if (error instanceof z.ZodError) {
            return { success: false, error: error.issues[0].message };
        }
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Erro ao listar fechamentos',
        };
    }
}

/**
 * Get commission closing details with lines
 */
export async function getClosingDetailsAction(
    input: z.infer<typeof GetClosingByIdSchema>
): Promise<ActionResult<{ closing: CommissionClosingDTO; lines: CommissionLineDTO[] }>> {
    try {
        const validated = GetClosingByIdSchema.parse(input);

        const result = await getClosingById(validated.closingId);

        return { success: true, data: result };
    } catch (error) {
        if (error instanceof z.ZodError) {
            return { success: false, error: error.issues[0].message };
        }
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Erro ao buscar detalhes',
        };
    }
}

/**
 * Reopen a closed commission period
 */
export async function reopenClosingAction(
    input: z.infer<typeof ReopenClosingSchema>
): Promise<ActionResult<void>> {
    try {
        const validated = ReopenClosingSchema.parse(input);

        await reopenClosing(
            validated.closingId,
            validated.userId,
            validated.reason
        );

        revalidatePath('/comissoes/fechamentos');
        revalidatePath(`/comissoes/fechamentos/${validated.closingId}`);

        return { success: true, data: undefined };
    } catch (error) {
        if (error instanceof z.ZodError) {
            return { success: false, error: error.issues[0].message };
        }
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Erro ao reabrir período',
        };
    }
}
