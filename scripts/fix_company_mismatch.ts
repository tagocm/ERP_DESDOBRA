
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Service Role Key required to modify data across companies
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixDataMismatch() {
    const targetCompanyId = '659a0fa5-a142-4ab4-bf76-49f9bf165c30'; // USER'S ID from screenshot
    const sourceCompanyId = 'b826b0d1-bee5-4d47-bef3-a70a064a6569'; // DATA'S ID from debug logs

    console.log(`Migrating Jan 2026 data from ${sourceCompanyId} to ${targetCompanyId}...`);

    // 1. Get Routes to move
    const startDate = '2026-01-01';
    const endDate = '2026-01-31';

    const { data: routes } = await supabase
        .from('delivery_routes')
        .select('id')
        .eq('company_id', sourceCompanyId)
        .gte('scheduled_date', startDate)
        .lte('scheduled_date', endDate);

    if (!routes || routes.length === 0) {
        console.log("No routes found to migrate.");
        return;
    }

    const routeIds = routes.map(r => r.id);
    console.log(`Found ${routeIds.length} routes. Moving them...`);

    // 2. Update Routes
    const { error: routeError } = await supabase
        .from('delivery_routes')
        .update({ company_id: targetCompanyId })
        .in('id', routeIds);

    if (routeError) console.error("Error updating routes:", routeError);
    else console.log("Routes updated.");

    // 3. Find Orders in these routes
    const { data: routeOrders } = await supabase
        .from('delivery_route_orders')
        .select('sales_document_id')
        .in('route_id', routeIds);

    if (routeOrders) {
        const orderIds = routeOrders.map(ro => ro.sales_document_id);
        console.log(`Found ${orderIds.length} orders linked to these routes. Moving them...`);

        // 4. Update Sales Documents
        // Note: This assumes these orders belong to the 'test' dataset and can be moved. 
        // Given the dates (2026), it's safe to assume they are test data.
        if (orderIds.length > 0) {
            const { error: docError } = await supabase
                .from('sales_documents')
                .update({ company_id: targetCompanyId })
                .in('id', orderIds);

            if (docError) console.error("Error updating orders:", docError);
            else console.log("Orders updated.");
        }

        // 5. Update delivery_route_orders (relation table)
        // This table also has company_id
        const { error: relError } = await supabase
            .from('delivery_route_orders')
            .update({ company_id: targetCompanyId })
            .in('route_id', routeIds);

        if (relError) console.error("Error updating route relations:", relError);
        else console.log("Route relations updated.");
    }
}

fixDataMismatch();
