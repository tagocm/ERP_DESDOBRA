
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// Use service role key to bypass RLS and see everything
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkProposals() {
    const { data, error } = await supabase
        .from('sales_documents')
        .select('id, document_number, doc_type, status_commercial, created_at')
        .eq('doc_type', 'proposal')
        .not('document_number', 'is', null);

    if (error) {
        console.error('Error fetching proposals:', error);
        return;
    }

    if (!data || data.length === 0) {
        console.log('No proposals with numbers found.');
        return;
    }

    console.log(`FOUND ${data.length} PROPOSALS WITH ORDERS NUMBERS:`);
    data.forEach(p => {
        console.log(`- #${p.document_number} (ID: ${p.id}) - Created: ${p.created_at}`);
    });
}

checkProposals();
