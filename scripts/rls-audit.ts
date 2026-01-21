/**
 * RLS Audit Script - Analyze all Supabase table access patterns
 * Scans codebase for `.from()` calls and categorizes by client type
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

interface TableAccess {
    table: string;
    file: string;
    line: number;
    code: string;
    clientType: 'client' | 'admin' | 'unknown';
    operations: Set<string>;
}

const TARGET_TABLES = [
    'delivery_route_orders',
    'delivery_routes',
    'sales_document_items',
    'sales_documents',
    'users',
    'price_table_items',
    'cfops',
    'items',
    'price_tables',
    'company_settings'
];

const accesses: TableAccess[] = [];

function detectClientType(fileContent: string, lineNum: number): 'client' | 'admin' | 'unknown' {
    const lines = fileContent.split('\n');

    // Look backwards from current line for client creation
    for (let i = Math.max(0, lineNum - 20); i < lineNum; i++) {
        const line = lines[i];
        if (line.includes('createAdminClient') || line.includes('adminSupabase')) {
            return 'admin';
        }
        if (line.includes('createClient') && !line.includes('Admin')) {
            return 'client';
        }
    }

    // Check variable name in current context
    const contextLines = lines.slice(Math.max(0, lineNum - 5), lineNum + 1).join('\n');
    if (/admin.*supabase|supabase.*admin/i.test(contextLines)) {
        return 'admin';
    }

    return 'unknown';
}

function detectOperations(code: string): string[] {
    const ops: string[] = [];
    if (/\.select\(/.test(code)) ops.push('SELECT');
    if (/\.insert\(/.test(code)) ops.push('INSERT');
    if (/\.update\(/.test(code)) ops.push('UPDATE');
    if (/\.delete\(/.test(code)) ops.push('DELETE');
    if (/\.upsert\(/.test(code)) ops.push('UPSERT');
    return ops.length > 0 ? ops : ['UNKNOWN'];
}

function scanFile(filePath: string) {
    try {
        const content = readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');

        lines.forEach((line, idx) => {
            // Match .from('table') or .from("table") or .from(`table`)
            const matches = line.match(/\.from\(['"` ]([a-z_]+)['"` ]\)/g);
            if (!matches) return;

            matches.forEach(match => {
                const tableMatch = match.match(/from\(['"` ]([a-z_]+)['"` ]\)/);
                if (!tableMatch) return;

                const table = tableMatch[1];
                if (!TARGET_TABLES.includes(table)) return;

                const clientType = detectClientType(content, idx);
                const operations = detectOperations(line);

                accesses.push({
                    table,
                    file: filePath.replace(process.cwd() + '/', ''),
                    line: idx + 1,
                    code: line.trim(),
                    clientType,
                    operations: new Set(operations)
                });
            });
        });
    } catch (err) {
        // Skip files that can't be read
    }
}

function scanDirectory(dir: string) {
    try {
        const items = readdirSync(dir);

        for (const item of items) {
            const fullPath = join(dir, item);
            const stat = statSync(fullPath);

            // Skip node_modules, .next, .git
            if (item === 'node_modules' || item === '.next' || item === '.git' || item.startsWith('.')) {
                continue;
            }

            if (stat.isDirectory()) {
                scanDirectory(fullPath);
            } else if (item.endsWith('.ts') || item.endsWith('.tsx')) {
                scanFile(fullPath);
            }
        }
    } catch (err) {
        // Skip directories that can't be read
    }
}

// Main execution
console.log('🔍 Scanning codebase for table access patterns...\n');

scanDirectory(process.cwd());

// Group by table
const byTable = new Map<string, TableAccess[]>();
accesses.forEach(access => {
    if (!byTable.has(access.table)) {
        byTable.set(access.table, []);
    }
    byTable.get(access.table)!.push(access);
});

// Report
console.log('📊 TABLE ACCESS REPORT\n');
console.log('='.repeat(80));

TARGET_TABLES.forEach(table => {
    const accesses = byTable.get(table) || [];

    console.log(`\n### ${table.toUpperCase()}`);
    console.log(`Total accesses: ${accesses.length}`);

    if (accesses.length === 0) {
        console.log('  ⚠️  No accesses found\n');
        return;
    }

    // Count by client type
    const clientCount = accesses.filter(a => a.clientType === 'client').length;
    const adminCount = accesses.filter(a => a.clientType === 'admin').length;
    const unknownCount = accesses.filter(a => a.clientType === 'unknown').length;

    console.log(`  Client: ${clientCount} | Admin: ${adminCount} | Unknown: ${unknownCount}`);

    // Operations
    const allOps = new Set<string>();
    accesses.forEach(a => a.operations.forEach(op => allOps.add(op)));
    console.log(`  Operations: ${Array.from(allOps).join(', ')}`);

    // Files
    const files = new Set(accesses.map(a => a.file));
    console.log(`  Files (${files.size}):`);
    Array.from(files).slice(0, 5).forEach(f => {
        const fileAccesses = accesses.filter(a => a.file === f);
        const type = fileAccesses[0].clientType;
        console.log(`    - ${f} (${type})`);
    });
    if (files.size > 5) {
        console.log(`    ... and ${files.size - 5} more`);
    }
});

console.log('\n' + '='.repeat(80));
console.log('\n✅ Analysis complete\n');

// Export JSON for further processing
const report = {
    tables: Array.from(byTable.entries()).map(([table, accesses]) => ({
        table,
        total: accesses.length,
        clientAccesses: accesses.filter(a => a.clientType === 'client').length,
        adminAccesses: accesses.filter(a => a.clientType === 'admin').length,
        operations: Array.from(new Set(accesses.flatMap(a => Array.from(a.operations)))),
        files: Array.from(new Set(accesses.map(a => a.file)))
    }))
};

console.log('📄 Detailed report saved to: rls-audit-report.json\n');
require('fs').writeFileSync(
    'rls-audit-report.json',
    JSON.stringify(report, null, 2)
);
