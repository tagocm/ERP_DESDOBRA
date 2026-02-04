
import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

export async function POST(
    request: Request,
    props: { params: Promise<{ routeId: string }> }
) {
    const params = await props.params;
    const { routeId } = params;
    const supabase = await createClient();

    try {
        const body = await request.json();
        const { salesDocumentId, occurrenceType, reasonId, reasonNameSnapshot, observation, payload } = body;

        if (!salesDocumentId || !occurrenceType) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        // Get Company
        let companyId = body.companyId;

        if (companyId) {
            // Verify membership
            const { data: member } = await supabase
                .from('company_members')
                .select('company_id')
                .eq('company_id', companyId)
                .eq('auth_user_id', user.id)
                .single();

            if (!member) return NextResponse.json({ error: "Unauthorized for this company" }, { status: 403 });
        } else {
            // Fallback: Get first company
            const { data: userCompany } = await supabase
                .from('company_members')
                .select('company_id')
                .eq('auth_user_id', user.id)
                .limit(1)
                .single();

            if (!userCompany) return NextResponse.json({ error: "No company found" }, { status: 400 });
            companyId = userCompany.company_id;
        }

        // Validation: Check Reason Requirement
        if (reasonId) {
            const { data: reason } = await supabase
                .from('delivery_reasons')
                .select('require_note')
                .eq('id', reasonId)
                .single();

            if (reason?.require_note && !observation?.trim()) {
                return NextResponse.json({ error: "Observação é obrigatória para este motivo." }, { status: 400 });
            }
        } else {
            // "Outros" case -> Observation mandatory
            if (!observation?.trim()) {
                return NextResponse.json({ error: "Observação é obrigatória para 'Outros'." }, { status: 400 });
            }
        }

        // Insert Event (Occurrence)
        const { data, error } = await supabase
            .from('order_delivery_events')
            .insert({
                company_id: companyId,
                route_id: routeId,
                order_id: salesDocumentId,
                event_type: occurrenceType,
                reason_id: reasonId,
                note: observation,
                payload: payload,
                created_by: user.id
            })
            .select()
            .single();

        if (error) throw error;

        // Sync with delivery_route_orders
        let newStatus = null;
        if (occurrenceType === 'PARTIAL_LOADED') newStatus = 'partial';
        if (occurrenceType === 'NAO_CARREGAMENTO') newStatus = 'not_loaded';

        if (newStatus) {
            await supabase.from('delivery_route_orders')
                .update({
                    loading_status: newStatus,
                    partial_payload: payload
                })
                .eq('route_id', routeId)
                .eq('sales_document_id', salesDocumentId);
        }

        return NextResponse.json(data);

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        logger.error("[logistics/routes/occurrences] Error", { routeId, message });
        return NextResponse.json(
            { error: process.env.NODE_ENV === "production" ? "Erro ao salvar ocorrência" : message },
            { status: 500 }
        );
    }
}
