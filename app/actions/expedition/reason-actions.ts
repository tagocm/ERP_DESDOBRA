'use server';

import { createClient } from '@/utils/supabase/server';
import { getDeliveryReasons } from '@/lib/data/reasons';
import { DeliveryReason } from '@/types/reasons';
import { ExpeditionActionResult } from '@/lib/types/expedition-dto';
import { getActiveCompanyId } from '@/lib/auth/get-active-company';
import { DeliveryReasonGroup } from '@/lib/types/reasons-dto';

export async function listDeliveryReasonsAction(typeCode?: DeliveryReasonGroup): Promise<ExpeditionActionResult<DeliveryReason[]>> {
    try {
        const companyId = await getActiveCompanyId(); // Auth check & get ID
        const supabase = await createClient();

        // Pass companyId and typeCode to data layer
        // Note: getDeliveryReasons signature might be (supabase, companyId, typeCode) or similar. 
        // Based on Modal usage: getDeliveryReasons(supabase, companyId, 'TYPE')
        const reasons = await getDeliveryReasons(supabase, companyId, typeCode);
        return { ok: true, data: reasons };
    } catch (e: any) {
        return { ok: false, error: { message: e.message } };
    }
}
