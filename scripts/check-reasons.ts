
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkReasons() {
    const { data: types, error } = await supabase
        .from('system_occurrence_reasons')
        .select('type_code, label')
        .order('type_code');

    if (error) {
        console.error('Error:', error);
        return;
    }

    const uniqueTypes = [...new Set(types.map(t => t.type_code))];
    console.log('Unique Type Codes found:', uniqueTypes);
    console.log('Sample Reasons:');
    types.forEach(t => console.log(`[${t.type_code}] ${t.label}`));
}

checkReasons();
