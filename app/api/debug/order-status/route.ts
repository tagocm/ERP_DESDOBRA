
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { requireInternalApiAccess } from '@/lib/api/internal';

export async function GET(request: Request) {
    const gate = requireInternalApiAccess(request);
    if (gate) return gate;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id'); // Order ID or Document Number

    if (!id) return NextResponse.json({ error: 'ID required' });

    // USE SERVICE ROLE TO BYPASS RLS
    // Fallback to anon key if service role is missing (but then RLS applies)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Find Order
    let query = supabase.from('sales_documents').select('*');
    if (id.length === 36) query = query.eq('id', id);
    else query = query.eq('document_number', id);

    const { data: order } = await query.single();

    if (!order) return NextResponse.json({ error: 'Order not found' });

    // 2. Deliveries
    const { data: deliveries } = await supabase
        .from('deliveries')
        .select('*, items:delivery_items(*)')
        .eq('sales_document_id', order.id);

    // 3. Route Orders
    const { data: routeOrders } = await supabase
        .from('delivery_route_orders')
        .select('*, route:delivery_routes(*)')
        .eq('sales_document_id', order.id);

    // 4. Inventory Movements (find by item IDs)
    // Check movements referencing this order or its deliveries
    const { data: movements } = await supabase
        .from('inventory_movements')
        .select('*')
        .or(`reference_id.in.(${order.id}), source_ref.ilike.%${order.document_number}%`);

    // Also check delivery reference IDs
    const deliveryItemIds = deliveries?.flatMap(d => d.items?.map((i: any) => i.id) || []) || [];
    let deliveryMovements: any[] = [];
    if (deliveryItemIds.length > 0) {
        const { data: dm } = await supabase
            .from('inventory_movements')
            .select('*')
            .in('reference_id', deliveryItemIds);
        deliveryMovements = dm || [];
    }

    // 5. Route Event Logs
    let logs: any[] = [];
    if (routeOrders && routeOrders.length > 0) {
        // Get all route IDs
        const routeIds = routeOrders.map(ro => ro.route_id);
        const { data: l } = await supabase.from('route_event_logs').select('*').in('route_id', routeIds);
        logs = l || [];
    }

    return NextResponse.json({
        order,
        routeOrders,
        deliveries,
        movements: [...(movements || []), ...deliveryMovements],
        logs,
        envCheck: { hasServiceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY }
    });
}
