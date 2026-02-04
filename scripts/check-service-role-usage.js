#!/usr/bin/env node

/**
 * Non-blocking audit: find usage of Supabase service role / admin client in user-entrypoints.
 *
 * Why:
 * - `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS; using it in request paths increases blast radius.
 *
 * Scope (by default):
 * - `app/api/**`
 * - `app/actions/**`
 *
 * Usage:
 *   node scripts/check-service-role-usage.js
 *   node scripts/check-service-role-usage.js --strict
 *
 * Exit codes:
 *   0 = ok (or findings in non-strict mode)
 *   1 = findings (strict mode)
 */

const fs = require('node:fs');
const path = require('node:path');

const STRICT = process.argv.includes('--strict') || process.env.CI_STRICT_SERVICE_ROLE === 'true';

const TARGET_DIRS = [path.join('app', 'api'), path.join('app', 'actions')];
const TARGET_EXT = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs']);

const PATTERNS = [
    { name: 'SUPABASE_SERVICE_ROLE_KEY', re: /\bSUPABASE_SERVICE_ROLE_KEY\b/ },
    { name: 'createAdminClient()', re: /\bcreateAdminClient\s*\(/ },
];

function isTargetFile(filePath) {
    return TARGET_EXT.has(path.extname(filePath));
}

function listFilesRecursive(relativeDir) {
    const absoluteDir = path.join(process.cwd(), relativeDir);
    if (!fs.existsSync(absoluteDir)) return [];

    const out = [];
    const stack = [absoluteDir];

    while (stack.length > 0) {
        const current = stack.pop();
        if (!current) continue;
        const entries = fs.readdirSync(current, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(current, entry.name);
            if (entry.isDirectory()) {
                stack.push(fullPath);
                continue;
            }
            if (!entry.isFile()) continue;
            const relPath = path.relative(process.cwd(), fullPath);
            if (isTargetFile(relPath)) out.push(relPath);
        }
    }

    return out.sort();
}

function ghaWarning({ file, line, message }) {
    const safeMessage = message.replaceAll('\n', ' ').slice(0, 400);
    if (process.env.GITHUB_ACTIONS) {
        console.log(`::warning file=${file},line=${line}::${safeMessage}`);
        return;
    }
    console.warn(`[service-role-usage] ${file}:${line} ${safeMessage}`);
}

function scanFile(file) {
    const text = fs.readFileSync(path.join(process.cwd(), file), 'utf8');
    const lines = text.split('\n');

    const findings = [];
    for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i];
        for (const { name, re } of PATTERNS) {
            if (!re.test(line)) continue;
            findings.push({ file, line: i + 1, pattern: name });
        }
    }
    return findings;
}

function main() {
    const files = TARGET_DIRS.flatMap(listFilesRecursive);
    if (files.length === 0) {
        console.log('[service-role-usage] No target files found; skipping.');
        process.exit(0);
    }

    const findings = [];
    for (const file of files) findings.push(...scanFile(file));

    if (findings.length === 0) {
        console.log('[service-role-usage] No service-role/admin usage found in app/api or app/actions.');
        process.exit(0);
    }

    console.log(`[service-role-usage] Findings: ${findings.length}`);
    for (const f of findings) {
        ghaWarning({
            file: f.file,
            line: f.line,
            message: `Found ${f.pattern}. Prefer session/RLS client or move privileged work to trusted backend path.`,
        });
    }

    process.exit(STRICT ? 1 : 0);
}

main();

