#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const MIGRATIONS_DIR = path.join(process.cwd(), 'supabase', 'migrations');

function isMigrationFile(fileName) {
    return fileName.endsWith('.sql');
}

function parseVersion(fileName) {
    // Supports:
    // - 20260204120000_description.sql
    // - 20260204120000.sql
    const match = fileName.match(/^(\d{14})(?:_.+)?\.sql$/);
    return match ? match[1] : null;
}

function main() {
    if (!fs.existsSync(MIGRATIONS_DIR)) {
        console.log('[migrations] No supabase/migrations directory found; skipping.');
        process.exit(0);
    }

    const allFiles = fs.readdirSync(MIGRATIONS_DIR);
    const migrationFiles = allFiles.filter(isMigrationFile);

    const invalidNames = [];
    const versionsToFiles = new Map();

    for (const fileName of migrationFiles) {
        const version = parseVersion(fileName);
        if (!version) {
            invalidNames.push(fileName);
            continue;
        }

        const current = versionsToFiles.get(version) ?? [];
        current.push(fileName);
        versionsToFiles.set(version, current);
    }

    const duplicateVersions = [...versionsToFiles.entries()]
        .filter(([, files]) => files.length > 1)
        .sort(([a], [b]) => a.localeCompare(b));

    const sortedByFileName = migrationFiles.slice().sort((a, b) => a.localeCompare(b));
    const sortedByVersionThenName = migrationFiles.slice().sort((a, b) => {
        const va = parseVersion(a) ?? '';
        const vb = parseVersion(b) ?? '';
        if (va !== vb) return va.localeCompare(vb);
        return a.localeCompare(b);
    });
    const outOfOrder = sortedByFileName.join('\n') !== sortedByVersionThenName.join('\n');

    const maxVersion = [...versionsToFiles.keys()].sort().at(-1) ?? 'n/a';
    console.log(`[migrations] Found ${migrationFiles.length} .sql migrations. Latest: ${maxVersion}`);

    let ok = true;

    if (invalidNames.length > 0) {
        ok = false;
        console.error('[migrations] Invalid migration file names (expected 14-digit prefix):');
        for (const fileName of invalidNames.sort()) console.error(`- ${fileName}`);
    }

    if (duplicateVersions.length > 0) {
        ok = false;
        console.error('[migrations] Duplicate migration versions found:');
        for (const [version, files] of duplicateVersions) {
            console.error(`- ${version}: ${files.join(', ')}`);
        }
    }

    if (outOfOrder) {
        ok = false;
        console.error('[migrations] Migrations are not ordered by version prefix.');
        console.error('[migrations] Suggested order:');
        for (const fileName of sortedByVersionThenName) console.error(`- ${fileName}`);
    }

    if (!ok) process.exit(1);
}

main();

