'use server';

import { createClient } from '@/utils/supabase/server';
import { getSystemReasons, getSystemOccurrenceTypes, upsertSystemReason, deleteSystemReason } from '@/lib/data/system-preferences';
import { SystemOccurrenceReasonWithDefaults, SystemOccurrenceReason, SystemOccurrenceReasonDefault } from '@/types/system-preferences';
import { ActionResult } from '@/lib/types/fuel-records'; // reusing generic action result type or create new one

export async function listSystemReasonsAction(typeCode: string): Promise<{ ok: boolean, data?: SystemOccurrenceReasonWithDefaults[], error?: { message: string } }> {
    try {
        const supabase = await createClient();
        const data = await getSystemReasons(supabase, typeCode);
        return { ok: true, data };
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        return { ok: false, error: { message } };
    }
}
