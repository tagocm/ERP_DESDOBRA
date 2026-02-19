"use server";

import { createAdminClient } from "@/lib/supabaseServer";
import { revalidatePath } from "next/cache";

/* ==========================================================================================
 * TYPES
 * ========================================================================================== */

export type VehicleDocumentType = 'IPVA' | 'LICENCIAMENTO';
export type VehicleDocumentStatus = 'EM_ABERTO' | 'VENCIDO';

export interface VehicleDocumentRow {
    id: string;
    company_id: string;
    vehicle_id: string;
    type: VehicleDocumentType;
    competency_year: number;
    amount: number;
    installments_count: number;
    first_due_date: string;
    status: VehicleDocumentStatus;
    notes: string | null;
    created_at: string;
    updated_at: string;
}

export interface VehicleDocumentFilters {
    search?: string;
    type?: string;
    startDate?: string;
    endDate?: string;
}

export interface CreateVehicleDocumentInput {
    vehicle_id: string;
    type: VehicleDocumentType;
    competency_year: number;
    amount: number;
    installments_count: number;
    first_due_date: string; // YYYY-MM-DD
    notes?: string | null;
}

export interface UpdateVehicleDocumentInput {
    type?: VehicleDocumentType;
    competency_year?: number;
    amount?: number;
    installments_count?: number;
    first_due_date?: string;
    notes?: string | null;
}

/* ==========================================================================================
 * ACTIONS
 * ========================================================================================== */

/**
 * List vehicle documents with filters
 */
export async function listVehicleDocumentsAction(vehicleId: string, filters: VehicleDocumentFilters) {
    const admin = createAdminClient();

    let query = admin
        .from("vehicle_documents")
        .select("*")
        .eq("vehicle_id", vehicleId);

    // Apply filters
    if (filters.search) {
        query = query.or(`notes.ilike.%${filters.search}%`);
        // If search is numeric (year), verify
        if (!isNaN(Number(filters.search))) {
            query = query.eq("competency_year", Number(filters.search));
        }
    }

    if (filters.type && filters.type !== 'all') {
        query = query.eq("type", filters.type);
    }

    if (filters.startDate) {
        query = query.gte("first_due_date", filters.startDate);
    }

    if (filters.endDate) {
        query = query.lte("first_due_date", filters.endDate);
    }

    // Default sort: first_due_date descending
    const { data, error } = await query.order("first_due_date", { ascending: false });

    if (error) {
        return { ok: false, error: new Error(error.message) };
    }

    return { ok: true, data: data as VehicleDocumentRow[] };
}

/**
 * Create a new vehicle document
 * (Trigger will automatically create the financial entries)
 */
export async function createVehicleDocumentAction(input: CreateVehicleDocumentInput) {
    const admin = createAdminClient();

    // Verify blocking logic? No, creation is always allowed.
    // Trigger handles creating N installments.

    // Validate simple constraints
    if (input.installments_count < 1 || input.installments_count > 12) {
        return { ok: false, error: new Error("Número de parcelas inválido (1-12)") };
    }

    // Calculate status (simple logic for now)
    const today = new Date().toISOString().split('T')[0];
    let status: VehicleDocumentStatus = 'EM_ABERTO';
    if (input.first_due_date < today) {
        status = 'VENCIDO';
    }

    // Insert
    // Admin insert needs company_id. Fetch from vehicle.
    const { data: vehicle } = await admin.from("fleet_vehicles").select("company_id").eq("id", input.vehicle_id).single();
    if (!vehicle) return { ok: false, error: new Error("Veículo não encontrado") };

    const { data: inserted, error: insertError } = await admin
        .from("vehicle_documents")
        .insert({
            company_id: vehicle.company_id,
            vehicle_id: input.vehicle_id,
            type: input.type,
            competency_year: input.competency_year,
            amount: input.amount,
            installments_count: input.installments_count,
            first_due_date: input.first_due_date,
            status,
            notes: input.notes || null,
        })
        .select()
        .single();

    if (insertError) {
        // Handle constraint errors friendly
        if (insertError.message.includes("vehicle_documents_origin_unique")) {
            return { ok: false, error: new Error("Já existe um documento deste tipo para este ano e vencimento.") };
        }
        return { ok: false, error: new Error(insertError.message) };
    }

    revalidatePath(`/app/frota/${input.vehicle_id}`);
    return { ok: true, data: inserted };
}

/**
 * Update a vehicle document
 * (Trigger will automatically update/recreate the financial entries or BLOCK if approved)
 */
export async function updateVehicleDocumentAction(id: string, input: UpdateVehicleDocumentInput) {
    const admin = createAdminClient();

    // Simple status recalc logic
    let statusUpdate = {};
    if (input.first_due_date) {
        const today = new Date().toISOString().split('T')[0];
        // @ts-ignore
        statusUpdate.status = input.first_due_date < today ? 'VENCIDO' : 'EM_ABERTO';
    }

    const { data, error } = await admin
        .from("vehicle_documents")
        .update({
            ...input,
            ...statusUpdate,
            updated_at: new Date().toISOString()
        })
        .eq("id", id)
        .select()
        .single();

    if (error) {
        // Catch trigger exceptions (blocking logic)
        return { ok: false, error: new Error(error.message) };
    }

    revalidatePath("/app/frota");
    return { ok: true, data };
}

/**
 * Delete a vehicle document
 * (Trigger will automatically delete the financial entries or BLOCK if approved)
 */
export async function deleteVehicleDocumentAction(id: string) {
    const admin = createAdminClient();

    const { error } = await admin
        .from("vehicle_documents")
        .delete()
        .eq("id", id);

    if (error) {
        // Catch trigger exceptions
        return { ok: false, error: new Error(error.message) };
    }

    revalidatePath("/app/frota");
    return { ok: true };
}
