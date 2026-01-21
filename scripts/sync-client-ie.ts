#!/usr/bin/env tsx
/**
 * CLI tool to manually trigger SEFAZ IE lookup for an organization
 * 
 * Usage:
 *   npm run sync-client-ie -- --org-id=<uuid>
 *   npm run sync-client-ie -- --org-id=<uuid> --force
 *   CAD_DEBUG=1 npm run sync-client-ie -- --org-id=<uuid>
 */

import { backgroundIELookup } from '../lib/sefaz/backgroundIELookup';

async function main() {
    const args = process.argv.slice(2);

    // Parse arguments
    let orgId: string | undefined;
    let force = false;

    for (const arg of args) {
        if (arg.startsWith('--org-id=')) {
            orgId = arg.split('=')[1];
        } else if (arg === '--force') {
            force = true;
        }
    }

    if (!orgId) {
        console.error('Error: --org-id is required');
        console.log('\nUsage:');
        console.log('  npm run sync-client-ie -- --org-id=<uuid>');
        console.log('  npm run sync-client-ie -- --org-id=<uuid> --force');
        console.log('\nOptions:');
        console.log('  --org-id=<uuid>  Organization ID to lookup');
        console.log('  --force          Bypass 30-day cache');
        console.log('\nEnvironment:');
        console.log('  CAD_DEBUG=1      Enable debug logging');
        process.exit(1);
    }

    console.log('🔍 Starting SEFAZ IE Lookup...');
    console.log(`   Organization ID: ${orgId}`);
    console.log(`   Force refresh: ${force}`);
    console.log(`   Debug mode: ${process.env.CAD_DEBUG === '1'}\n`);

    const result = await backgroundIELookup(orgId, { force });

    console.log('\n📊 Result:');
    console.log(`   Success: ${result.success}`);
    if (result.cached) {
        console.log(`   ✓ Cache hit`);
    }
    if (result.ie) {
        console.log(`   ✓ IE: ${result.ie}`);
    }
    if (result.error) {
        console.log(`   ✗ Error: ${result.error}`);
    }

    process.exit(result.success ? 0 : 1);
}

main();
