import { createClient } from '@supabase/supabase-js';

/**
 * Quick test to verify CHECK constraints are working
 * Tries to insert invalid status values and expects them to fail
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function testConstraints() {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    console.log('🧪 Testing CHECK Constraints...\n');

    // Get a company and client for testing
    const { data: companies } = await supabase.from('companies').select('id').limit(1);
    const { data: orgs } = await supabase.from('organizations').select('id').limit(1);

    if (!companies?.[0] || !orgs?.[0]) {
        console.error('❌ Need at least one company and organization');
        return;
    }

    const companyId = companies[0].id;
    const clientId = orgs[0].id;

    // Test 1: Try inserting invalid status_logistic (EN value)
    console.log('Test 1: Trying invalid status_logistic "pending" (should FAIL)...');
    const { error: error1 } = await supabase.from('sales_documents').insert({
        company_id: companyId,
        client_id: clientId,
        doc_type: 'order',
        status_commercial: 'draft',
        status_logistic: 'pending', // INVALID - should be 'pendente'
        status_fiscal: 'none',
        total_amount: 100
    });

    if (error1) {
        console.log('  ✅ PASS - Correctly rejected:', error1.message.substring(0, 80));
    } else {
        console.log('  ❌ FAIL - Should have been rejected!');
    }

    // Test 2: Try inserting valid status_logistic
    console.log('\nTest 2: Trying valid status_logistic "pendente" (should PASS)...');
    const { data: data2, error: error2 } = await supabase.from('sales_documents').insert({
        company_id: companyId,
        client_id: clientId,
        doc_type: 'order',
        status_commercial: 'draft',
        status_logistic: 'pendente', // VALID
        status_fiscal: 'none',
        total_amount: 100
    }).select('id').single();

    if (error2) {
        console.log('  ❌ FAIL - Should have been accepted:', error2.message);
    } else {
        console.log('  ✅ PASS - Correctly accepted');
        // Cleanup
        await supabase.from('sales_documents').delete().eq('id', data2.id);
    }

    // Test 3: Try invalid financial_status
    console.log('\nTest 3: Trying invalid financial_status "approved" (should FAIL)...');
    const { error: error3 } = await supabase.from('sales_documents').insert({
        company_id: companyId,
        client_id: clientId,
        doc_type: 'order',
        status_commercial: 'draft',
        status_logistic: 'pendente',
        status_fiscal: 'none',
        financial_status: 'approved', // INVALID - should be 'aprovado'
        total_amount: 100
    });

    if (error3) {
        console.log('  ✅ PASS - Correctly rejected:', error3.message.substring(0, 80));
    } else {
        console.log('  ❌ FAIL - Should have been rejected!');
    }

    // Test 4: Try valid 'parcial' status
    console.log('\nTest 4: Trying valid status_logistic "parcial" (should PASS)...');
    const { data: data4, error: error4 } = await supabase.from('sales_documents').insert({
        company_id: companyId,
        client_id: clientId,
        doc_type: 'order',
        status_commercial: 'confirmed',
        status_logistic: 'parcial', // VALID - newly added
        status_fiscal: 'none',
        total_amount: 100
    }).select('id').single();

    if (error4) {
        console.log('  ❌ FAIL - Should have been accepted:', error4.message);
    } else {
        console.log('  ✅ PASS - Correctly accepted');
        // Cleanup
        await supabase.from('sales_documents').delete().eq('id', data4.id);
    }

    console.log('\n✅ All constraint tests completed!');
}

testConstraints().catch(console.error);
