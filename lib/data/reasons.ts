import { SupabaseClient } from "@supabase/supabase-js";
import { DeliveryReason, DeliveryReasonGroup } from "@/types/reasons";

export async function getDeliveryReasons(
    supabase: SupabaseClient,
    companyId: string, // Unused for system reasons but kept for signature compatibility
    group?: DeliveryReasonGroup
): Promise<DeliveryReason[]> {
    let query = supabase
        .from('system_occurrence_reasons')
        .select(`
            *,
            defaults:system_occurrence_reason_defaults(*)
        `)
        .order('sort_order', { ascending: true })
        .order('label', { ascending: true }); // Changed from name to label

    if (group) {
        query = query.eq('type_code', group); // Changed from reason_group to type_code
    }

    const { data, error } = await query;
    if (error) throw error;

    // Map to DeliveryReason interface
    return (data || []).map((r: any) => {
        const defaults = Array.isArray(r.defaults) ? r.defaults[0] : r.defaults;
        return {
            id: r.id,
            company_id: 'SYSTEM', // System reasons are global
            name: r.label,
            reason_group: r.type_code as DeliveryReasonGroup,
            is_active: r.active,
            require_note: defaults?.require_note || false,
            sort_order: r.sort_order,
            created_at: r.created_at,
            updated_at: r.updated_at
        };
    });
}

export async function upsertDeliveryReason(
    supabase: SupabaseClient,
    reason: Partial<DeliveryReason> // Keeping the type but mapping internally
) {
    if (!reason.name || !reason.reason_group) {
        throw new Error("Missing required fields");
    }

    // 1. Upsert Reason
    const reasonPayload = {
        id: reason.id, // If provided, update. Else insert (requires ID for defaults though)
        // If no ID, let Supabase gen it? No, if we want to upsert defaults we need ID.
        // If new, we insert reason, get ID, then insert defaults.
        // If update, we use ID.
        type_code: reason.reason_group,
        label: reason.name,
        active: reason.is_active !== undefined ? reason.is_active : true,
        updated_at: new Date().toISOString()
    };

    let reasonId = reason.id;
    const errorOp = null;

    if (!reasonId) {
        // Insert
        const { data, error } = await supabase
            .from('system_occurrence_reasons')
            .insert(reasonPayload)
            .select()
            .single();

        if (error) throw error;
        reasonId = data.id;
    } else {
        // Update
        const { error } = await supabase
            .from('system_occurrence_reasons')
            .update(reasonPayload)
            .eq('id', reasonId);

        if (error) throw error;
    }

    // 2. Upsert Defaults
    // Check if defaults exist
    const { data: existingDefault } = await supabase
        .from('system_occurrence_reason_defaults')
        .select('id')
        .eq('reason_id', reasonId)
        .maybeSingle();

    const defaultsPayload = {
        reason_id: reasonId,
        require_note: reason.require_note || false,
        updated_at: new Date().toISOString()
    };

    if (existingDefault) {
        const { error } = await supabase
            .from('system_occurrence_reason_defaults')
            .update(defaultsPayload)
            .eq('id', existingDefault.id);
        if (error) throw error;
    } else {
        const { error } = await supabase
            .from('system_occurrence_reason_defaults')
            .insert(defaultsPayload);
        if (error) throw error;
    }

    return { id: reasonId };
}

export async function deleteDeliveryReason(supabase: SupabaseClient, id: string) {
    // Check usage in order_occurrence_logs
    const { count, error: checkError } = await supabase
        .from('order_occurrence_logs') // Updated table name
        .select('*', { count: 'exact', head: true })
        .eq('reason_id', id);

    if (checkError) throw checkError;

    if (count && count > 0) {
        throw new Error("Não é possível excluir este motivo pois ele já foi utilizado em registros.");
    }

    const { error } = await supabase
        .from('system_occurrence_reasons') // Updated table name
        .delete()
        .eq('id', id);

    if (error) throw error;
}
