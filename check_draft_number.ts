
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
let serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
    try {
        const envPath = path.resolve(__dirname, '.env.local');
        const envConfig = fs.readFileSync(envPath, 'utf8');
        envConfig.split('\n').forEach(line => {
            const [key, value] = line.split('=');
            if (key?.trim() === 'NEXT_PUBLIC_SUPABASE_URL') supabaseUrl = value.trim();
            if (key?.trim() === 'SUPABASE_SERVICE_ROLE_KEY') serviceKey = value.trim();
        });
    } catch (e) { }
}
const supabase = createClient(supabaseUrl!, serviceKey!);

async function runTest() {
    console.log("--- Testing Draft Numbering (v2) ---");

    // Fetch valid company and client
    const { data: company } = await supabase.from('companies').select('id').limit(1).single();
    if (!company) { console.log("No company found."); return; }

    // Fetch valid client
    const { data: client } = await supabase.from('organizations').select('id').eq('company_id', company.id).limit(1).maybeSingle();
    // If no client in company, try any client
    const { data: clientBackup } = await supabase.from('organizations').select('id').limit(1).single();

    const validClientId = client?.id || clientBackup?.id;
    if (!validClientId) { console.log("No client found."); return; }

    const commonData = {
        company_id: company.id,
        client_id: validClientId,
        status_fiscal: 'none',
        status_logistic: 'pending',
    };

    // 1. Insert Draft Order
    const { data: draft, error: e1 } = await supabase.from('sales_documents').insert({
        ...commonData,
        status_commercial: 'draft',
        doc_type: 'order'
    }).select().single();

    if (e1) {
        console.error("Draft Insert Error:", e1.message);
    } else if (draft) {
        console.log(`Draft Order (status=draft) Number: ${draft.document_number} (Expect NULL)`);
        await supabase.from('sales_documents').delete().eq('id', draft.id);
    }

    // 2. Insert Proposal
    const { data: proposal, error: e2 } = await supabase.from('sales_documents').insert({
        ...commonData,
        status_commercial: 'draft',
        doc_type: 'proposal'
    }).select().single();

    if (e2) {
        console.error("Proposal Insert Error:", e2.message);
    } else if (proposal) {
        console.log(`Proposal (doc_type=proposal) Number: ${proposal.document_number} (Expect NUMBER)`);
        await supabase.from('sales_documents').delete().eq('id', proposal.id);
    }
}

runTest();
