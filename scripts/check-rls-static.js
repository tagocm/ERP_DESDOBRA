#!/usr/bin/env node

/**
 * Static RLS audit (best-effort) based on all `.sql` files in `supabase/migrations/`.
 *
 * Limitations:
 * - This is NOT a source-of-truth for the live database.
 * - It won’t catch RLS enabled manually or via `supabase db push` outside migrations.
 * - SQL parsing is regex-based; it aims to be useful, not perfect.
 *
 * Usage:
 *   node scripts/check-rls-static.js
 *
 * Exit codes:
 *   0 = no findings (or migrations dir missing)
 *   1 = findings (tables without RLS and/or without policies)
 */

const fs = require('node:fs');
const path = require('node:path');

const MIGRATIONS_DIR = path.join(process.cwd(), 'supabase', 'migrations');
const STRICT = process.argv.includes('--strict') || process.env.CI_STRICT_RLS === 'true';

function warn(message) {
    if (process.env.GITHUB_ACTIONS) {
        console.log(`::warning::${message}`);
        return;
    }
    console.warn(message);
}

function stripQuotes(identifier) {
    return identifier.replaceAll('"', '');
}

function normalizeTableName(raw) {
    const cleaned = stripQuotes(raw.trim());
    if (!cleaned) return null;
    if (cleaned.includes('.')) return cleaned;
    return `public.${cleaned}`;
}

function readAllMigrationSqlFiles() {
    if (!fs.existsSync(MIGRATIONS_DIR)) return [];
    return fs
        .readdirSync(MIGRATIONS_DIR)
        .filter((f) => f.endsWith('.sql'))
        .sort()
        .map((fileName) => {
            const fullPath = path.join(MIGRATIONS_DIR, fileName);
            const sql = fs.readFileSync(fullPath, 'utf8');
            return { fileName, sql };
        });
}

function stripSqlComments(sql) {
    // Remove /* ... */ blocks first, then -- line comments.
    // This is best-effort and not a full SQL parser, but it reduces false positives a lot.
    return sql.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--.*$/gm, ' ');
}

function collectTablesAndRlsSignals(files) {
    const createdTables = new Set();
    const rlsEnabled = new Set();
    const policyOnTable = new Set();
    const openPolicyOnTable = new Set();

    const createTableRe = /\bcreate\s+table\s+(?:if\s+not\s+exists\s+)?((?:"[^"]+"|\w+)(?:\.(?:"[^"]+"|\w+))?)/gi;
    const enableRlsRe = /\balter\s+table\s+(?:only\s+)?((?:"[^"]+"|\w+)(?:\.(?:"[^"]+"|\w+))?)\s+enable\s+row\s+level\s+security\b/gi;
    const createPolicyRe = /\bcreate\s+policy\s+[\s\S]*?\bon\s+((?:"[^"]+"|\w+)(?:\.(?:"[^"]+"|\w+))?)/gi;
    const createPolicyStmtRe = /\bcreate\s+policy\b[\s\S]*?;/gi;
    const openUsingRe = /\busing\s*\(\s*true\s*\)/i;
    const openWithCheckRe = /\bwith\s+check\s*\(\s*true\s*\)/i;

    for (const { sql } of files) {
        const normalizedSql = stripSqlComments(sql);
        for (const match of normalizedSql.matchAll(createTableRe)) {
            const table = normalizeTableName(match[1]);
            if (table) createdTables.add(table);
        }
        for (const match of normalizedSql.matchAll(enableRlsRe)) {
            const table = normalizeTableName(match[1]);
            if (table) rlsEnabled.add(table);
        }
        for (const match of normalizedSql.matchAll(createPolicyRe)) {
            const table = normalizeTableName(match[1]);
            if (table) policyOnTable.add(table);
        }

        for (const match of normalizedSql.matchAll(createPolicyStmtRe)) {
            const stmt = match[0];
            if (!openUsingRe.test(stmt) && !openWithCheckRe.test(stmt)) continue;
            const onMatch = /\bon\s+((?:"[^"]+"|\w+)(?:\.(?:"[^"]+"|\w+))?)/i.exec(stmt);
            if (!onMatch) continue;
            const table = normalizeTableName(onMatch[1]);
            if (table) openPolicyOnTable.add(table);
        }
    }

    return { createdTables, rlsEnabled, policyOnTable, openPolicyOnTable };
}

function main() {
    const files = readAllMigrationSqlFiles();
    if (files.length === 0) {
        console.log('[rls-static] No migrations found; skipping.');
        process.exit(0);
    }

    const { createdTables, rlsEnabled, policyOnTable, openPolicyOnTable } = collectTablesAndRlsSignals(files);

    const created = [...createdTables].sort();
    const withoutRls = created.filter((t) => !rlsEnabled.has(t));
    const rlsWithoutPolicies = created.filter((t) => rlsEnabled.has(t) && !policyOnTable.has(t));
    const openPolicies = created.filter((t) => openPolicyOnTable.has(t));

    console.log(`[rls-static] Tables created in migrations: ${created.length}`);
    console.log(`[rls-static] Tables with RLS enabled: ${[...rlsEnabled].length}`);
    console.log(`[rls-static] Tables with at least one policy: ${[...policyOnTable].length}`);

    let ok = true;

    if (withoutRls.length > 0) {
        ok = false;
        warn(`[rls-static] Findings: ${withoutRls.length} tables without explicit RLS enablement in migrations.`);
        console.error(`\n[rls-static] Tables without explicit RLS enablement in migrations:`);
        for (const t of withoutRls) console.error(`- ${t}`);
    }

    if (rlsWithoutPolicies.length > 0) {
        ok = false;
        warn(`[rls-static] Findings: ${rlsWithoutPolicies.length} tables with RLS enabled but no policies in migrations.`);
        console.error(`\n[rls-static] Tables with RLS enabled but no policies in migrations:`);
        for (const t of rlsWithoutPolicies) console.error(`- ${t}`);
    }

    if (openPolicies.length > 0) {
        ok = false;
        warn(`[rls-static] Findings: ${openPolicies.length} tables with at least one open policy (USING/WITH CHECK true) in migrations.`);
        console.error(`\n[rls-static] Tables with at least one open policy (USING/WITH CHECK true) in migrations:`);
        for (const t of openPolicies) console.error(`- ${t}`);
    }

    if (!ok) {
        console.error('\n[rls-static] NOTE: This is a static audit. Confirm live DB state separately.');
        process.exit(STRICT ? 1 : 0);
    }
}

main();
