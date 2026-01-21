import { createClient } from '@/lib/supabase/action';

/**
 * Test script to validate CHECK constraints accept all valid status values
 * and reject invalid ones. Run AFTER migration.
 */

const VALID_COMMERCIAL = ['draft', 'sent', 'approved', 'confirmed', 'cancelled', 'lost'];
const VALID_LOGISTIC = ['pendente', 'roteirizado', 'agendado', 'em_rota', 'entregue', 'devolvido', 'parcial'];
const VALID_FISCAL = ['none', 'authorized', 'cancelled', 'error'];
const VALID_FINANCIAL = ['pendente', 'pre_lancado', 'aprovado', 'em_revisao', 'cancelado'];
const VALID_PURCHASE = ['draft', 'sent', 'received', 'cancelled'];

interface TestResult {
    test: string;
    passed: boolean;
    error?: string;
}

async function testStatusConstraints() {
    const supabase = createClient();
    const results: TestResult[] = [];

    console.log('🧪 Starting Status Constraint Tests...\n');

    // Get a test company (use first available)
    const { data: companies } = await supabase.from('companies').select('id').limit(1);
    if (!companies || companies.length === 0) {
        throw new Error('No companies found in database');
    }
    const companyId = companies[0].id;

    // Get a test client/supplier
    const { data: orgs } = await supabase.from('organizations').select('id').limit(1);
    if (!orgs || orgs.length === 0) {
        throw new Error('No organizations found in database');
    }
    const orgId = orgs[0].id;

    // ============================================
    // SALES DOCUMENTS - Valid Status Tests
    // ============================================

    console.log('📊 Testing sales_documents valid status...');

    for (const commercial of VALID_COMMERCIAL) {
        for (const logistic of VALID_LOGISTIC) {
            const testName = `sales: commercial=${commercial}, logistic=${logistic}`;

            try {
                const { error } = await supabase
                    .from('sales_documents')
                    .insert({
                        company_id: companyId,
                        client_id: orgId,
                        doc_type: 'order',
                        status_commercial: commercial,
                        status_logistic: logistic,
                        status_fiscal: 'none',
                        total_amount: 100
                    })
                    .select('id')
                    .single();

                if (error) {
                    results.push({ test: testName, passed: false, error: error.message });
                } else {
                    results.push({ test: testName, passed: true });
                    // Clean up
                    await supabase.from('sales_documents').delete().eq('company_id', companyId).eq('status_commercial', commercial).eq('status_logistic', logistic);
                }
            } catch (e: any) {
                results.push({ test: testName, passed: false, error: e.message });
            }
        }
    }

    // ============================================
    // SALES DOCUMENTS - Invalid Status Tests
    // ============================================

    console.log('🚫 Testing sales_documents invalid status...');

    const invalidTests = [
        { commercial: 'pending', logistic: 'pendente', expected: 'fail' }, // EN value
        { commercial: 'draft', logistic: 'delivered', expected: 'fail' }, // EN value
        { commercial: 'billed', logistic: 'pendente', expected: 'fail' }, // Removed value
        { commercial: 'draft', logistic: 'invalid', expected: 'fail' }
    ];

    for (const invalidTest of invalidTests) {
        const testName = `sales INVALID: commercial=${invalidTest.commercial}, logistic=${invalidTest.logistic}`;

        try {
            const { error } = await supabase
                .from('sales_documents')
                .insert({
                    company_id: companyId,
                    client_id: orgId,
                    doc_type: 'order',
                    status_commercial: invalidTest.commercial,
                    status_logistic: invalidTest.logistic,
                    status_fiscal: 'none',
                    total_amount: 100
                });

            if (error) {
                // Expected to fail
                results.push({ test: testName, passed: true }); // Passing because it correctly rejected
            } else {
                results.push({ test: testName, passed: false, error: 'Expected constraint violation but insert succeeded' });
                // Clean up unexpected success
                await supabase.from('sales_documents').delete().eq('company_id', companyId).eq('status_commercial', invalidTest.commercial);
            }
        } catch (e: any) {
            // Expected - constraint violation
            results.push({ test: testName, passed: true });
        }
    }

    // ============================================
    // PURCHASE ORDERS - Valid Status Tests
    // ============================================

    console.log('📦 Testing purchase_orders valid status...');

    for (const status of VALID_PURCHASE) {
        const testName = `purchase: status=${status}`;

        try {
            const { error } = await supabase
                .from('purchase_orders')
                .insert({
                    company_id: companyId,
                    supplier_id: orgId,
                    status: status,
                    ordered_at: new Date().toISOString()
                })
                .select('id')
                .single();

            if (error) {
                results.push({ test: testName, passed: false, error: error.message });
            } else {
                results.push({ test: testName, passed: true });
                // Clean up
                await supabase.from('purchase_orders').delete().eq('company_id', companyId).eq('status', status);
            }
        } catch (e: any) {
            results.push({ test: testName, passed: false, error: e.message });
        }
    }

    // ============================================
    // PURCHASE ORDERS - Invalid Status Tests
    // ============================================

    console.log('🚫 Testing purchase_orders invalid status...');

    const invalidPurchaseTests = ['pending', 'approved', 'confirmed', 'invalid'];

    for (const invalidStatus of invalidPurchaseTests) {
        const testName = `purchase INVALID: status=${invalidStatus}`;

        try {
            const { error } = await supabase
                .from('purchase_orders')
                .insert({
                    company_id: companyId,
                    supplier_id: orgId,
                    status: invalidStatus,
                    ordered_at: new Date().toISOString()
                });

            if (error) {
                results.push({ test: testName, passed: true }); // Correctly rejected
            } else {
                results.push({ test: testName, passed: false, error: 'Expected constraint violation but insert succeeded' });
                await supabase.from('purchase_orders').delete().eq('company_id', companyId).eq('status', invalidStatus);
            }
        } catch (e: any) {
            results.push({ test: testName, passed: true }); // Correctly rejected
        }
    }

    // ============================================
    // REPORT
    // ============================================

    console.log('\n' + '='.repeat(60));
    console.log('🧪 TEST RESULTS');
    console.log('='.repeat(60) + '\n');

    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;
    const total = results.length;

    console.log(`Total: ${total} | Passed: ${passed} | Failed: ${failed}\n`);

    if (failed > 0) {
        console.log('❌ FAILED TESTS:\n');
        results.filter(r => !r.passed).forEach(r => {
            console.log(`  - ${r.test}`);
            if (r.error) console.log(`    Error: ${r.error}`);
        });
        console.log('');
    }

    if (passed === total) {
        console.log('✅ All tests passed! Status constraints are working correctly.\n');
        return { success: true, passed, failed, total };
    } else {
        console.log(`⚠️  ${failed} test(s) failed. Review constraint configuration.\n`);
        return { success: false, passed, failed, total };
    }
}

// Execute if run directly
if (require.main === module) {
    testStatusConstraints()
        .then(result => {
            process.exit(result.success ? 0 : 1);
        })
        .catch(error => {
            console.error('❌ Test execution failed:', error);
            process.exit(1);
        });
}

export { testStatusConstraints };
