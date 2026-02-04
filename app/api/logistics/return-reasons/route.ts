
import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

export async function GET(request: Request) {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");

    if (!type) {
        return NextResponse.json({ error: "Type is required" }, { status: 400 });
    }

    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { data: member } = await supabase
            .from('company_members')
            .select('company_id')
            .eq('auth_user_id', user.id)
            .limit(1)
            .maybeSingle();

        if (!member) {
            return NextResponse.json({ error: "No company found" }, { status: 400 });
        }

        const companyId = member.company_id;

        // Map abstract type to internal reason_group
        let reasonGroup = '';
        if (type === 'NOT_LOADED_TOTAL') reasonGroup = 'NAO_CARREGAMENTO';
        else if (type === 'PARTIAL_LOADED') reasonGroup = 'CARREGAMENTO_PARCIAL';
        else if (type === 'NOT_DELIVERED') reasonGroup = 'NAO_ENTREGA';
        else if (type === 'PARTIAL_DELIVERY') reasonGroup = 'ENTREGA_PARCIAL';
        else {
            // Fallback or assume it's already the group name
            reasonGroup = type;
        }

        const { data: reasons, error } = await supabase
            .from('delivery_reasons')
            .select('*')
            .eq('company_id', companyId)
            .eq('reason_group', reasonGroup)
            .eq('is_active', true)
            .order('sort_order')
            .order('name');

        if (error) throw error;

        return NextResponse.json(reasons);

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        logger.error("[logistics/return-reasons] Error", { message });
        return NextResponse.json(
            { error: process.env.NODE_ENV === "production" ? "Erro ao buscar motivos" : message },
            { status: 500 }
        );
    }
}
