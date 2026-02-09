'use server';

import { createClient } from '@/utils/supabase/server';
import {
    getSandboxOrders,
    getScheduledRoutes,
    getUnscheduledRoutes
} from '@/lib/data/expedition';
import {
    toSandboxOrderDTO,
    toDeliveryRouteDTO
} from '@/lib/mappers/expedition-mappers';
import type {
    SandboxOrderDTO,
    DeliveryRouteDTO,
    ExpeditionActionResult
} from '@/lib/types/expedition-dto';

/**
 * Server Actions for expedition data
 * These actions call lib/data functions and convert results to serializable DTOs
 */

export async function listSandboxOrdersAction(
    companyId: string
): Promise<ExpeditionActionResult<SandboxOrderDTO[]>> {
    try {
        const supabase = await createClient();
        const orders = await getSandboxOrders(supabase, companyId);
        const dto = orders.map(toSandboxOrderDTO);
        return { ok: true, data: dto };
    } catch (error: any) {
        console.error('Error loading sandbox orders:', error);
        return {
            ok: false,
            error: { message: error.message || 'Erro ao carregar pedidos do sandbox' }
        };
    }
}

export async function listScheduledRoutesAction(
    companyId: string,
    weekStart: string,
    weekEnd: string
): Promise<ExpeditionActionResult<DeliveryRouteDTO[]>> {
    try {
        const supabase = await createClient();
        const routes = await getScheduledRoutes(supabase, companyId, weekStart, weekEnd);
        const dto = routes.map(toDeliveryRouteDTO);
        return { ok: true, data: dto };
    } catch (error: any) {
        console.error('Error loading scheduled routes:', error);
        return {
            ok: false,
            error: { message: error.message || 'Erro ao carregar rotas agendadas' }
        };
    }
}

export async function listUnscheduledRoutesAction(
    companyId: string
): Promise<ExpeditionActionResult<DeliveryRouteDTO[]>> {
    try {
        const supabase = await createClient();
        const routes = await getUnscheduledRoutes(supabase, companyId);
        const dto = routes.map(toDeliveryRouteDTO);
        return { ok: true, data: dto };
    } catch (error: any) {
        console.error('Error loading unscheduled routes:', error);
        return {
            ok: false,
            error: { message: error.message || 'Erro ao carregar rotas não agendadas' }
        };
    }
}
