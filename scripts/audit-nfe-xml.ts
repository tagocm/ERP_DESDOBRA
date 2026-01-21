/**
 * NFe XML Schema Audit
 * Comprehensive audit to identify schema validation errors
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const supabaseUrl = 'https://qyqupzlkouoqrvmxckar.supabase.co';
const supabaseKey = 'sb_secret_WV3jfMrpGWK7CMSL5Bmn6A_LgBatB-V';
const supabase = createClient(supabaseUrl, supabaseKey);

console.log('🔍 NFE XML SCHEMA AUDIT\n');
console.log('='.repeat(70));

async function audit() {
    // 1. Check if det.ts was updated
    console.log('\n📝 1. CHECKING det.ts FILE\n' + '-'.repeat(70));

    const detPath = path.join(process.cwd(), 'lib', 'nfe', 'xml', 'sections', 'det.ts');
    const detContent = fs.readFileSync(detPath, 'utf-8');

    if (detContent.includes('infAdProd')) {
        console.log('✅ det.ts contains infAdProd code');

        // Check if it's conditionally added
        if (detContent.includes('item.prod.infAdProd')) {
            console.log('✅ infAdProd is conditionally added');
        } else {
            console.log('❌ infAdProd logic missing');
        }
    } else {
        console.log('❌ CRITICAL: det.ts does NOT contain infAdProd');
    }

    // 2. Check mapper integration
    console.log('\n📦 2. CHECKING MAPPER INTEGRATION\n' + '-'.repeat(70));

    const mapperPath = path.join(process.cwd(), 'lib', 'fiscal', 'nfe', 'offline', 'mappers.ts');
    const mapperContent = fs.readFileSync(mapperPath, 'utf-8');

    if (mapperContent.includes('buildNfeProductDescription')) {
        console.log('✅ Mapper imports buildNfeProductDescription');
    } else {
        console.log('❌ Mapper does NOT import buildNfeProductDescription');
    }

    if (mapperContent.includes('infAdProd')) {
        console.log('✅ Mapper handles infAdProd');
    } else {
        console.log('❌ Mapper does NOT handle infAdProd');
    }

    // 3. Check actual data
    console.log('\n💾 3. CHECKING ACTUAL ORDER DATA\n' + '-'.repeat(70));

    const { data: latestOrder } = await supabase
        .from('sales_documents')
        .select('id, document_number')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (!latestOrder) {
        console.log('❌ No orders found');
        return;
    }

    console.log(`Latest Order: #${latestOrder.document_number}`);

    const { data: items } = await supabase
        .from('sales_document_items')
        .select(`
      id,
      quantity,
      qty_base,
      packaging_id,
      sales_uom_abbrev_snapshot,
      base_uom_abbrev_snapshot,
      conversion_factor_snapshot,
      sales_unit_label_snapshot,
      product:items!item_id(name)
    `)
        .eq('document_id', latestOrder.id);

    if (!items || items.length === 0) {
        console.log('❌ No items in latest order');
        return;
    }

    items.forEach((item: any, idx) => {
        console.log(`\n  Item ${idx + 1}: ${item.product?.name}`);
        console.log(`    Snapshots: ${item.sales_uom_abbrev_snapshot ? '✅ SET' : '❌ NULL'}`);
        if (item.sales_uom_abbrev_snapshot) {
            console.log(`      Sales UOM: ${item.sales_uom_abbrev_snapshot}`);
            console.log(`      Base UOM: ${item.base_uom_abbrev_snapshot}`);
            console.log(`      Factor: ${item.conversion_factor_snapshot}`);
        }
    });

    // 4. Test description builder
    console.log('\n🔨 4. TESTING DESCRIPTION BUILDER\n' + '-'.repeat(70));

    try {
        // Dynamic import to get latest version
        const descModule = await import('../lib/fiscal/nfe-description.js');
        const { buildNfeProductDescription } = descModule;

        const testItem = items.find((i: any) => i.sales_uom_abbrev_snapshot);
        if (testItem) {
            const result = buildNfeProductDescription({
                itemName: testItem.product.name,
                salesUomAbbrev: testItem.sales_uom_abbrev_snapshot,
                baseUomAbbrev: testItem.base_uom_abbrev_snapshot,
                conversionFactor: testItem.conversion_factor_snapshot,
                qtySales: testItem.quantity,
                qtyBase: testItem.qty_base
            });

            console.log('✅ Description builder works');
            console.log(`  xProd: "${result.xProd}"`);
            console.log(`  Length: ${result.xProd.length}/120`);
            if (result.infAdProd) {
                console.log(`  infAdProd: "${result.infAdProd}"`);
            }
        } else {
            console.log('⚠️  No items with snapshots to test');
        }
    } catch (err: any) {
        console.log('❌ Description builder error:', err.message);
    }

    // 5. Check for recent errors in debug files
    console.log('\n🐛 5. CHECKING DEBUG LOGS\n' + '-'.repeat(70));

    const debugDir = '/tmp/desdobra-sefaz';
    if (fs.existsSync(debugDir)) {
        const files = fs.readdirSync(debugDir)
            .filter(f => f.endsWith('.response.soap.xml') || f.endsWith('.meta.json'))
            .sort()
            .reverse()
            .slice(0, 2); // Get 2 most recent

        if (files.length > 0) {
            console.log(`Found ${files.length} recent debug files`);

            files.forEach(file => {
                const fullPath = path.join(debugDir, file);
                const content = fs.readFileSync(fullPath, 'utf-8');

                if (file.endsWith('.response.soap.xml')) {
                    console.log(`\n  Response: ${file}`);

                    // Look for rejection messages
                    const rejectMatch = content.match(/<xMotivo>(.*?)<\/xMotivo>/);
                    if (rejectMatch) {
                        console.log(`  ❌ Rejection: ${rejectMatch[1]}`);
                    }

                    const statusMatch = content.match(/<cStat>(\d+)<\/cStat>/);
                    if (statusMatch) {
                        console.log(`  Status Code: ${statusMatch[1]}`);
                    }
                }
            });
        } else {
            console.log('No recent debug files found');
        }
    } else {
        console.log('Debug directory does not exist');
    }

    // 6. Validate XML structure
    console.log('\n📋 6. XML STRUCTURE VALIDATION\n' + '-'.repeat(70));

    console.log('Checking if buildDet function signature is correct...');

    const buildDetMatch = detContent.match(/export function buildDet\(([^)]+)\)/);
    if (buildDetMatch) {
        console.log(`✅ Function signature: buildDet(${buildDetMatch[1]})`);
    }

    // Check return structure
    if (detContent.includes('prod: prodObj') || detContent.includes('prod: {')) {
        console.log('✅ Returns prod object');
    } else {
        console.log('❌ Invalid return structure');
    }

    // SUMMARY
    console.log('\n' + '='.repeat(70));
    console.log('📊 AUDIT SUMMARY');
    console.log('='.repeat(70));

    const checks = [
        { name: 'det.ts updated with infAdProd', pass: detContent.includes('infAdProd') },
        { name: 'Mapper uses buildNfeProductDescription', pass: mapperContent.includes('buildNfeProductDescription') },
        { name: 'Latest order has items', pass: items && items.length > 0 },
        { name: 'Snapshots populated', pass: items?.some((i: any) => i.sales_uom_abbrev_snapshot) }
    ];

    checks.forEach(check => {
        console.log(`${check.pass ? '✅' : '❌'} ${check.name}`);
    });

    const allPass = checks.every(c => c.pass);

    if (!allPass) {
        console.log('\n❌ ISSUES FOUND - See details above');
    } else {
        console.log('\n✅ All checks passed - Error may be in XML serialization');
        console.log('\n💡 NEXT STEPS:');
        console.log('   1. Check /tmp/desdobra-sefaz for actual rejected XML');
        console.log('   2. Validate XML against NFe schema manually');
        console.log('   3. Check SEFAZ error message for specific field');
    }
}

audit().catch(console.error);
