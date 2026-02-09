'use server';

import { createClient } from '@/utils/supabase/server';
import { getActiveCompanyId } from '@/lib/auth/get-active-company';
import { revalidatePath } from 'next/cache';
import { ExpeditionActionResult } from '@/lib/types/expedition-dto';

export async function updateRouteOrderStatusAction(
    routeOrderId: string,
    status: string,
    payload: any = null
): Promise<ExpeditionActionResult<void>> {
    try {
        await getActiveCompanyId(); // Auth check
        const supabase = await createClient();

        const updateData: any = { loading_status: status };

        // Logic replicated from LoadingChecklist.tsx
        if (status === 'loaded' || status === 'not_loaded' || status === 'pending') {
            updateData.partial_payload = null;
        }
        if (payload !== null) {
            updateData.partial_payload = payload;
        }

        const { error } = await supabase
            .from('delivery_route_orders')
            .update(updateData)
            .eq('id', routeOrderId);

        if (error) throw error;

        revalidatePath('/app/expedicao');
        return { ok: true, data: undefined };
    } catch (e: any) {
        return { ok: false, error: { message: e.message } };
    }
}
