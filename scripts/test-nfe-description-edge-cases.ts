/**
 * Test if buildNfeProductDescription handles edge cases correctly
 */

import { buildNfeProductDescription } from '../lib/fiscal/nfe-description';

console.log('🧪 Testing buildNfeProductDescription Edge Cases\n');

// Test 1: Normal case
console.log('Test 1: Normal case (all values present)');
try {
    const result1 = buildNfeProductDescription({
        itemName: 'Granola Tradicional 1kg',
        salesUomAbbrev: 'CX',
        baseUomAbbrev: 'PC',
        conversionFactor: 12,
        qtySales: 5,
        qtyBase: 60
    });
    console.log('✅ Success:', result1.xProd);
} catch (err: any) {
    console.log('❌ ERROR:', err.message);
}

// Test 2: Undefined conversion factor
console.log('\nTest 2: Undefined conversionFactor');
try {
    const result2 = buildNfeProductDescription({
        itemName: 'Granola Tradicional 1kg',
        salesUomAbbrev: 'CX',
        baseUomAbbrev: 'PC',
        conversionFactor: undefined as any,
        qtySales: 5,
        qtyBase: 60
    });
    console.log('✅ Success:', result2.xProd);
} catch (err: any) {
    console.log('❌ ERROR:', err.message);
}

// Test 3: Null conversion factor
console.log('\nTest 3: Null conversionFactor');
try {
    const result3 = buildNfeProductDescription({
        itemName: 'Granola Tradicional 1kg',
        salesUomAbbrev: 'CX',
        baseUomAbbrev: 'PC',
        conversionFactor: null as any,
        qtySales: 5,
        qtyBase: 60
    });
    console.log('✅ Success:', result3.xProd);
} catch (err: any) {
    console.log('❌ ERROR:', err.message);
}

// Test 4: Missing qtySales/qtyBase
console.log('\nTest 4: Missing qtySales and qtyBase');
try {
    const result4 = buildNfeProductDescription({
        itemName: 'Granola Tradicional 1kg',
        salesUomAbbrev: 'CX',
        baseUomAbbrev: 'PC',
        conversionFactor: 12
    });
    console.log('✅ Success:', result4.xProd);
} catch (err: any) {
    console.log('❌ ERROR:', err.message);
}

// Test 5: Very long item name
console.log('\nTest 5: Very long item name (>120 chars)');
try {
    const longName = 'A'.repeat(150);
    const result5 = buildNfeProductDescription({
        itemName: longName,
        salesUomAbbrev: 'CX',
        baseUomAbbrev: 'PC',
        conversionFactor: 12,
        qtySales: 50,
        qtyBase: 600
    });
    console.log('✅ Success');
    console.log('  xProd length:', result5.xProd.length);
    console.log('  infAdProd:', result5.infAdProd ? 'Present' : 'None');
} catch (err: any) {
    console.log('❌ ERROR:', err.message);
}

console.log('\n' + '='.repeat(60));
console.log('Test complete');
