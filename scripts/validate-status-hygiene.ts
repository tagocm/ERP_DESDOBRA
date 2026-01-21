import { createClient } from '@/lib/supabase/action';

/**
 * Script to validate status hygiene across sales_documents and purchase_orders
 * Run BEFORE and AFTER migration to ensure data consistency
 */

const VALID_COMMERCIAL = ['draft', 'sent', 'approved', 'confirmed', 'cancelled', 'lost'];
const VALID_LOGISTIC = ['pendente', 'roteirizado', 'agendado', 'em_rota', 'entregue', 'devolvido', 'parcial'];
const VALID_FISCAL = ['none', 'authorized', 'cancelled', 'error'];
const VALID_FINANCIAL = ['pendente', 'pre_lancado', 'aprovado', 'em_revisao', 'cancelado'];
const VALID_PURCHASE = ['draft', 'sent', 'received', 'cancelled'];

interface ValidationReport {
    entity: string;
    field: string;
    invalidValues: Array<{ value: string; count: number }>;
    totalInvalid: number;
}

async function validateStatusHygiene() {
    const supabase = createClient();
    const reports: ValidationReport[] = [];

    console.log('🔍 Starting Status Hygiene Validation...\n');

    // ============================================
    // SALES DOCUMENTS
    // ============================================

    console.log('📊 Validating sales_documents...');

    // status_commercial
    const { data: commercialData } = await supabase
        .from('sales_documents')
        .select('status_commercial')
        .not('status_commercial', 'in', `(${VALID_COMMERCIAL.join(',')})`);

    if (commercialData && commercialData.length > 0) {
        const valueCounts = new Map<string, number>();
        commercialData.forEach(row => {
            const val = row.status_commercial;
            valueCounts.set(val, (valueCounts.get(val) || 0) + 1);
        });

        reports.push({
            entity: 'sales_documents',
            field: 'status_commercial',
            invalidValues: Array.from(valueCounts).map(([value, count]) => ({ value, count })),
            totalInvalid: commercialData.length
        });
    }

    // status_logistic
    const { data: logisticData } = await supabase
        .from('sales_documents')
        .select('status_logistic')
        .not('status_logistic', 'in', `(${VALID_LOGISTIC.join(',')})`);

    if (logisticData && logisticData.length > 0) {
        const valueCounts = new Map<string, number>();
        logisticData.forEach(row => {
            const val = row.status_logistic;
            valueCounts.set(val, (valueCounts.get(val) || 0) + 1);
        });

        reports.push({
            entity: 'sales_documents',
            field: 'status_logistic',
            invalidValues: Array.from(valueCounts).map(([value, count]) => ({ value, count })),
            totalInvalid: logisticData.length
        });
    }

    // status_fiscal
    const { data: fiscalData } = await supabase
        .from('sales_documents')
        .select('status_fiscal')
        .not('status_fiscal', 'in', `(${VALID_FISCAL.join(',')})`);

    if (fiscalData && fiscalData.length > 0) {
        const valueCounts = new Map<string, number>();
        fiscalData.forEach(row => {
            const val = row.status_fiscal;
            valueCounts.set(val, (valueCounts.get(val) || 0) + 1);
        });

        reports.push({
            entity: 'sales_documents',
            field: 'status_fiscal',
            invalidValues: Array.from(valueCounts).map(([value, count]) => ({ value, count })),
            totalInvalid: fiscalData.length
        });
    }

    // financial_status
    const { data: financialData } = await supabase
        .from('sales_documents')
        .select('financial_status')
        .not('financial_status', 'is', null)
        .not('financial_status', 'in', `(${VALID_FINANCIAL.join(',')})`);

    if (financialData && financialData.length > 0) {
        const valueCounts = new Map<string, number>();
        financialData.forEach(row => {
            const val = row.financial_status;
            valueCounts.set(val, (valueCounts.get(val) || 0) + 1);
        });

        reports.push({
            entity: 'sales_documents',
            field: 'financial_status',
            invalidValues: Array.from(valueCounts).map(([value, count]) => ({ value, count })),
            totalInvalid: financialData.length
        });
    }

    // ============================================
    // PURCHASE ORDERS
    // ============================================

    console.log('📦 Validating purchase_orders...');

    const { data: purchaseData } = await supabase
        .from('purchase_orders')
        .select('status')
        .not('status', 'in', `(${VALID_PURCHASE.join(',')})`);

    if (purchaseData && purchaseData.length > 0) {
        const valueCounts = new Map<string, number>();
        purchaseData.forEach(row => {
            const val = row.status;
            valueCounts.set(val, (valueCounts.get(val) || 0) + 1);
        });

        reports.push({
            entity: 'purchase_orders',
            field: 'status',
            invalidValues: Array.from(valueCounts).map(([value, count]) => ({ value, count })),
            totalInvalid: purchaseData.length
        });
    }

    // ============================================
    // REPORT
    // ============================================

    console.log('\n' + '='.repeat(60));
    console.log('📋 VALIDATION REPORT');
    console.log('='.repeat(60) + '\n');

    if (reports.length === 0) {
        console.log('✅ All status values are valid! No anomalies detected.\n');
        return { success: true, reports: [] };
    }

    console.log(`⚠️  Found ${reports.length} field(s) with invalid values:\n`);

    reports.forEach((report, index) => {
        console.log(`${index + 1}. ${report.entity}.${report.field}`);
        console.log(`   Total invalid records: ${report.totalInvalid}`);
        console.log('   Invalid values:');
        report.invalidValues.forEach(({ value, count }) => {
            console.log(`     - "${value}": ${count} record(s)`);
        });
        console.log('');
    });

    console.log('🔧 Action required: Run migration to normalize these values.\n');

    return { success: false, reports };
}

// Execute if run directly
if (require.main === module) {
    validateStatusHygiene()
        .then(result => {
            process.exit(result.success ? 0 : 1);
        })
        .catch(error => {
            console.error('❌ Validation failed:', error);
            process.exit(1);
        });
}

export { validateStatusHygiene };
