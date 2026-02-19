/**
 * NFe Description Snapshot - Complete Audit
 * 
 * This script audits the entire NFe description snapshot implementation
 * to identify all issues preventing snapshots from being populated.
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

import { supabaseUrl } from '../_supabase';
const supabaseKey = 'sb_secret_WV3jfMrpGWK7CMSL5Bmn6A_LgBatB-V';
const supabase = createClient(supabaseUrl, supabaseKey);

console.log('🔍 NFe DESCRIPTION SNAPSHOT - COMPLETE AUDIT\n');
console.log('='.repeat(60));

async function audit() {
    const issues: string[] = [];
    const warnings: string[] = [];

    // ========================================================================
    // 1. DATABASE SCHEMA VERIFICATION
    // ========================================================================
    console.log('\n📊 1. DATABASE SCHEMA VERIFICATION');
    console.log('-'.repeat(60));

    try {
        const { data, error } = await supabase
            .from('sales_document_items')
            .select('sales_uom_abbrev_snapshot, base_uom_abbrev_snapshot, conversion_factor_snapshot, sales_unit_label_snapshot')
            .limit(1);

        if (error) {
            issues.push(`❌ Database columns not accessible: ${error.message}`);
            console.log('❌ Snapshot columns NOT accessible');
            console.log('   Error:', error.message);
        } else {
            console.log('✅ Snapshot columns exist and are accessible');
        }
    } catch (err: any) {
        issues.push(`❌ Database query failed: ${err.message}`);
    }

    // Check item_packaging.uom_id
    try {
        const { data, error } = await supabase
            .from('item_packaging')
            .select('uom_id')
            .limit(1);

        if (error) {
            issues.push(`❌ item_packaging.uom_id not accessible: ${error.message}`);
            console.log('❌ item_packaging.uom_id NOT accessible');
        } else {
            console.log('✅ item_packaging.uom_id exists');
        }
    } catch (err: any) {
        issues.push(`❌ item_packaging query failed: ${err.message}`);
    }

    // ========================================================================
    // 2. CODE FILE VERIFICATION
    // ========================================================================
    console.log('\n📁 2. CODE FILE VERIFICATION');
    console.log('-'.repeat(60));

    const salesOrdersPath = path.join(process.cwd(), 'lib', 'data', 'sales-orders.ts');

    if (!fs.existsSync(salesOrdersPath)) {
        issues.push('❌ lib/data/sales-orders.ts not found');
        console.log('❌ File not found');
    } else {
        const content = fs.readFileSync(salesOrdersPath, 'utf-8');

        // Check for snapshot population code
        if (content.includes('sales_uom_abbrev_snapshot')) {
            console.log('✅ Snapshot population code exists in source file');
        } else {
            issues.push('❌ Snapshot population code NOT found in source file');
            console.log('❌ Snapshot code NOT found');
        }

        // Check for console logs
        if (content.includes('[NFe Snapshot]')) {
            console.log('✅ Debug logs present in source file');
        } else {
            warnings.push('⚠️  Debug logs not found - harder to trace execution');
            console.log('⚠️  Debug logs not present');
        }

        // Check for deriveUomFromPackagingType function
        if (content.includes('deriveUomFromPackagingType')) {
            console.log('✅ Helper function deriveUomFromPackagingType exists');
        } else {
            issues.push('❌ Helper function deriveUomFromPackagingType NOT found');
            console.log('❌ Helper function missing');
        }
    }

    // ========================================================================
    // 3. ACTUAL DATA VERIFICATION
    // ========================================================================
    console.log('\n📋 3. ACTUAL DATA VERIFICATION');
    console.log('-'.repeat(60));

    // Get latest order
    const { data: latestOrder } = await supabase
        .from('sales_documents')
        .select('id, document_number')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (latestOrder) {
        console.log(`Checking latest order: #${latestOrder.document_number}`);

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
            warnings.push('⚠️  Latest order has no items');
            console.log('⚠️  No items found in latest order');
        } else {
            let hasSnapshots = false;
            let hasPackaging = false;

            items.forEach((item: any) => {
                console.log(`\nItem: ${item.product?.name}`);
                console.log(`  packaging_id: ${item.packaging_id || 'NULL'}`);
                console.log(`  qty_base: ${item.qty_base}`);
                console.log(`  Snapshots:`);
                console.log(`    sales_uom: ${item.sales_uom_abbrev_snapshot || '❌ NULL'}`);
                console.log(`    base_uom: ${item.base_uom_abbrev_snapshot || '❌ NULL'}`);
                console.log(`    factor: ${item.conversion_factor_snapshot || '❌ NULL'}`);
                console.log(`    label: ${item.sales_unit_label_snapshot || '❌ NULL'}`);

                if (item.packaging_id) hasPackaging = true;
                if (item.sales_uom_abbrev_snapshot) hasSnapshots = true;
            });

            if (hasPackaging && !hasSnapshots) {
                issues.push('❌ CRITICAL: Items have packaging_id but NO snapshots populated');
                console.log('\n❌ CRITICAL ISSUE: Snapshots NOT being populated despite packaging_id!');
            } else if (!hasPackaging) {
                warnings.push('⚠️  Items do not have packaging_id set');
                console.log('\n⚠️  Items do not have packaging - snapshots won\'t populate (expected)');
            } else {
                console.log('\n✅ Snapshots are populated!');
            }
        }
    } else {
        warnings.push('⚠️  No orders found in database');
    }

    // ========================================================================
    // 4. FUNCTION CALL TRACE
    // ========================================================================
    console.log('\n🔎 4. FUNCTION CALL TRACE');
    console.log('-'.repeat(60));

    const formPath = path.join(process.cwd(), 'components', 'sales', 'order', 'SalesOrderForm.tsx');

    if (fs.existsSync(formPath)) {
        const formContent = fs.readFileSync(formPath, 'utf-8');

        if (formContent.includes('upsertSalesItem')) {
            console.log('✅ SalesOrderForm calls upsertSalesItem');

            // Check if it's in the save flow
            if (formContent.includes('await upsertSalesItem')) {
                console.log('✅ upsertSalesItem is called with await');
            } else {
                warnings.push('⚠️  upsertSalesItem might not be awaited');
            }
        } else {
            issues.push('❌ SalesOrderForm does NOT call upsertSalesItem');
            console.log('❌ upsertSalesItem NOT called from form');
        }
    }

    // ========================================================================
    // 5. TYPE DEFINITIONS
    // ========================================================================
    console.log('\n📝 5. TYPE DEFINITIONS');
    console.log('-'.repeat(60));

    const typesPath = path.join(process.cwd(), 'types', 'sales.ts');

    if (fs.existsSync(typesPath)) {
        const typesContent = fs.readFileSync(typesPath, 'utf-8');

        if (typesContent.includes('sales_uom_abbrev_snapshot')) {
            console.log('✅ SalesOrderItem type includes snapshot fields');
        } else {
            issues.push('❌ SalesOrderItem type missing snapshot fields');
            console.log('❌ Type definitions missing');
        }
    }

    // ========================================================================
    // SUMMARY
    // ========================================================================
    console.log('\n' + '='.repeat(60));
    console.log('📊 AUDIT SUMMARY');
    console.log('='.repeat(60));

    console.log(`\n🔴 CRITICAL ISSUES: ${issues.length}`);
    issues.forEach(issue => console.log(`  ${issue}`));

    console.log(`\n🟡 WARNINGS: ${warnings.length}`);
    warnings.forEach(warning => console.log(`  ${warning}`));

    if (issues.length === 0 && warnings.length === 0) {
        console.log('\n✅ No issues found - feature should be working!');
    } else if (issues.length === 0) {
        console.log('\n✅ No critical issues - only warnings');
    } else {
        console.log('\n❌ Critical issues found that need fixing');
    }

    // ========================================================================
    // RECOMMENDATIONS
    // ========================================================================
    console.log('\n💡 RECOMMENDATIONS');
    console.log('='.repeat(60));

    if (issues.some(i => i.includes('NOT being populated despite packaging_id'))) {
        console.log('\n🔧 ISSUE: Snapshots not populating');
        console.log('   Possible causes:');
        console.log('   1. Code not being executed (conditional not met)');
        console.log('   2. Silent error in try-catch block');
        console.log('   3. Next.js using cached/old code');
        console.log('   4. Function not being called at all');
        console.log('\n   Solutions:');
        console.log('   ✓ Add error logging to catch block');
        console.log('   ✓ Log entry/exit of function');
        console.log('   ✓ Verify conditional logic');
        console.log('   ✓ Check if await is used');
    }

    if (issues.some(i => i.includes('columns not accessible'))) {
        console.log('\n🔧 ISSUE: Database columns not accessible');
        console.log('   Solutions:');
        console.log('   ✓ Re-run migration: npx supabase db push --include-all');
        console.log('   ✓ Verify RLS policies');
        console.log('   ✓ Check column names match exactly');
    }
}

audit().catch(console.error);
