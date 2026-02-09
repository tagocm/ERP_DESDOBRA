import { createClient } from '@supabase/supabase-js';
import { getPurchaseNeeds } from '../lib/purchases/needs-service';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function simulatePurchaseNeedsCalculation() {
    console.log('=== SIMULATING PURCHASE NEEDS CALCULATION ===\n');

    // Get the company ID
    const { data: companies } = await supabase
        .from('companies')
        .select('id, name')
        .limit(1);

    if (!companies || companies.length === 0) {
        console.log('No companies found!');
        return;
    }

    const companyId = companies[0].id;
    console.log(`Company: ${companies[0].name} (${companyId})\n`);

    // Simulate the exact params from the screenshot
    const params = {
        companyId,
        startDate: new Date('2024-10-07'), // From screenshot: 10/01/2024
        endDate: new Date('2026-01-22'),   // To screenshot: 22/01/2026
        includeRaw: true,
        includePackaging: true,
    };

    console.log('Parameters:');
    console.log(`  Start Date: ${params.startDate.toISOString()}`);
    console.log(`  End Date: ${params.endDate.toISOString()}`);
    console.log(`  Include Raw Materials: ${params.includeRaw}`);
    console.log(`  Include Packaging: ${params.includePackaging}\n`);

    try {
        const results = await getPurchaseNeeds(supabase, params);

        console.log(`\nRESULTS: ${results.length} items\n`);

        // Find Aveia in results
        const aveia = results.find(r => r.item_name.toLowerCase().includes('aveia'));

        if (aveia) {
            console.log('✅ AVEIA FOUND IN RESULTS:');
            console.log('----------------------------');
            console.log(`Item ID: ${aveia.item_id}`);
            console.log(`Name: ${aveia.item_name}`);
            console.log(`SKU: ${aveia.item_sku}`);
            console.log(`Type: ${aveia.item_type}`);
            console.log(`UOM: ${aveia.uom}`);
            console.log(`\nStock Current: ${aveia.stock_current}`);
            console.log(`Stock Min: ${aveia.stock_min}`);
            console.log(`Reorder Point: ${aveia.reorder_point}`);
            console.log(`\n💥 CONSUMPTION FORECAST: ${aveia.consumption_forecast}`);
            console.log(`Stock Projected: ${aveia.stock_projected}`);
            console.log(`Purchase Suggestion: ${aveia.purchase_suggestion}`);
            console.log('----------------------------\n');

            if (aveia.consumption_forecast > 0) {
                console.log('⚠️ PROBLEM CONFIRMED!');
                console.log('Aveia shows consumption forecast, but has no BOM lines.');
                console.log('This suggests there might be:');
                console.log('  1. Orphaned work orders with a BOM that was deleted');
                console.log('  2. Work orders with missing BOM references');
                console.log('  3. A bug in the needs calculation logic\n');
            } else {
                console.log('✅ Consumption is correctly showing as 0.');
            }
        } else {
            console.log('❌ Aveia NOT in purchase needs results.');
            console.log('This means:');
            console.log('  - No work orders are consuming Aveia');
            console.log('  - OR Aveia is filtered out by type\n');
        }

        // Show all items for reference
        console.log('\nALL ITEMS WITH CONSUMPTION:');
        console.log('='.repeat(80));
        results
            .filter(r => r.consumption_forecast > 0)
            .forEach(item => {
                console.log(`${item.item_name.padEnd(30)} | SKU: ${item.item_sku.padEnd(10)} | Consumption: ${item.consumption_forecast.toFixed(3)} ${item.uom}`);
            });

    } catch (error) {
        console.error('Error running calculation:', error);
    }
}

simulatePurchaseNeedsCalculation().catch(console.error);
