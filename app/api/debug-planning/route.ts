
import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized', details: authError }, { status: 401 });
        }

        const companyId = user.user_metadata?.company_id;
        const startDate = '2026-01-01';
        const endDate = '2026-01-31';

        // 1. Check Routes visibility
        const { data: routes, error: routesError } = await supabase
            .from('delivery_routes')
            .select('id, scheduled_date, company_id')
            .eq('company_id', companyId)
            .gte('scheduled_date', startDate)
            .lte('scheduled_date', endDate);

        // 2. Check Route Orders visibility (this is where it usually fails)
        let routeOrders = null;
        let routeOrdersError = null;

        if (routes && routes.length > 0) {
            const ids = routes.map(r => r.id);
            const q = supabase
                .from('delivery_route_orders')
                .select('id, route_id, sales_document_id') // minimal columns
                .in('route_id', ids);

            const res = await q;
            routeOrders = res.data;
            routeOrdersError = res.error;
        }

        return NextResponse.json({
            user_id: user.id,
            company_id: companyId,
            routes_found: routes?.length || 0,
            routes_sample: routes?.slice(0, 3) || [],
            routes_error: routesError,
            orders_found: routeOrders?.length || 0,
            orders_sample: routeOrders?.slice(0, 3) || [],
            orders_error: routeOrdersError,
            message: "Debug Info"
        });

    } catch (err: any) {
        return NextResponse.json({ error: 'Internal Error', message: err.message }, { status: 500 });
    }
}
