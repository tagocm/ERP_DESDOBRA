'use server';

import { createClient } from '@/utils/supabase/server';
import { getDeliveryReasons } from '@/lib/data/reasons';
import { DeliveryReason } from '@/types/reasons';
import { ExpeditionActionResult } from '@/lib/types/expedition-dto';
import { getActiveCompanyId } from '@/lib/auth/get-active-company';
import { DeliveryReasonGroup } from '@/lib/types/reasons-dto';

export async function listDeliveryReasonsAction(typeCode?: DeliveryReasonGroup): Promise<ExpeditionActionResult<DeliveryReason[]>> {
    try {
        const supabase = await createClient();
        const reasons = await getDeliveryReasons(supabase, '', typeCode);

        if (reasons.length > 0 || !typeCode) {
            return { ok: true, data: reasons };
        }

        let companyId: string;
        try {
            companyId = await getActiveCompanyId();
        } catch {
            return { ok: true, data: [] };
        }

        // Backward compatibility:
        // Some tenants still keep operational reasons in legacy `delivery_reasons`.
        const legacyGroupMap: Record<DeliveryReasonGroup, string[]> = {
            EXPEDICAO_CARREGADO_PARCIAL: ['CARREGAMENTO_PARCIAL'],
            EXPEDICAO_NAO_CARREGADO: ['NAO_CARREGAMENTO'],
            RETORNO_ENTREGA_PARCIAL: ['ENTREGA_PARCIAL', 'DEVOLUCAO', 'DEVOLUCAO_PARCIAL'],
            RETORNO_NAO_ENTREGUE: ['NAO_ENTREGA', 'NAO_ENTREGUE', 'OUTROS']
        };

        const legacyGroups = legacyGroupMap[typeCode];
        const { data: legacyRows, error: legacyError } = await supabase
            .from('delivery_reasons')
            .select('id, company_id, name, reason_group, is_active, require_note, sort_order, created_at, updated_at')
            .eq('company_id', companyId)
            .in('reason_group', legacyGroups)
            .eq('is_active', true)
            .order('sort_order', { ascending: true })
            .order('name', { ascending: true });

        if (legacyError) throw legacyError;

        const fallbackReasons: DeliveryReason[] = (legacyRows || []).map((row: any) => ({
            id: row.id,
            company_id: row.company_id,
            name: row.name,
            reason_group: typeCode,
            is_active: row.is_active,
            require_note: row.require_note || false,
            sort_order: row.sort_order || 0,
            created_at: row.created_at,
            updated_at: row.updated_at
        }));

        return { ok: true, data: fallbackReasons };
    } catch (e: any) {
        return { ok: false, error: { message: e.message } };
    }
}
