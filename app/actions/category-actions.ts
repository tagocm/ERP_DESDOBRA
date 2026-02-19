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
    getCategories,
    createCategory,
    updateCategory,
    deleteCategory,
} from '@/lib/data/categories';
import type { CategoryDTO } from '@/lib/types/products-dto';

// ============================================================================
// ACTION RESULT TYPE
// ============================================================================

export type ActionResult<T = void> =
    | { success: true; data: T }
    | { success: false; error: string };

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
        const companyId = await getCompanyId();

        const categories = await getCategories(companyId);

        return { success: true, data: categories as CategoryDTO[] };
    } catch (error) {
        if (error instanceof z.ZodError) {
            return { success: false, error: error.issues[0].message };
        }
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Erro ao listar categorias',
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

        const category = await createCategory(companyId, validated.name);

        revalidatePath('/app/cadastros/produtos');

        return { success: true, data: category as CategoryDTO };
    } catch (error) {
        if (error instanceof z.ZodError) {
            return { success: false, error: error.issues[0].message };
        }
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Erro ao criar categoria',
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
        await getCompanyId(); // Verify auth
        const validated = UpdateCategorySchema.parse(input);

        const category = await updateCategory(validated.id, validated.name);

        revalidatePath('/app/cadastros/produtos');

        return { success: true, data: category as CategoryDTO };
    } catch (error) {
        if (error instanceof z.ZodError) {
            return { success: false, error: error.issues[0].message };
        }
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Erro ao atualizar categoria',
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

        await deleteCategory(validated.id);

        revalidatePath('/app/cadastros/produtos');

        return { success: true, data: undefined };
    } catch (error) {
        if (error instanceof z.ZodError) {
            return { success: false, error: error.issues[0].message };
        }
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Erro ao excluir categoria',
        };
    }
}
