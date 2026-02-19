/**
 * Tax Group Server Actions
 * 
 * All actions use Zod validation and return ActionResult
 */

'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import { getActiveCompanyId } from '@/lib/auth/get-active-company';
import {
    getTaxGroups,
    createTaxGroup,
    updateTaxGroup,
    deleteTaxGroup,
} from '@/lib/data/tax-groups';
import type { TaxGroupDTO } from '@/lib/types/products-dto';

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

const ListTaxGroupsSchema = z.object({
    onlyActive: z.boolean().optional().default(true),
});

const CreateTaxGroupSchema = z.object({
    name: z.string().trim().min(1, 'Nome é obrigatório').max(100, 'Nome muito longo'),
    description: z.string().trim().max(500, 'Descrição muito longa').optional().nullable(),
    ncm: z.string().trim().max(20, 'NCM muito longo').optional().nullable(),
    cest: z.string().trim().max(20, 'CEST muito longo').optional().nullable(),
    origin_default: z.number().int().min(0).max(8).optional().nullable(),
    is_active: z.boolean().optional().default(true),
    observation: z.string().trim().max(1000, 'Observação muito longa').optional().nullable(),
});

const UpdateTaxGroupSchema = z.object({
    id: z.string().uuid('ID inválido'),
    name: z.string().trim().min(1, 'Nome é obrigatório').max(100, 'Nome muito longo').optional(),
    description: z.string().trim().max(500, 'Descrição muito longa').optional().nullable(),
    ncm: z.string().trim().max(20, 'NCM muito longo').optional().nullable(),
    cest: z.string().trim().max(20, 'CEST muito longo').optional().nullable(),
    origin_default: z.number().int().min(0).max(8).optional().nullable(),
    is_active: z.boolean().optional(),
    observation: z.string().trim().max(1000, 'Observação muito longa').optional().nullable(),
});

const DeleteTaxGroupSchema = z.object({
    id: z.string().uuid('ID inválido'),
});

// ============================================================================
// ACTIONS
// ============================================================================

/**
 * List tax groups for the current company
 */
export async function listTaxGroupsAction(
    input?: z.infer<typeof ListTaxGroupsSchema>
): Promise<ActionResult<TaxGroupDTO[]>> {
    try {
        const companyId = await getCompanyId();
        const supabase = await createClient();
        const validated = input ? ListTaxGroupsSchema.parse(input) : { onlyActive: true };

        const taxGroups = await getTaxGroups(supabase, companyId, validated.onlyActive);

        return { success: true, data: taxGroups as TaxGroupDTO[] };
    } catch (error) {
        if (error instanceof z.ZodError) {
            return { success: false, error: error.issues[0].message };
        }
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Erro ao listar grupos fiscais',
        };
    }
}

/**
 * Create a new tax group
 */
export async function createTaxGroupAction(
    input: z.infer<typeof CreateTaxGroupSchema>
): Promise<ActionResult<TaxGroupDTO>> {
    try {
        const companyId = await getCompanyId();
        const supabase = await createClient();
        const validated = CreateTaxGroupSchema.parse(input);

        const taxGroup = await createTaxGroup(supabase, {
            company_id: companyId,
            name: validated.name,
            is_active: validated.is_active,
            description: validated.description ?? undefined,
            ncm: validated.ncm ?? undefined,
            cest: validated.cest ?? undefined,
            origin_default: validated.origin_default ?? undefined,
            observation: validated.observation ?? undefined,
        });

        revalidatePath('/app/cadastros/produtos');

        return { success: true, data: taxGroup as TaxGroupDTO };
    } catch (error) {
        if (error instanceof z.ZodError) {
            return { success: false, error: error.issues[0].message };
        }
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Erro ao criar grupo fiscal',
        };
    }
}

/**
 * Update an existing tax group
 */
export async function updateTaxGroupAction(
    input: z.infer<typeof UpdateTaxGroupSchema>
): Promise<ActionResult<TaxGroupDTO>> {
    try {
        await getCompanyId(); // Verify auth
        const supabase = await createClient();
        const validated = UpdateTaxGroupSchema.parse(input);

        const { id, ...updates } = validated;

        // Convert null to undefined for compatibility with TaxGroup type
        const cleanUpdates = {
            ...updates,
            description: updates.description ?? undefined,
            ncm: updates.ncm ?? undefined,
            cest: updates.cest ?? undefined,
            origin_default: updates.origin_default ?? undefined,
            observation: updates.observation ?? undefined,
        };

        const taxGroup = await updateTaxGroup(supabase, id, cleanUpdates);

        revalidatePath('/app/cadastros/produtos');

        return { success: true, data: taxGroup as TaxGroupDTO };
    } catch (error) {
        if (error instanceof z.ZodError) {
            return { success: false, error: error.issues[0].message };
        }
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Erro ao atualizar grupo fiscal',
        };
    }
}

/**
 * Delete a tax group (soft delete)
 */
export async function deleteTaxGroupAction(
    input: z.infer<typeof DeleteTaxGroupSchema>
): Promise<ActionResult<void>> {
    try {
        await getCompanyId(); // Verify auth
        const supabase = await createClient();
        const validated = DeleteTaxGroupSchema.parse(input);

        await deleteTaxGroup(supabase, validated.id);

        revalidatePath('/app/cadastros/produtos');

        return { success: true, data: undefined };
    } catch (error) {
        if (error instanceof z.ZodError) {
            return { success: false, error: error.issues[0].message };
        }
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Erro ao excluir grupo fiscal',
        };
    }
}
