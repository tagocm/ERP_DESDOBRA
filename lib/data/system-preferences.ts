import { SupabaseClient } from "@supabase/supabase-js"
import { SystemOccurrenceReasonWithDefaults, SystemOccurrenceReason, SystemOccurrenceReasonDefault } from "@/types/system-preferences"

export const getSystemReasons = async (supabase: SupabaseClient, typeCode: string): Promise<SystemOccurrenceReasonWithDefaults[]> => {
    const { data, error } = await supabase
        .from("system_occurrence_reasons")
        .select(`
            *,
            defaults:system_occurrence_reason_defaults(*)
        `)
        .eq("type_code", typeCode)
        .eq("active", true)
        .order("sort_order")

    if (error) {
        console.error(`Error fetching system reasons for type ${typeCode}:`, error)
        return []
    }

    // Map defaults array to single object
    const reasons = (data || []).map((r: any) => ({
        ...r,
        defaults: Array.isArray(r.defaults) ? r.defaults[0] : r.defaults
    }))

    return reasons
}

export const getSystemOccurrenceTypes = async (supabase: SupabaseClient) => {
    const { data, error } = await supabase
        .from("system_occurrence_types")
        .select("*")
        .eq("active", true)
        .order("sort_order")

    if (error) {
        console.error("Error fetching occurrence types:", error)
        return []
    }
    return data
}

export const upsertSystemReason = async (
    supabase: SupabaseClient,
    reason: Partial<SystemOccurrenceReason>,
    defaults: Partial<SystemOccurrenceReasonDefault>
) => {
    // 1. Upsert Reason
    const { data: reasonData, error: reasonError } = await supabase
        .from("system_occurrence_reasons")
        .upsert({
            id: reason.id, // If provided, updates. If not, inserts (but we need ID for insert usually or let DB generate)
            // If ID is missing, we shouldn't pass it to upsert to let Postgres generate it, unless we gen it here.
            // Better strategy: If ID is present, update. If not, insert.
            type_code: reason.type_code,
            label: reason.label,
            active: reason.active ?? true,
            sort_order: reason.sort_order ?? 0,
            updated_at: new Date().toISOString()
        })
        .select()
        .single()

    if (reasonError) throw reasonError

    // 2. Upsert Defaults
    // Check if default entry exists for this reason
    const { data: existingDefault } = await supabase
        .from("system_occurrence_reason_defaults")
        .select("id")
        .eq("reason_id", reasonData.id)
        .single()

    const defaultPayload = {
        reason_id: reasonData.id,
        require_note: defaults.require_note ?? false,
        allow_override: defaults.allow_override ?? true,
        return_to_sandbox_pending: defaults.return_to_sandbox_pending ?? false,
        register_attempt_note: defaults.register_attempt_note ?? false,
        reverse_stock_and_finance: defaults.reverse_stock_and_finance ?? false,
        create_devolution: defaults.create_devolution ?? false,
        create_new_order_for_pending: defaults.create_new_order_for_pending ?? false,
        create_complement_order: defaults.create_complement_order ?? false,
        write_internal_notes: defaults.write_internal_notes ?? false,
        default_actions: defaults.default_actions ?? {},
        updated_at: new Date().toISOString()
    }

    const { error: defaultsError } = await supabase
        .from("system_occurrence_reason_defaults")
        .upsert(existingDefault ? { ...defaultPayload, id: existingDefault.id } : defaultPayload)

    if (defaultsError) throw defaultsError

    return reasonData
}

export const deleteSystemReason = async (supabase: SupabaseClient, reasonId: string) => {
    // Soft delete (set active = false) or Hard delete?
    // Prompt says "active boolean", implying soft delete usually.
    // But "delete" button usually expects removal.
    // Let's implement Soft Delete by default or allow hard delete if requested.
    // For now, let's do Hard Delete because it's configuration maintenance.

    // First delete defaults
    await supabase.from("system_occurrence_reason_defaults").delete().eq("reason_id", reasonId)
    // Then delete reason
    const { error } = await supabase.from("system_occurrence_reasons").delete().eq("id", reasonId)
    if (error) throw error
}
