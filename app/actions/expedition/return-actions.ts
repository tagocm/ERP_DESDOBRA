'use server';

import { createClient } from '@/utils/supabase/server';
import { updateReturnStaging } from '@/lib/data/expedition';

export async function updateReturnStagingAction(
    routeOrderId: string,
    outcomeType: string,
    payload: any
) {
    try {
        const supabase = await createClient();
        await updateReturnStaging(supabase, routeOrderId, outcomeType, payload);
        return { ok: true };
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        return { ok: false, error: { message } };
    }
}
