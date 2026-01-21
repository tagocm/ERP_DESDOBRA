
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function getLatestRoute() {
    const { data, error } = await supabase
        .from('delivery_routes')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);

    if (error) console.error(error);
    else {
        console.log('Latest Route:', data[0]);
        if (data[0]) {
            await checkDeliveries(data[0].id);
        }
    }
}

async function checkDeliveries(routeId: string) {
    console.log(`Checking Deliveries for Route ${routeId}...`);
    const { data, error } = await supabase
        .from('deliveries')
        .select(`
            *,
            items:delivery_items(*)
        `)
        .eq('route_id', routeId);

    if (error) console.error(error);
    else {
        console.log('Deliveries:', JSON.stringify(data, null, 2));
        if (data.length > 0) {
            const userId = data[0].created_by;
            console.log(`Checking profile for user ${userId}...`);
            const { data: profile } = await supabase.from('user_profiles').select('*').eq('auth_user_id', userId);
            console.log('Profile:', profile);

            // Call RPC manually
            const routeId = data[0].route_id;
            console.log(`Calling RPC for Route ${routeId}...`);
            const { error: rpcError } = await supabase.rpc('deduct_stock_from_route', { p_route_id: routeId });
            if (rpcError) console.error('RPC Error:', rpcError);
            else console.log('RPC Call Success (or silent failure)');
        }
    }
}

getLatestRoute();
