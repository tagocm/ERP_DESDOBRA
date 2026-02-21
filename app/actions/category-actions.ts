/**
 * Category Server Actions
 * 
 * All actions use Zod validation and return ActionResult
 */

'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { getActiveCompanyId } from '@/lib/auth/get-active-company';
import {
    getRevenueCategories,
    createRevenueCategory,
    updateRevenueCategory,
    deleteRevenueCategory,
} from '@/lib/data/finance/chart-of-accounts';
import type { CategoryDTO } from '@/lib/types/products-dto';

// ============================================================================
// ACTION RESULT TYPE
// ============================================================================

export type ActionResult<T = void> =
    | { success: true; data: T }
    | { success: false; error: string };

function toErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message) {
        return error.message;
    }
    if (typeof error === 'object' && error !== null && 'message' in error) {
        const message = (error as { message?: unknown }).message;
        if (typeof message === 'string' && message.trim().length > 0) {
            return message;
        }
    }
    return fallback;
}

// ============================================================================
// HELPER: Get Company ID from Auth
// ============================================================================

// Usa getActiveCompanyId (company_members) para suportar membros que não são owners
const getCompanyId = getActiveCompanyId;

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const ListCategoriesSchema = z.object({
    // No additional filters for now
});

const CreateCategorySchema = z.object({
    name: z.string().trim().min(1, 'Nome é obrigatório').max(100, 'Nome muito longo'),
});

const UpdateCategorySchema = z.object({
    id: z.string().uuid('ID inválido'),
    name: z.string().trim().min(1, 'Nome é obrigatório').max(100, 'Nome muito longo'),
});

const DeleteCategorySchema = z.object({
    id: z.string().uuid('ID inválido'),
});

// ============================================================================
// ACTIONS
// ============================================================================

/**
 * List categories for the current company
 */
export async function listCategoriesAction(
    input?: z.infer<typeof ListCategoriesSchema>
): Promise<ActionResult<CategoryDTO[]>> {
    try {
        ListCategoriesSchema.parse(input ?? {});
        const companyId = await getCompanyId();
        const categories = await getRevenueCategories();

        return {
            success: true,
            data: categories.map((category) => ({
                id: category.id,
                company_id: companyId,
                name: category.name,
                normalized_name: category.normalized_name,
                product_count: category.usage_count ?? 0,
            })),
        };
    } catch (error) {
        if (error instanceof z.ZodError) {
            return { success: false, error: error.issues[0].message };
        }
        return {
            success: false,
            error: toErrorMessage(error, 'Erro ao listar categorias'),
        };
    }
}

/**
 * Create a new category
 */
export async function createCategoryAction(
    input: z.infer<typeof CreateCategorySchema>
): Promise<ActionResult<CategoryDTO>> {
    try {
        const companyId = await getCompanyId();
        const validated = CreateCategorySchema.parse(input);

        const category = await createRevenueCategory({ name: validated.name });

        revalidatePath('/app/cadastros/produtos');
        revalidatePath('/app/configuracoes/preferencias');

        return {
            success: true,
            data: {
                id: category.id,
                company_id: companyId,
                name: category.name,
                normalized_name: category.normalized_name,
                product_count: category.usage_count ?? 0,
            },
        };
    } catch (error) {
        if (error instanceof z.ZodError) {
            return { success: false, error: error.issues[0].message };
        }
        return {
            success: false,
            error: toErrorMessage(error, 'Erro ao criar categoria'),
        };
    }
}

/**
 * Update an existing category
 */
export async function updateCategoryAction(
    input: z.infer<typeof UpdateCategorySchema>
): Promise<ActionResult<CategoryDTO>> {
    try {
        const companyId = await getCompanyId();
        const validated = UpdateCategorySchema.parse(input);

        const category = await updateRevenueCategory(validated.id, validated.name);

        revalidatePath('/app/cadastros/produtos');
        revalidatePath('/app/configuracoes/preferencias');

        return {
            success: true,
            data: {
                id: category.id,
                company_id: companyId,
                name: category.name,
                normalized_name: category.normalized_name,
                product_count: category.usage_count ?? 0,
            },
        };
    } catch (error) {
        if (error instanceof z.ZodError) {
            return { success: false, error: error.issues[0].message };
        }
        return {
            success: false,
            error: toErrorMessage(error, 'Erro ao atualizar categoria'),
        };
    }
}

/**
 * Delete a category (checks for usage first)
 */
export async function deleteCategoryAction(
    input: z.infer<typeof DeleteCategorySchema>
): Promise<ActionResult<void>> {
    try {
        await getCompanyId(); // Verify auth
        const validated = DeleteCategorySchema.parse(input);

        await deleteRevenueCategory(validated.id);

        revalidatePath('/app/cadastros/produtos');
        revalidatePath('/app/configuracoes/preferencias');

        return { success: true, data: undefined };
    } catch (error) {
        if (error instanceof z.ZodError) {
            return { success: false, error: error.issues[0].message };
        }
        return {
            success: false,
            error: toErrorMessage(error, 'Erro ao excluir categoria'),
        };
    }
}
