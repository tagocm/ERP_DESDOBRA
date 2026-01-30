#!/usr/bin/env node
/**
 * Type Safety Budget Enforcer for app/actions
 * 
 * Purpose: Prevent regression of type safety in CORE business logic layer.
 * This script counts 'any' usage in app/actions and fails if it exceeds baseline.
 * 
 * Usage: node scripts/any-budget-actions.js
 * Exit codes:
 *   0 - Budget met (any count <= baseline)
 *   1 - Budget exceeded (regression detected)
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Baseline from 2026-01-30 audit
const BASELINE = 34;
const TARGET_DIR = 'app/actions';

console.log('🔍 Type Safety Budget Check for app/actions\n');

// Count any usage using grep
try {
    const grepCommand = `find ${TARGET_DIR} -type f \\( -name "*.ts" -o -name "*.tsx" \\) -exec grep -n ": any\\|as any" {} + | wc -l`;
    const output = execSync(grepCommand, { encoding: 'utf-8', cwd: path.join(__dirname, '..') });
    const currentCount = parseInt(output.trim(), 10);

    console.log(`📊 Current any count: ${currentCount}`);
    console.log(`📌 Baseline (max allowed): ${BASELINE}`);
    console.log(`📈 Delta: ${currentCount - BASELINE >= 0 ? '+' : ''}${currentCount - BASELINE}\n`);

    if (currentCount > BASELINE) {
        console.error(`❌ BUDGET EXCEEDED!`);
        console.error(`\nType safety has regressed in ${TARGET_DIR}.`);
        console.error(`Current: ${currentCount} | Allowed: ${BASELINE} | Excess: ${currentCount - BASELINE}`);
        console.error(`\nPlease remove 'any' usage before committing.`);
        console.error(`See docs/typing-plan.md for remediation strategies.\n`);
        process.exit(1);
    }

    if (currentCount < BASELINE) {
        console.log(`✅ EXCELLENT! You reduced any usage by ${BASELINE - currentCount} instances!`);
        console.log(`Consider updating BASELINE in this script to lock in the improvement.\n`);
    } else {
        console.log(`✅ Budget met. No regression detected.\n`);
    }

    process.exit(0);

} catch (error) {
    console.error('❌ Error running budget check:', error.message);
    process.exit(1);
}
