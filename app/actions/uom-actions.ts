/**
 * UOM (Unit of Measure) Server Actions
 * 
 * All actions use Zod validation and return ActionResult
 */

'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import {
    getUoms,
    getAllUomsIncludingInactive,
    createUom,
    updateUom,
    deleteUom,
} from '@/lib/data/uoms';
import type { UomDTO } from '@/lib/types/products-dto';

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

    // Get company_id from user metadata or companies table
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

const ListUomsSchema = z.object({
    search: z.string().trim().optional(),
    includeInactive: z.boolean().optional().default(false),
});

const CreateUomSchema = z.object({
    name: z.string().trim().min(1, 'Nome é obrigatório').max(100, 'Nome muito longo'),
    abbrev: z.string().trim().min(1, 'Abreviação é obrigatória').max(10, 'Abreviação muito longa'),
    is_active: z.boolean().optional().default(true),
});

const UpdateUomSchema = z.object({
    id: z.string().uuid('ID inválido'),
    name: z.string().trim().min(1, 'Nome é obrigatório').max(100, 'Nome muito longo').optional(),
    abbrev: z.string().trim().min(1, 'Abreviação é obrigatória').max(10, 'Abreviação muito longa').optional(),
    is_active: z.boolean().optional(),
});

const DeleteUomSchema = z.object({
    id: z.string().uuid('ID inválido'),
});

// ============================================================================
// ACTIONS
// ============================================================================

/**
 * List UOMs for the current company
 */
export async function listUomsAction(
    input?: z.infer<typeof ListUomsSchema>
): Promise<ActionResult<UomDTO[]>> {
    try {
        const companyId = await getCompanyId();
        const validated = input ? ListUomsSchema.parse(input) : { includeInactive: false };

        let uoms: UomDTO[];

        if (validated.includeInactive) {
            uoms = await getAllUomsIncludingInactive(companyId);
        } else {
            uoms = await getUoms(companyId, validated.search);
        }

        return { success: true, data: uoms };
    } catch (error) {
        if (error instanceof z.ZodError) {
            return { success: false, error: error.issues[0].message };
        }
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Erro ao listar unidades',
        };
    }
}

/**
 * Create a new UOM
 */
export async function createUomAction(
    input: z.infer<typeof CreateUomSchema>
): Promise<ActionResult<UomDTO>> {
    try {
        const companyId = await getCompanyId();
        const validated = CreateUomSchema.parse(input);

        const uom = await createUom({
            company_id: companyId,
            name: validated.name,
            abbrev: validated.abbrev,
            is_active: validated.is_active,
        });

        if (!uom) {
            throw new Error('Erro ao criar unidade');
        }

        revalidatePath('/app/cadastros/produtos');

        return { success: true, data: uom as UomDTO };
    } catch (error) {
        if (error instanceof z.ZodError) {
            return { success: false, error: error.issues[0].message };
        }
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Erro ao criar unidade',
        };
    }
}

/**
 * Update an existing UOM
 */
export async function updateUomAction(
    input: z.infer<typeof UpdateUomSchema>
): Promise<ActionResult<UomDTO>> {
    try {
        await getCompanyId(); // Verify auth
        const validated = UpdateUomSchema.parse(input);

        const { id, ...updates } = validated;
        const uom = await updateUom(id, updates);

        if (!uom) {
            throw new Error('Unidade não encontrada');
        }

        revalidatePath('/app/cadastros/produtos');

        return { success: true, data: uom as UomDTO };
    } catch (error) {
        if (error instanceof z.ZodError) {
            return { success: false, error: error.issues[0].message };
        }
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Erro ao atualizar unidade',
        };
    }
}

/**
 * Delete a UOM (checks for usage first)
 */
export async function deleteUomAction(
    input: z.infer<typeof DeleteUomSchema>
): Promise<ActionResult<void>> {
    try {
        await getCompanyId(); // Verify auth
        const validated = DeleteUomSchema.parse(input);

        await deleteUom(validated.id);

        revalidatePath('/app/cadastros/produtos');

        return { success: true, data: undefined };
    } catch (error) {
        if (error instanceof z.ZodError) {
            return { success: false, error: error.issues[0].message };
        }
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Erro ao excluir unidade',
        };
    }
}
