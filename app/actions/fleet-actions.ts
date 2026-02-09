'use server';

import { createClient } from '@/utils/supabase/server';
import { getActiveCompanyId } from '@/lib/auth/get-active-company';
import { ActionResult, FleetVehicleRow } from '@/lib/types/fleet';
import { vehicleSchema, VehicleSchema } from '@/lib/validations/fleet';
import { revalidatePath } from 'next/cache';
import { logger } from '@/lib/logger';

/**
 * Converts text to Title Case (first letter of each word capitalized, rest lowercase)
 */
function toTitleCase(text: string | null | undefined): string | null {
    if (!text) return null;
    return text
        .toLowerCase()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

/**
 * Saves or updates a vehicle.
 * Enforces Zod validation, plate normalization, and odometer integrity.
 */
export async function saveVehicleAction(data: unknown): Promise<ActionResult<FleetVehicleRow>> {
    try {
        const companyId = await getActiveCompanyId();
        const supabase = await createClient();

        // 1. Validate Input
        const result = vehicleSchema.safeParse(data);
        if (!result.success) {
            const message = result.error.issues[0]?.message || "Dados inválidos";
            return { ok: false, error: { message } };
        }
        const validatedData = result.data;

        // 2. Odometer Integrity Check (No regression)
        if (validatedData.id && validatedData.odometer_current_km !== undefined && validatedData.odometer_current_km !== null) {
            const { data: currentVehicle } = await supabase
                .from('fleet_vehicles')
                .select('odometer_current_km')
                .eq('id', validatedData.id)
                .eq('company_id', companyId)
                .maybeSingle();

            if (currentVehicle?.odometer_current_km && validatedData.odometer_current_km < currentVehicle.odometer_current_km) {
                return {
                    ok: false,
                    error: { message: `Odômetro inválido: o valor atual no sistema é ${currentVehicle.odometer_current_km}km.` }
                };
            }
        }

        // 3. Prepare Payload with Text Normalization
        const payload = {
            ...validatedData,
            company_id: companyId,
            updated_at: new Date().toISOString(),
            // Apply Title Case to text fields
            name: toTitleCase(validatedData.name),
            brand: toTitleCase(validatedData.brand),
            model: toTitleCase(validatedData.model),
            color: toTitleCase(validatedData.color),
        };

        // 4. Persistence
        const { data: savedData, error } = await supabase
            .from('fleet_vehicles')
            .upsert(payload as any) // as any because DB types might not be sync'd, but validatedData is strict
            .select()
            .single();

        if (error) {
            if (error.code === '23505') {
                return { ok: false, error: { message: 'Já existe um veículo cadastrado com esta placa nesta empresa.' } };
            }
            throw error;
        }

        revalidatePath('/app/frota');
        return { ok: true, data: savedData as FleetVehicleRow };

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Erro interno ao salvar';
        logger.error('[fleet/save] Error', { error });
        return { ok: false, error: { message: errorMessage } };
    }
}

/**
 * Toggles vehicle active status.
 */
export async function toggleVehicleActiveAction(id: string, isActive: boolean): Promise<ActionResult> {
    try {
        const companyId = await getActiveCompanyId();
        const supabase = await createClient();

        const { error } = await supabase
            .from('fleet_vehicles')
            .update({
                is_active: isActive,
                updated_at: new Date().toISOString()
            } as any)
            .eq('id', id)
            .eq('company_id', companyId);

        if (error) throw error;

        revalidatePath('/app/frota');
        return { ok: true };
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Erro ao alterar status';
        logger.error('[fleet/status] Error', { error });
        return { ok: false, error: { message: errorMessage } };
    }
}

/**
 * Specifically inactivate a vehicle (for explicit audit logic if needed).
 */
export async function inactivateVehicleAction(id: string): Promise<ActionResult> {
    return toggleVehicleActiveAction(id, false);
}
