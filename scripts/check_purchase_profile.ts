
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    console.log("Checking item_purchase_profiles...");

    // 1. Check one record to see structure
    const { data: profile, error } = await supabase
        .from('item_purchase_profiles')
        .select('*')
        .limit(1);

    if (error) {
        console.error("Error fetching profile:", error);
    } else {
        console.log("Profile structure:", profile?.[0] ? Object.keys(profile[0]) : "No profiles found");
    }

    // 2. Search for Aveia
    const { data: items } = await supabase
        .from('items')
        .select('id, name')
        .ilike('name', '%Aveia%')
        .limit(1);

    if (items && items.length > 0) {
        const item = items[0];
        console.log(`Found item: ${item.name} (${item.id})`);

        const { data: specificProfile } = await supabase
            .from('item_purchase_profiles')
            .select('*')
            .eq('item_id', item.id);

        console.log("Profile for Aveia:", specificProfile);
    } else {
        console.log("Item 'Aveia' not found");
    }
}

check();
