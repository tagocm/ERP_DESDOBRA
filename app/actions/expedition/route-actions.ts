'use server';

import { createClient } from '@/utils/supabase/server';
import { getActiveCompanyId } from '@/lib/auth/get-active-company';
import { revalidatePath } from 'next/cache';
import { z } from 'zod'; // We'll need zod schemas
import {
    createRoute,
    deleteRoute,
    addOrderToRoute,
    removeOrderFromRoute,
    updateRouteSchedule,
    resetAndUnscheduleRoute,
    checkAndCleanupExpiredRoutes
} from '@/lib/data/expedition';
import { toDeliveryRouteDTO } from '@/lib/mappers/expedition-mappers';
import { DeliveryRouteDTO, ExpeditionActionResult, RouteStatus } from '@/lib/types/expedition-dto';

// --- Zod Schemas ---

const CreateRouteSchema = z.object({
    name: z.string().min(1, "Nome é obrigatório"),
    route_date: z.string(), // YYYY-MM-DD
    scheduled_date: z.string().nullable().optional(),
    status: z.custom<RouteStatus>().optional()
});

const RouteIdSchema = z.string().uuid();
const OrderIdSchema = z.string().uuid();

// --- Actions ---

export async function createRouteAction(input: z.infer<typeof CreateRouteSchema>): Promise<ExpeditionActionResult<DeliveryRouteDTO>> {
    try {
        const companyId = await getActiveCompanyId();
        const supabase = await createClient();

        const data = CreateRouteSchema.parse(input);

        // Safe cast for status as we validated it roughly or trust input (it's optional)
        const partialRoute: any = {
            company_id: companyId,
            name: data.name,
            route_date: data.route_date,
            scheduled_date: data.scheduled_date,
            status: data.status
        };

        const route = await createRoute(supabase, partialRoute);

        revalidatePath('/app/expedition');
        return { ok: true, data: toDeliveryRouteDTO(route) };
    } catch (e: any) {
        return { ok: false, error: { message: e.message } };
    }
}

export async function deleteRouteAction(routeId: string): Promise<ExpeditionActionResult<void>> {
    try {
        await getActiveCompanyId(); // Auth check
        const supabase = await createClient();

        await deleteRoute(supabase, routeId);

        revalidatePath('/app/expedition');
        return { ok: true, data: undefined };
    } catch (e: any) {
        return { ok: false, error: { message: e.message } };
    }
}

export async function addOrderToRouteAction(
    routeId: string,
    orderId: string,
    position: number = 999
): Promise<ExpeditionActionResult<void>> {
    try {
        const companyId = await getActiveCompanyId();
        const supabase = await createClient();

        await addOrderToRoute(supabase, routeId, orderId, position, companyId);

        revalidatePath('/app/expedition');
        return { ok: true, data: undefined };
    } catch (e: any) {
        return { ok: false, error: { message: e.message } };
    }
}

export async function removeOrderFromRouteAction(
    routeId: string,
    orderId: string
): Promise<ExpeditionActionResult<void>> {
    try {
        await getActiveCompanyId(); // Auth check
        const supabase = await createClient();

        await removeOrderFromRoute(supabase, routeId, orderId);

        revalidatePath('/app/expedition');
        return { ok: true, data: undefined };
    } catch (e: any) {
        return { ok: false, error: { message: e.message } };
    }
}

export async function updateRouteScheduleAction(
    routeId: string,
    scheduledDate: string | null
): Promise<ExpeditionActionResult<void>> {
    try {
        await getActiveCompanyId(); // Auth check
        const supabase = await createClient();

        await updateRouteSchedule(supabase, routeId, scheduledDate);

        revalidatePath('/app/expedition');
        return { ok: true, data: undefined };
    } catch (e: any) {
        return { ok: false, error: { message: e.message } };
    }
}

export async function resetAndUnscheduleRouteAction(
    routeId: string
): Promise<ExpeditionActionResult<void>> {
    try {
        await getActiveCompanyId(); // Auth check
        const supabase = await createClient();

        await resetAndUnscheduleRoute(supabase, routeId);

        revalidatePath('/app/expedicao');
        revalidatePath('/app/expedition');
        return { ok: true, data: undefined };
    } catch (e: any) {
        return { ok: false, error: { message: e.message } };
    }
}

export async function checkAndCleanupExpiredRoutesAction(): Promise<ExpeditionActionResult<void>> {
    try {
        const companyId = await getActiveCompanyId();
        const supabase = await createClient();

        await checkAndCleanupExpiredRoutes(supabase, companyId);

        revalidatePath('/app/expedition');
        return { ok: true, data: undefined };
    } catch (e: any) {
        return { ok: false, error: { message: e.message } };
    }
}
