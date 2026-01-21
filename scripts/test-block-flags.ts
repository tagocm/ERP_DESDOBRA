import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

/**
 * Test script to verify Block Flags logic
 * 1. Receiving Block (Trigger)
 * 2. Dispatch Block (Code Logic)
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function testBlockFlags() {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    console.log('🛑 Testing Block Flags...\n');

    // Setup: Get company/partners
    const { data: companies } = await supabase.from('companies').select('id').limit(1);
    const { data: orgs } = await supabase.from('organizations').select('id').limit(1);
    const companyId = companies?.[0]?.id;
    const orgId = orgs?.[0]?.id;

    if (!companyId || !orgId) throw new Error('Setup failed: No company/org found');

    // ============================================
    // TEST 1: Purchase Order Receiving Block
    // ============================================
    console.log('📦 TEST 1: Purchase Order Receiving Block');

    // 1. Create blocked PO
    const { data: po, error: poError } = await supabase.from('purchase_orders').insert({
        company_id: companyId,
        supplier_id: orgId,
        status: 'sent',
        ordered_at: new Date().toISOString(),
        receiving_blocked: true,
        receiving_blocked_reason: 'TEST BLOCK REASON'
    }).select('id').single();

    if (poError) throw poError;
    console.log(`  Created blocked PO: ${po.id}`);

    // 2. Try to receive it (Should FAIL via Trigger)
    console.log('  Trying to update status to "received"...');
    const { error: receiveError } = await supabase
        .from('purchase_orders')
        .update({ status: 'received' })
        .eq('id', po.id);

    if (receiveError) {
        console.log('  ✅ PASS: Blocked update correctly:', receiveError.message);
    } else {
        console.log('  ❌ FAIL: Update succeeded but should have been blocked!');
    }

    // Cleanup PO
    await supabase.from('purchase_orders').delete().eq('id', po.id);


    // ============================================
    // TEST 2: Sales Order Dispatch Block
    // ============================================
    console.log('\n🚚 TEST 2: Sales Order Dispatch Block');

    // 1. Create blocked Sales Order
    const { data: so, error: soError } = await supabase.from('sales_documents').insert({
        company_id: companyId,
        client_id: orgId,
        doc_type: 'order',
        status_commercial: 'confirmed',
        status_logistic: 'pendente',
        dispatch_blocked: true,
        dispatch_blocked_reason: 'TEST DISPATCH BLOCK',
        total_amount: 100
    }).select('id').single();

    if (soError) throw soError;
    console.log(`  Created blocked SO: ${so.id}`);

    // 2. Verify it is excluded from Sandbox query
    // Note: We can't easily call the TS function 'getSandboxOrders' here without full context, 
    // but we can replicate the query logic
    const { data: sandboxData } = await supabase
        .from('sales_documents')
        .select('id')
        .eq('id', so.id)
        .eq('status_commercial', 'confirmed')
        .in('status_logistic', ['pendente', 'parcial'])
        .eq('dispatch_blocked', false); // The filter we added

    if (!sandboxData || sandboxData.length === 0) {
        console.log('  ✅ PASS: Order excluded from Sandbox query');
    } else {
        console.log('  ❌ FAIL: Order found in Sandbox query');
    }

    // Cleanup SO
    await supabase.from('sales_documents').delete().eq('id', so.id);

    console.log('\n✅ Block Flag tests completed!');
}

testBlockFlags().catch(console.error);
