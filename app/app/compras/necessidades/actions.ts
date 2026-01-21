'use server';

import { createClient } from '@/utils/supabase/server';
import { getPurchaseNeeds, PurchaseNeedItem } from '@/lib/purchases/needs-service';

export async function fetchPurchaseNeedsAction(params: {
    startDate: Date;
    endDate: Date;
    includeRaw: boolean;
    includePackaging: boolean;
    companyId: string;
}): Promise<{ data: PurchaseNeedItem[]; error: string | null }> {
    try {
        // Double check authentication
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return { data: [], error: 'Unauthorized' };
        }

        const data = await getPurchaseNeeds(supabase, {
            companyId: params.companyId,
            startDate: params.startDate,
            endDate: params.endDate,
            includeRaw: params.includeRaw,
            includePackaging: params.includePackaging,
        });

        return { data, error: null };
    } catch (e: any) {
        console.error('Action error:', e);
        return { data: [], error: e.message || 'Error executing calculation' };
    }
}
