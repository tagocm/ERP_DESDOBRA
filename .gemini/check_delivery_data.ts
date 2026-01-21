import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkDelivery() {
    // Get the first delivery
    const { data: deliveries, error: deliveriesError } = await supabase
        .from('deliveries')
        .select('id, number, status, sales_document_id')
        .limit(5);

    if (deliveriesError) {
        console.error('Error fetching deliveries:', deliveriesError);
        return;
    }

    console.log('Found deliveries:', deliveries);

    if (deliveries && deliveries.length > 0) {
        const firstDelivery = deliveries[0];
        console.log('\n=== Checking first delivery:', firstDelivery.id, '===');

        // Try to fetch it like the API does
        const { data: fullDelivery, error: detailError } = await supabase
            .from('deliveries')
            .select(`
        *,
        items:delivery_items(
          *,
          sales_item:sales_document_items(
            unit_price,
            product:item_id(*)
          )
        ),
        route:delivery_routes(*)
      `)
            .eq('id', firstDelivery.id)
            .single();

        if (detailError) {
            console.error('Error fetching detail:', detailError);
        } else {
            console.log('\n=== Full delivery data ===');
            console.log(JSON.stringify(fullDelivery, null, 2));
        }
    }
}

checkDelivery();
