
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/supabase';

const supabaseUrl = 'https://qyqupzlkouoqrvmxckar.supabase.co';
const supabaseKey = 'sb_secret_WV3jfMrpGWK7CMSL5Bmn6A_LgBatB-V';
const supabase = createClient<Database>(supabaseUrl, supabaseKey);

async function checkArTable() {
    console.log("Checking if ar_titles table exists...");

    const { error } = await supabase
        .from('ar_titles')
        .select('id')
        .limit(1);

    if (error) {
        console.log("Error querying ar_titles:", error.message);
        if (error.code === '42P01') {
            console.log("Table ar_titles DOES NOT exist.");
        }
    } else {
        console.log("Table ar_titles exists.");
    }
}

checkArTable();
