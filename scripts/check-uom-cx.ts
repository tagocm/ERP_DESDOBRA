import { createClient } from '@supabase/supabase-js';

import { supabaseUrl } from './_supabase';
const supabaseKey = 'sb_secret_WV3jfMrpGWK7CMSL5Bmn6A_LgBatB-V';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const { data: uoms } = await supabase
        .from('uoms')
        .select('*')
        .eq('abbrev', 'CX');

    console.log('UOM CX:', JSON.stringify(uoms, null, 2));
}

check();
