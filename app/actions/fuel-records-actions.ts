'use server';

import { createClient } from '@/utils/supabase/server';
import { getActiveCompanyId } from '@/lib/auth/get-active-company';
import { ActionResult, FuelRecordRow } from '@/lib/types/fuel-records';
import { fuelRecordSchema, FuelRecordSchema } from '@/lib/validations/fuel-records';
import { revalidatePath } from 'next/cache';
import { logger } from '@/lib/logger';
import { listFuelRecords } from '@/lib/data/fuel-records';

/**
 * Saves or updates a fuel record.
 * Enforces Zod validation and odometer integrity.
 */
export async function saveFuelRecordAction(data: unknown): Promise<ActionResult<FuelRecordRow>> {
    try {
        const companyId = await getActiveCompanyId();
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        // 1. Validate Input
        const result = fuelRecordSchema.safeParse(data);
        if (!result.success) {
            const message = result.error.issues[0]?.message || "Dados inválidos";
            return { ok: false, error: { message } };
        }
        const validatedData = result.data;

        // 2. Odometer Integrity Check
        // New record's odometer must be >= the last recorded odometer for this vehicle
        const { data: lastRecord } = await supabase
            .from('fleet_fuel_records')
            .select('odometer_km, fuel_date')
            .eq('company_id', companyId)
            .eq('vehicle_id', validatedData.vehicle_id)
            .order('fuel_date', { ascending: false })
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (lastRecord && validatedData.odometer_km < lastRecord.odometer_km) {
            return {
                ok: false,
                error: {
                    message: `Odômetro inválido: o último registro tem ${lastRecord.odometer_km}km. O novo registro deve ter valor igual ou superior.`
                }
            };
        }

        // 3. Prepare Payload
        const payload = {
            ...validatedData,
            company_id: companyId,
            updated_at: new Date().toISOString(),
            ...(validatedData.id ? { updated_by: user?.id } : { created_by: user?.id })
        };

        // 4. Persistence
        const { data: savedData, error } = await supabase
            .from('fleet_fuel_records')
            .upsert(payload as any)
            .select()
            .single();

        if (error) {
            throw error;
        }

        revalidatePath(`/app/frota/${validatedData.vehicle_id}`);
        revalidatePath('/app/frota');
        return { ok: true, data: savedData as FuelRecordRow };

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Erro interno ao salvar';
        logger.error('[fuel-records/save] Error', { error });
        return { ok: false, error: { message: errorMessage } };
    }
}

/**
 * Deletes a fuel record.
 */
export async function deleteFuelRecordAction(id: string): Promise<ActionResult> {
    try {
        const companyId = await getActiveCompanyId();
        const supabase = await createClient();

        const { error } = await supabase
            .from('fleet_fuel_records')
            .delete()
            .eq('id', id)
            .eq('company_id', companyId);

        if (error) throw error;

        revalidatePath('/app/frota');
        return { ok: true };

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Erro ao excluir';
        logger.error('[fuel-records/delete] Error', { error });
        return { ok: false, error: { message: errorMessage } };
    }
}

/**
 * List fuel records with filters
 */
export async function listFuelRecordsAction(
    vehicleId: string,
    filters?: import('@/lib/types/fuel-records').FuelRecordListFilters
): Promise<ActionResult<FuelRecordRow[]>> {
    try {
        const data = await listFuelRecords(vehicleId, filters);
        return { ok: true, data };
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        return { ok: false, error: { message } };
    }
}
