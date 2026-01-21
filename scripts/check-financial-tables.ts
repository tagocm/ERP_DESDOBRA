import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qyqupzlkouoqrvmxckar.supabase.co';
const supabaseKey = 'sb_secret_WV3jfMrpGWK7CMSL5Bmn6A_LgBatB-V';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTables() {
    const { data, error } = await supabase.rpc('exec_sql', {
        query: `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE '%financial%' 
      OR table_name LIKE '%gl_account%' 
      OR table_name LIKE '%cost_center%'
      ORDER BY table_name;
    `
    });

    if (error) {
        console.error('Error:', error);

        // Try alternative approach
        const { data: tables, error: err2 } = await supabase
            .from('financial_events')
            .select('id')
            .limit(1);

        if (err2) {
            console.error('Table does NOT exist:', err2.message);
        } else {
            console.log('Table EXISTS! Found', tables?.length || 0, 'records');
        }
    } else {
        console.log('Tables found:', data);
    }
}

checkTables();
