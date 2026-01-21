
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runTest() {
    console.log('🚀 Starting Financial Rejection Flow Test...');

    // Mock user ID (we are using service role, so we can mock the "by" field)
    const MOCK_USER_ID = '00000000-0000-0000-0000-000000000000'; // Replace with a valid UUID if FK enforced, or existing user
    // Get a valid user to avoid FK errors
    const { data: users } = await supabase.from('auth.users').select('id').limit(1); // Won't work with service role usually on auth table direct query if not setup, but let's try or use a known ID.
    // Actually, dispatch_blocked_by is uuid? Let's assume we can use a placeholder if FK is not strict or use a real one.
    // The columns are: dispatch_blocked_by uuid.

    // 0. Fetch valid foreign keys
    const { data: companies } = await supabase.from('companies').select('id').limit(1);
    const { data: clients } = await supabase.from('organizations').select('id').limit(1);

    if (!companies?.length || !clients?.length) {
        console.error('No company or client found to test with.');
        return;
    }
    const companyId = companies[0].id;
    const clientId = clients[0].id;

    // 1. Create a Test Sales Order (Pre-Delivery)
    console.log('\n1️⃣  Testing Sales Rejection (Pre-Delivery)...');
    const { data: order1, error: err1 } = await supabase.from('sales_documents').insert({
        company_id: companyId, // Use a valid company ID
        document_number: 99901,
        doc_type: 'order',
        status_logistic: 'pendente',
        status_commercial: 'confirmed',
        status_fiscal: 'none',
        financial_status: 'pendente', // or whatever valid enum
        client_id: clientId, // Use valid client
        total_amount: 100
    }).select().single();

    if (err1) {
        console.error('Failed to create order 1:', err1);
        // Maybe cleanup?
        return;
    }
    console.log('Created Order 1:', order1.id);

    // Call Rejection Logic (Simulating Server Action)
    // We can't call the server action directly here easily without mocking headers/cookies.
    // So we will replicate the logic OR just verify the columns exist and work if we manually update them?
    // No, better to verify the *Server Action* logic if possible, but this is a script.
    // I will simulate the DB updates that the Server Action performs to verify the DB accepts them.

    const now = new Date().toISOString();
    const update1 = {
        dispatch_blocked: true,
        dispatch_blocked_reason: 'Test Rejection Pre',
        dispatch_blocked_at: now,
        dispatch_blocked_by: null, // If we don't have a user
        status_logistic: 'pendente',
        status_commercial: 'draft'
    };

    const { error: upErr1 } = await supabase.from('sales_documents')
        .update(update1)
        .eq('id', order1.id);

    if (upErr1) console.error('❌ Failed to update Order 1 (Simulation):', upErr1);
    else console.log('✅ Order 1 Updated Successfully (DB Schema allows write)');

    // 2. Test Purchase Rejection (Pre-Receipt)
    console.log('\n2️⃣  Testing Purchase Rejection (Pre-Receipt)...');
    const { data: po1, error: poErr1 } = await supabase.from('purchase_orders').insert({
        company_id: companyId,
        document_number: 88801,
        status: 'sent',
        supplier_id: clientId // Using client as supplier for test simplicity if organization table is shared
    }).select().single();

    if (poErr1) {
        console.log('Failed to create PO 1 (Might be missing fields, skipping PO test if so):', poErr1.message);
    } else {
        console.log('Created PO 1:', po1.id);

        // Block
        const { error: poUpErr } = await supabase.from('purchase_orders')
            .update({
                receiving_blocked: true,
                receiving_blocked_reason: 'Test PO Block'
            })
            .eq('id', po1.id);

        if (poUpErr) console.error('❌ Failed to block PO:', poUpErr);
        else console.log('✅ PO blocked successfully');

        // Test Trigger: Try to receive
        const { error: recvErr } = await supabase.from('purchase_orders')
            .update({ status: 'received' })
            .eq('id', po1.id);

        if (recvErr && recvErr.message.includes('blocked')) {
            console.log('✅ Trigger caught blocked PO receiving attempt!');
        } else {
            console.error('❌ Trigger FAILED to catch blocking!', recvErr || 'No error returned');
        }
    }

    console.log('\n🏁 Test Complete.');
    process.exit(0);
}

runTest().catch(console.error);
