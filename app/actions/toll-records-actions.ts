"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { getActiveCompanyId } from "@/lib/auth/get-active-company";
import { tollRecordSchema } from "@/lib/validations/toll-records";
import { ActionResult, TollRecordRow, TollRecordListFilters } from "@/lib/types/toll-records";

export async function listTollRecordsAction(
    vehicleId: string,
    filters?: TollRecordListFilters
): Promise<ActionResult<TollRecordRow[]>> {
    try {
        const supabase = await createClient();

        let query = supabase
            .from("fleet_toll_records")
            .select("*")
            .eq("vehicle_id", vehicleId)
            .order("toll_date", { ascending: false })
            .order("toll_time", { ascending: false });

        if (filters?.startDate) {
            query = query.gte("toll_date", filters.startDate);
        }

        if (filters?.endDate) {
            query = query.lte("toll_date", filters.endDate);
        }

        if (filters?.paymentMethod) {
            query = query.eq("payment_method", filters.paymentMethod);
        }

        if (filters?.search) {
            query = query.ilike("location", `%${filters.search}%`);
        }

        const { data, error } = await query;

        if (error) {
            console.error("Error listing toll records:", error);
            return { ok: false, error: { message: "Erro ao buscar registros de pedágio" } };
        }

        return { ok: true, data: data || [] };
    } catch (error) {
        console.error("Unexpected error in listTollRecordsAction:", error);
        return { ok: false, error: { message: "Erro inesperado ao buscar registros" } };
    }
}

export async function saveTollRecordAction(
    formData: unknown
): Promise<ActionResult<TollRecordRow>> {
    try {
        const company_id = await getActiveCompanyId();

        if (!company_id) {
            return { ok: false, error: { message: "Empresa não encontrada" } };
        }

        // Validate input
        const parsed = tollRecordSchema.safeParse(formData);
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
                .from("fleet_toll_records")
                .update({
                    toll_date: data.toll_date,
                    toll_time: data.toll_time,
                    location: data.location,
                    amount: data.amount,
                    payment_method: data.payment_method,
                    notes: data.notes,
                    updated_by: user.id,
                    updated_at: new Date().toISOString()
                })
                .eq("id", data.id)
                .select()
                .single();

            if (error) {
                console.error("Error updating toll record:", error);
                return { ok: false, error: { message: "Erro ao atualizar registro" } };
            }

            revalidatePath(`/app/frota/${data.vehicle_id}`);
            return { ok: true, data: updated };
        } else {
            // Create new record
            const { data: created, error } = await supabase
                .from("fleet_toll_records")
                .insert({
                    company_id: company_id,
                    vehicle_id: data.vehicle_id,
                    toll_date: data.toll_date,
                    toll_time: data.toll_time,
                    location: data.location,
                    amount: data.amount,
                    payment_method: data.payment_method,
                    notes: data.notes,
                    created_by: user.id
                })
                .select()
                .single();

            if (error) {
                console.error("Error creating toll record:", error);
                return { ok: false, error: { message: "Erro ao criar registro" } };
            }

            revalidatePath(`/app/frota/${data.vehicle_id}`);
            return { ok: true, data: created };
        }
    } catch (error) {
        console.error("Unexpected error in saveTollRecordAction:", error);
        return { ok: false, error: { message: "Erro inesperado ao salvar registro" } };
    }
}

export async function deleteTollRecordAction(id: string): Promise<ActionResult<void>> {
    try {
        const supabase = await createClient();

        const { error } = await supabase
            .from("fleet_toll_records")
            .delete()
            .eq("id", id);

        if (error) {
            console.error("Error deleting toll record:", error);
            return { ok: false, error: { message: "Erro ao excluir registro" } };
        }

        revalidatePath("/app/frota");
        return { ok: true, data: undefined };
    } catch (error) {
        console.error("Unexpected error in deleteTollRecordAction:", error);
        return { ok: false, error: { message: "Erro inesperado ao excluir registro" } };
    }
}
