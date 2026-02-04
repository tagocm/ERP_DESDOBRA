
import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";
import { requireInternalApiAccess } from "@/lib/api/internal";
import { logger } from "@/lib/logger";

export async function POST(request: Request) {
    const gate = requireInternalApiAccess(request);
    if (gate) return gate;

    const supabase = await createClient();

    try {
        // 1. Get Test User ID
        const { data: userId } = await supabase.rpc('get_test_user_id');
        if (!userId) return NextResponse.json({ error: "No test user" }, { status: 500 });

        // 2. Get Company (from user)
        const { data: member } = await supabase.from('company_members').select('company_id').eq('auth_user_id', userId).single();
        const companyId = member?.company_id;

        // 3. Enable Feature Flag
        await supabase
            .from('company_settings')
            .update({ use_deliveries_model: true })
            .eq('company_id', companyId); // Assuming 1:1 or accessible by Policy? 
        // If RLS blocks, we might need a helper RPC or manual SQL trigger.
        // But usually company owner can update settings.

        // Backup: Insert if missing
        const { count } = await supabase.from('company_settings').select('company_id', { count: 'exact', head: true }).eq('company_id', companyId);
        if (count === 0) {
            await supabase.from('company_settings').insert({ company_id: companyId, use_deliveries_model: true });
        }

        // 4. Seed Order
        const { data: seedData, error: seedError } = await supabase.rpc('seed_test_data');
        if (seedError) throw seedError;
        const orderId = seedData.order_id;

        if (!orderId) throw new Error("Seed failed to return orderId");

        // 5. Create Route
        const { data: route, error: routeError } = await supabase
            .from('delivery_routes')
            .insert({
                company_id: companyId,
                name: 'Rota Teste Deliveries',
                route_date: new Date().toISOString(),
                status: 'pending'
            })
            .select()
            .single();

        if (routeError) throw routeError;

        // 6. Link Order to Route
        const { error: linkError } = await supabase
            .from('delivery_route_orders')
            .insert({
                company_id: companyId,
                route_id: route.id,
                sales_document_id: orderId,
                loading_status: 'pending' // Simulate ready to load
            });

        if (linkError) throw linkError;

        return NextResponse.json({ success: true, routeId: route.id, orderId });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        logger.error("[test/setup-delivery-test] Error", { message });
        return NextResponse.json(
            { error: process.env.NODE_ENV === "production" ? "Erro ao configurar teste" : message },
            { status: 500 }
        );
    }
}
