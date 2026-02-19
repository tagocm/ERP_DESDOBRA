'use server';

import { createClient } from '@/utils/supabase/server';
import { getActiveCompanyId } from '@/lib/auth/get-active-company';
import { revalidatePath } from 'next/cache';
import { ExpeditionActionResult } from '@/lib/types/expedition-dto';
import { normalizeRouteStatus } from '@/lib/constants/status';

export async function updateRouteOrderStatusAction(
    routeOrderId: string,
    status: string,
    payload: any = null
): Promise<ExpeditionActionResult<void>> {
    try {
        await getActiveCompanyId(); // Auth check
        const supabase = await createClient();

        const { data: routeOrder, error: routeOrderError } = await supabase
            .from('delivery_route_orders')
            .select(`
                id,
                route_id,
                route:delivery_routes(status)
            `)
            .eq('id', routeOrderId)
            .single();

        if (routeOrderError) throw routeOrderError;

        const routeStatus = normalizeRouteStatus((routeOrder as any)?.route?.status) || (routeOrder as any)?.route?.status;
        if (['in_route', 'in_progress', 'completed', 'cancelled'].includes(routeStatus)) {
            throw new Error('Rota iniciada/finalizada: edição de carregamento bloqueada.');
        }

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

        revalidatePath('/app/logistica/expedicao');
        return { ok: true, data: undefined };
    } catch (e: any) {
        return { ok: false, error: { message: e.message } };
    }
}
