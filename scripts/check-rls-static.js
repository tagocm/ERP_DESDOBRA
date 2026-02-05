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

function normalizeIdentifier(raw) {
    const cleaned = stripQuotes(raw.trim());
    return cleaned || null;
}

function normalizeRoleName(raw) {
    const cleaned = normalizeIdentifier(raw);
    return cleaned ? cleaned.toLowerCase() : null;
}

function parsePolicyRoles(stmt) {
    const toMatch = /\bto\s+([\s\S]*?)(?=\busing\b|\bwith\b|;)/i.exec(stmt);
    if (!toMatch) return [];
    const raw = toMatch[1].trim();
    if (!raw) return [];
    return raw
        .split(',')
        .map((r) => normalizeRoleName(r))
        .filter((r) => Boolean(r));
}

function policyKey(table, name) {
    return `${table}|${name}`;
}

function collectTablesAndRlsSignals(files) {
    const activeTables = new Set();
    const rlsEnabled = new Set();
    const policies = new Map();

    const createTableRe = /\bcreate\s+table\s+(?:if\s+not\s+exists\s+)?((?:"[^"]+"|\w+)(?:\.(?:"[^"]+"|\w+))?)/gi;
    const dropTableRe = /\bdrop\s+table\s+(?:if\s+exists\s+)?((?:"[^"]+"|\w+)(?:\.(?:"[^"]+"|\w+))?)/gi;
    const enableRlsRe = /\balter\s+table\s+(?:only\s+)?((?:"[^"]+"|\w+)(?:\.(?:"[^"]+"|\w+))?)\s+enable\s+row\s+level\s+security\b/gi;
    const dropPolicyRe = /\bdrop\s+policy\s+(?:if\s+exists\s+)?(\"[^\"]+\"|\w+)\s+on\s+((?:"[^"]+"|\w+)(?:\.(?:"[^"]+"|\w+))?)/gi;
    const createPolicyStmtRe = /\bcreate\s+policy\b[\s\S]*?;/gi;
    const openUsingRe = /\busing\s*\(\s*true\s*\)/i;
    const openWithCheckRe = /\bwith\s+check\s*\(\s*true\s*\)/i;

    for (const { sql } of files) {
        const normalizedSql = stripSqlComments(sql);
        for (const match of normalizedSql.matchAll(createTableRe)) {
            const table = normalizeTableName(match[1]);
            if (table) activeTables.add(table);
        }
        for (const match of normalizedSql.matchAll(dropTableRe)) {
            const table = normalizeTableName(match[1]);
            if (!table) continue;
            activeTables.delete(table);
            // Dropping a table implicitly drops its policies; keep the static model in sync.
            for (const key of policies.keys()) {
                if (key.startsWith(`${table}|`)) policies.delete(key);
            }
        }
        for (const match of normalizedSql.matchAll(enableRlsRe)) {
            const table = normalizeTableName(match[1]);
            if (table) rlsEnabled.add(table);
        }
        for (const match of normalizedSql.matchAll(dropPolicyRe)) {
            const name = normalizeIdentifier(match[1]);
            const table = normalizeTableName(match[2]);
            if (!name || !table) continue;
            policies.delete(policyKey(table, name));
        }

        for (const match of normalizedSql.matchAll(createPolicyStmtRe)) {
            const stmt = match[0];
            const nameMatch = /\bcreate\s+policy\s+(\"[^\"]+\"|\w+)/i.exec(stmt);
            const onMatch = /\bon\s+((?:"[^"]+"|\w+)(?:\.(?:"[^"]+"|\w+))?)/i.exec(stmt);
            if (!nameMatch || !onMatch) continue;

            const name = normalizeIdentifier(nameMatch[1]);
            const table = normalizeTableName(onMatch[1]);
            if (!name || !table) continue;

            const roles = parsePolicyRoles(stmt);
            const open = openUsingRe.test(stmt) || openWithCheckRe.test(stmt);
            const serviceRoleOnly = roles.length > 0 && roles.every((r) => r === 'service_role');

            policies.set(policyKey(table, name), { table, open, serviceRoleOnly });
        }
    }

    const policyOnTable = new Set();
    const openPolicyOnTable = new Set();
    for (const pol of policies.values()) {
        policyOnTable.add(pol.table);
        if (pol.open && !pol.serviceRoleOnly) openPolicyOnTable.add(pol.table);
    }

    return { activeTables, rlsEnabled, policyOnTable, openPolicyOnTable };
}

function main() {
    const files = readAllMigrationSqlFiles();
    if (files.length === 0) {
        console.log('[rls-static] No migrations found; skipping.');
        process.exit(0);
    }

    const { activeTables, rlsEnabled, policyOnTable, openPolicyOnTable } = collectTablesAndRlsSignals(files);

    const tables = [...activeTables].sort();
    const withoutRls = tables.filter((t) => !rlsEnabled.has(t));
    const rlsWithoutPolicies = tables.filter((t) => rlsEnabled.has(t) && !policyOnTable.has(t));
    const openPolicies = tables.filter((t) => openPolicyOnTable.has(t));

    console.log(`[rls-static] Tables (active) created in migrations: ${tables.length}`);
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
