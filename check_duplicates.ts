
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDuplicates() {
    console.log('Checking for duplicates in delivery_route_orders...');

    // Get all items
    const { data, error } = await supabase
        .from('delivery_route_orders')
        .select('id, route_id, sales_document_id');

    if (error) {
        console.error('Error:', error);
        return;
    }

    const map = new Map();
    const duplicates = [];

    data.forEach(item => {
        const key = `${item.route_id}-${item.sales_document_id}`;
        if (map.has(key)) {
            duplicates.push({
                key,
                original: map.get(key),
                duplicate: item
            });
        } else {
            map.set(key, item);
        }
    });

    if (duplicates.length > 0) {
        console.log(`Found ${duplicates.length} duplicates:`);
        console.log(JSON.stringify(duplicates, null, 2));
    } else {
        console.log('No duplicates found.');
    }
}

checkDuplicates();
