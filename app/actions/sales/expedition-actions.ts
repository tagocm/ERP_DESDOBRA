"use server";

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import {
    getTodayRoutes,
    addOrderToRoute,
    getOrCreateDailyRoute,
    getOrCreateAutomaticDispatcherRoute
} from '@/lib/data/expedition';
import { DeliveryRoute } from '@/types/sales';

// Local ActionResult to avoid strict type dependency if needed, matching other file
export type ActionResult<T = void> =
    | { success: true; data: T }
    | { success: false; error: string };

async function getCompanyId(): Promise<string> {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) throw new Error('Usuário não autenticado');

    const { data: companies, error: companyError } = await supabase
        .from('companies')
        .select('id')
        .eq('owner_id', user.id)
        .single();

    if (companyError || !companies) throw new Error('Empresa não encontrada');

    return companies.id;
}

export async function getTodayRoutesAction(): Promise<ActionResult<DeliveryRoute[]>> {
    try {
        const companyId = await getCompanyId();
        const supabase = await createClient();
        const routes = await getTodayRoutes(supabase, companyId);
        return { success: true, data: routes };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function addOrderToRouteAction(orderId: string, routeId: string): Promise<ActionResult<void>> {
    try {
        const companyId = await getCompanyId();
        const supabase = await createClient();
        // data layer signature: addOrderToRoute(supabase, routeId, orderId, position, companyId)
        await addOrderToRoute(supabase, routeId, orderId, 0, companyId);

        revalidatePath(`/app/vendas/pedidos/${orderId}`);
        revalidatePath('/app/expedicao/rotas');

        return { success: true, data: undefined };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function getOrCreateDailyRouteAction(date: string): Promise<ActionResult<DeliveryRoute>> {
    try {
        const companyId = await getCompanyId();
        const supabase = await createClient();
        // data layer getOrCreateDailyRoute only accepts (supabase, companyId) and assumes today
        // If we need specific date, we might need a different function or update data layer.
        // For now, removing date argument to match signature.
        const route = await getOrCreateDailyRoute(supabase, companyId);
        return { success: true, data: route };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function getOrCreateDispatcherRouteAction(): Promise<ActionResult<DeliveryRoute>> {
    try {
        const companyId = await getCompanyId();
        const supabase = await createClient();
        const route = await getOrCreateAutomaticDispatcherRoute(supabase, companyId);
        return { success: true, data: route };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}
