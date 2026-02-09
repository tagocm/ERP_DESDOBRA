"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { getActiveCompanyId } from "@/lib/auth/get-active-company";
import { trafficFineSchema } from "@/lib/validations/traffic-fines";
import { ActionResult, TrafficFineRow, TrafficFineListFilters } from "@/lib/types/traffic-fines";

export async function listTrafficFinesAction(
    vehicleId: string,
    filters?: TrafficFineListFilters
): Promise<ActionResult<TrafficFineRow[]>> {
    try {
        const supabase = await createClient();

        let query = supabase
            .from("fleet_traffic_fines")
            .select("*")
            .eq("vehicle_id", vehicleId)
            .order("fine_date", { ascending: false });

        if (filters?.startDate) {
            query = query.gte("fine_date", filters.startDate);
        }

        if (filters?.endDate) {
            query = query.lte("fine_date", filters.endDate);
        }

        if (filters?.deductedStatus && filters.deductedStatus !== 'all') {
            query = query.eq("deducted_from_driver", filters.deductedStatus === 'deducted');
        }

        if (filters?.search) {
            query = query.or(`city.ilike.%${filters.search}%,reason.ilike.%${filters.search}%,driver_name.ilike.%${filters.search}%`);
        }

        const { data, error } = await query;

        if (error) {
            console.error("Error listing traffic fines:", error);
            return { ok: false, error: { message: "Erro ao buscar registros de multas" } };
        }

        return { ok: true, data: data || [] };
    } catch (error) {
        console.error("Unexpected error in listTrafficFinesAction:", error);
        return { ok: false, error: { message: "Erro inesperado ao buscar registros" } };
    }
}

export async function saveTrafficFineAction(
    formData: unknown
): Promise<ActionResult<TrafficFineRow>> {
    try {
        const company_id = await getActiveCompanyId();

        if (!company_id) {
            return { ok: false, error: { message: "Empresa não encontrada" } };
        }

        // Validate input
        const parsed = trafficFineSchema.safeParse(formData);
        if (!parsed.success) {
            return {
                ok: false,
                error: { message: parsed.error.issues[0]?.message || "Dados inválidos" }
            };
        }

        const supabase = await createClient();
        const data = parsed.data;
        const isUpdate = !!data.id;

        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return { ok: false, error: { message: "Usuário não autenticado" } };
        }

        if (isUpdate) {
            // Update existing record
            const { data: updated, error } = await supabase
                .from("fleet_traffic_fines")
                .update({
                    fine_date: data.fine_date,
                    city: data.city,
                    reason: data.reason,
                    amount: data.amount,
                    driver_name: data.driver_name,
                    notes: data.notes,
                    deducted_from_driver: data.deducted_from_driver,
                    updated_by: user.id,
                    updated_at: new Date().toISOString()
                })
                .eq("id", data.id)
                .select()
                .single();

            if (error) {
                console.error("Error updating traffic fine:", error);
                return { ok: false, error: { message: "Erro ao atualizar registro" } };
            }

            revalidatePath(`/app/frota/${data.vehicle_id}`);
            return { ok: true, data: updated };
        } else {
            // Create new record
            const { data: created, error } = await supabase
                .from("fleet_traffic_fines")
                .insert({
                    company_id: company_id,
                    vehicle_id: data.vehicle_id,
                    fine_date: data.fine_date,
                    city: data.city,
                    reason: data.reason,
                    amount: data.amount,
                    driver_name: data.driver_name,
                    notes: data.notes,
                    deducted_from_driver: data.deducted_from_driver,
                    created_by: user.id
                })
                .select()
                .single();

            if (error) {
                console.error("Error creating traffic fine:", error);
                return { ok: false, error: { message: "Erro ao criar registro" } };
            }

            revalidatePath(`/app/frota/${data.vehicle_id}`);
            return { ok: true, data: created };
        }
    } catch (error) {
        console.error("Unexpected error in saveTrafficFineAction:", error);
        return { ok: false, error: { message: "Erro inesperado ao salvar registro" } };
    }
}

export async function deleteTrafficFineAction(id: string): Promise<ActionResult<void>> {
    try {
        const supabase = await createClient();

        const { error } = await supabase
            .from("fleet_traffic_fines")
            .delete()
            .eq("id", id);

        if (error) {
            console.error("Error deleting traffic fine:", error);
            return { ok: false, error: { message: "Erro ao excluir registro" } };
        }

        revalidatePath("/app/frota");
        return { ok: true, data: undefined };
    } catch (error) {
        console.error("Unexpected error in deleteTrafficFineAction:", error);
        return { ok: false, error: { message: "Erro inesperado ao excluir registro" } };
    }
}
