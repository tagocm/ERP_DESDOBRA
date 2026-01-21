
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkQueries() {
    console.log("Checking queries...");

    // Get Aveia ID first
    const { data: items } = await supabase.from('items').select('id, name').ilike('name', '%Aveia%').limit(1);
    if (!items?.[0]) {
        console.error("Aveia not found");
        return;
    }
    const itemId = items[0].id;
    console.log("Item ID:", itemId);

    // 1. Check item_packaging query
    console.log("Testing item_packaging query...");
    const { data: pkgData, error: pkgError } = await supabase
        .from('item_packaging')
        .select('*')
        .eq('item_id', itemId)
        .eq('is_active', true)
        .is('deleted_at', null)
        .order('qty_in_base', { ascending: true });

    if (pkgError) console.error("Packaging Error:", pkgError);
    else console.log("Packaging Data:", pkgData?.length);

    // 2. Check item_purchase_profiles query
    console.log("Testing item_purchase_profiles query...");
    const { data: profData, error: profError } = await supabase
        .from('item_purchase_profiles')
        .select('default_purchase_packaging_id')
        .eq('item_id', itemId)
        .single();

    if (profError) console.error("Profile Error:", profError);
    else console.log("Profile Data:", profData);

    // 3. Check inventory_movements query
    console.log("Testing inventory_movements query...");
    const { data: moveData, error: moveError } = await supabase
        .from('inventory_movements')
        .select('unit_cost')
        .eq('item_id', itemId)
        .eq('reason', 'purchase_in')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (moveError) console.error("Movement Error:", moveError);
    else console.log("Movement Data:", moveData);
}

checkQueries();
