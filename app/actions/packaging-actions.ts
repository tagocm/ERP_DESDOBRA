/**
 * Packaging Type Server Actions
 * 
 * All actions use Zod validation and return ActionResult
 */

'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import {
    getPackagingTypes,
    getAllPackagingTypesIncludingInactive,
    createPackagingType,
    updatePackagingType,
    deletePackagingType,
} from '@/lib/data/packaging-types';
import type { PackagingTypeDTO } from '@/lib/types/products-dto';

// ============================================================================
// ACTION RESULT TYPE
// ============================================================================

export type ActionResult<T = void> =
    | { success: true; data: T }
    | { success: false; error: string };

// ============================================================================
// HELPER: Get Company ID from Auth
// ============================================================================

async function getCompanyId(): Promise<string> {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
        throw new Error('Usuário não autenticado');
    }

    const { data: companies, error: companyError } = await supabase
        .from('companies')
        .select('id')
        .eq('owner_id', user.id)
        .single();

    if (companyError || !companies) {
        throw new Error('Empresa não encontrada');
    }

    return companies.id;
}

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const ListPackagingTypesSchema = z.object({
    search: z.string().trim().optional(),
    includeInactive: z.boolean().optional().default(false),
});

const CreatePackagingTypeSchema = z.object({
    name: z.string().trim().min(1, 'Nome é obrigatório').max(100, 'Nome muito longo'),
    code: z.string().trim().min(1, 'Código é obrigatório').max(10, 'Código muito longo'),
    is_active: z.boolean().optional().default(true),
});

const UpdatePackagingTypeSchema = z.object({
    id: z.string().uuid('ID inválido'),
    name: z.string().trim().min(1, 'Nome é obrigatório').max(100, 'Nome muito longo').optional(),
    code: z.string().trim().min(1, 'Código é obrigatório').max(10, 'Código muito longo').optional(),
    is_active: z.boolean().optional(),
});

const DeletePackagingTypeSchema = z.object({
    id: z.string().uuid('ID inválido'),
});

// ============================================================================
// ACTIONS
// ============================================================================

/**
 * List packaging types for the current company
 */
export async function listPackagingTypesAction(
    input?: z.infer<typeof ListPackagingTypesSchema>
): Promise<ActionResult<PackagingTypeDTO[]>> {
    try {
        const companyId = await getCompanyId();
        const validated = input ? ListPackagingTypesSchema.parse(input) : { includeInactive: false };

        let packagingTypes: PackagingTypeDTO[];

        if (validated.includeInactive) {
            const types = await getAllPackagingTypesIncludingInactive(companyId);
            packagingTypes = types.map(t => ({ ...t, company_id: t.company_id ?? null }));
        } else {
            const types = await getPackagingTypes(companyId, validated.search);
            packagingTypes = types.map(t => ({ ...t, company_id: t.company_id ?? null }));
        }

        return { success: true, data: packagingTypes };
    } catch (error) {
        if (error instanceof z.ZodError) {
            return { success: false, error: error.issues[0].message };
        }
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Erro ao listar tipos de embalagem',
        };
    }
}

/**
 * Create a new packaging type
 */
export async function createPackagingTypeAction(
    input: z.infer<typeof CreatePackagingTypeSchema>
): Promise<ActionResult<PackagingTypeDTO>> {
    try {
        const companyId = await getCompanyId();
        const validated = CreatePackagingTypeSchema.parse(input);

        const packagingType = await createPackagingType({
            company_id: companyId,
            name: validated.name,
            code: validated.code,
            is_active: validated.is_active,
        });

        if (!packagingType) {
            throw new Error('Erro ao criar tipo de embalagem');
        }

        revalidatePath('/app/cadastros/produtos');

        return { success: true, data: packagingType as PackagingTypeDTO };
    } catch (error) {
        if (error instanceof z.ZodError) {
            return { success: false, error: error.issues[0].message };
        }
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Erro ao criar tipo de embalagem',
        };
    }
}

/**
 * Update an existing packaging type
 */
export async function updatePackagingTypeAction(
    input: z.infer<typeof UpdatePackagingTypeSchema>
): Promise<ActionResult<PackagingTypeDTO>> {
    try {
        await getCompanyId(); // Verify auth
        const validated = UpdatePackagingTypeSchema.parse(input);

        const { id, ...updates } = validated;
        const packagingType = await updatePackagingType(id, updates);

        if (!packagingType) {
            throw new Error('Tipo de embalagem não encontrado');
        }

        revalidatePath('/app/cadastros/produtos');

        return { success: true, data: packagingType as PackagingTypeDTO };
    } catch (error) {
        if (error instanceof z.ZodError) {
            return { success: false, error: error.issues[0].message };
        }
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Erro ao atualizar tipo de embalagem',
        };
    }
}

/**
 * Delete a packaging type (checks for usage first)
 */
export async function deletePackagingTypeAction(
    input: z.infer<typeof DeletePackagingTypeSchema>
): Promise<ActionResult<void>> {
    try {
        await getCompanyId(); // Verify auth
        const validated = DeletePackagingTypeSchema.parse(input);

        await deletePackagingType(validated.id);

        revalidatePath('/app/cadastros/produtos');

        return { success: true, data: undefined };
    } catch (error) {
        if (error instanceof z.ZodError) {
            return { success: false, error: error.issues[0].message };
        }
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Erro ao excluir tipo de embalagem',
        };
    }
}
