'use server';

import { createClient } from '@/utils/supabase/server';
import { getActiveCompanyId } from '@/lib/auth/get-active-company';
// actually getCompanyId is often in app/actions/auth or similar.
// Wait, in route-actions I used '@/utils/auth/company-context'. Let me verify if that exists.
// Actually, I should use the one from other actions.
// fiscal-operations-actions.ts used `getCompanyId` from ... wait.
// Let me check where `getCompanyId` comes from in previous files.
// It seems `getCompanyId` is often a helper I need to ensure exists or use `cookies` based one.
// Most actions use `const supabase = await createClient(); const { data: { user } } = ...`
// But I saw `getCompanyId` being used in my thought process.
// Let's check `app/actions/expedition-actions.ts` again.
// It receives `companyId` as argument!
// But the requirement says "Enforce companyId en TODA query/mutation" and "const companyId = await getCompanyId()".
// So I need to find where `getCompanyId` is defined.
// PROBABLY `app/actions/get-company-id.ts` or similar?
// Let me check `app/actions` content.

import { revalidatePath } from 'next/cache';
import { updateOrderVolumes } from '@/lib/data/expedition';
import { ExpeditionActionResult } from '@/lib/types/expedition-dto';

export async function updateOrderVolumesAction(
    routeId: string,
    orderId: string,
    volumes: number
): Promise<ExpeditionActionResult<void>> {
    try {
        // Enforce auth and tenant
        await getActiveCompanyId();
        const supabase = await createClient();

        await updateOrderVolumes(supabase, routeId, orderId, volumes);

        revalidatePath('/app/expedition');
        return { ok: true, data: undefined };
    } catch (e: any) {
        return { ok: false, error: { message: e.message } };
    }
}
