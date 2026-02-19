'use server';

import { createClient } from '@/utils/supabase/server';
import { getActiveCompanyId } from '@/lib/auth/get-active-company';
import { revalidatePath } from 'next/cache';
import { updateOrderVolumes } from '@/lib/data/expedition';
import { ExpeditionActionResult } from '@/lib/types/expedition-dto';
import { normalizeRouteStatus } from '@/lib/constants/status';

export async function updateOrderVolumesAction(
    routeId: string,
    orderId: string,
    volumes: number
): Promise<ExpeditionActionResult<void>> {
    try {
        await getActiveCompanyId();
        const supabase = await createClient();

        const { data: route, error: routeError } = await supabase
            .from('delivery_routes')
            .select('status')
            .eq('id', routeId)
            .single();

        if (routeError) throw routeError;

        const routeStatus = normalizeRouteStatus(route?.status) || route?.status;
        if (['in_route', 'in_progress', 'completed', 'cancelled'].includes(routeStatus)) {
            throw new Error('Rota iniciada/finalizada: edição de carregamento bloqueada.');
        }

        await updateOrderVolumes(supabase, routeId, orderId, volumes);

        revalidatePath('/app/logistica/expedicao');
        return { ok: true, data: undefined };
    } catch (e: any) {
        return { ok: false, error: { message: e.message } };
    }
}
