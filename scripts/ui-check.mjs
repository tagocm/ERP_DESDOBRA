#!/usr/bin/env node

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// Configuration
const MODE = process.argv[2] || 'warn';
const SCAN_DIRS = ['app', 'components'];
const IGNORE_PATTERNS = [
    /components\/ui\//,
    /\.next\//,
    /node_modules\//,
    /dist\//,
    /build\//,
];

// Allowlist: Globally permitted patterns
const ALLOWED_GLOBAL = {
    rounded: ['rounded-full', 'rounded-2xl', 'rounded-none'],
    shadow: ['shadow-card', 'shadow-float', 'shadow-none'],
};

// Path-based exceptions
const PATH_EXCEPTIONS = {
    'rounded-none': [/tabs?/i, /navigation-menu/i, /segmented-control/i],
    'rounded-xl': [/kanban/i],
    // Arbitrary values allowed in overlay components (already in components/ui, but for clarity)
    'arbitrary': [/dialog/i, /popover/i, /dropdown/i, /select/i, /tooltip/i, /context-menu/i],
};

// Violation patterns
const RULES = {
    shadow: {
        pattern: /shadow-(xs|sm|md|lg|xl|2xl|inner|card|float)/g,
        description: 'Direct shadow-* usage (use shadow-card or shadow-float tokens)',
        checkAllowed: (match, filePath) => {
            if (ALLOWED_GLOBAL.shadow.includes(match)) return 'ALLOWED_GLOBAL';
            return 'REAL_VIOLATION';
        }
    },
    rounded: {
        pattern: /rounded-(none|sm|md|lg|xl|2xl|3xl|full|t-|r-|b-|l-|tl-|tr-|br-|bl-)/g,
        description: 'Direct rounded-* usage (use rounded-2xl for cards, rounded-lg for inputs)',
        checkAllowed: (match, filePath) => {
            if (ALLOWED_GLOBAL.rounded.includes(match)) return 'ALLOWED_GLOBAL';

            // Check path-based exceptions
            for (const [pattern, paths] of Object.entries(PATH_EXCEPTIONS)) {
                if (match === pattern || match.startsWith(pattern + '-')) {
                    if (paths.some(regex => regex.test(filePath))) {
                        return 'ALLOWED_BY_PATH';
                    }
                }
            }

            return 'REAL_VIOLATION';
        }
    },
    card_fake: {
        pattern: /<div[^>]*className=["'][^"']*(rounded|shadow|bg-white)[^"']*(rounded|shadow|bg-white)[^"']*["']/g,
        description: 'Fake Card detected (div with card-like classes). Use <Card> component.',
        checkAllowed: (match) => {
            // If it has at least two of these, it's probably a card attempt
            const hits = (match.match(/rounded|shadow|bg-white/g) || []).length;
            return hits >= 2 ? 'REAL_VIOLATION' : 'ALLOWED_GLOBAL';
        }
    },
    arbitrary: {
        pattern: /(p|gap|shadow|rounded|m|mx|my|mt|mb|ml|mr|w|h)-\[/g,
        description: 'Arbitrary Tailwind values [...] (use design tokens)',
        checkAllowed: (match, filePath) => {
            if (PATH_EXCEPTIONS.arbitrary.some(regex => regex.test(filePath))) {
                return 'ALLOWED_BY_PATH';
            }
            return 'REAL_VIOLATION';
        }
    },
};

// Statistics
const stats = {
    filesScanned: 0,
    violations: {},
};

Object.keys(RULES).forEach(key => {
    stats.violations[key] = {
        real: 0,
        allowedGlobal: 0,
        allowedByPath: 0,
        files: new Map(), // { filePath: [{ line, content, match, category }] }
    };
});

/**
 * Check if path should be ignored
 */
function shouldIgnore(path) {
    return IGNORE_PATTERNS.some(pattern => pattern.test(path));
}

/**
 * Scan a file for violations
 */
function scanFile(filePath) {
    const content = readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const relativePath = relative(rootDir, filePath);

    lines.forEach((line, index) => {
        Object.entries(RULES).forEach(([ruleKey, rule]) => {
            const matches = line.match(rule.pattern);
            if (matches) {
                matches.forEach(match => {
                    const category = rule.checkAllowed(match, relativePath);

                    if (!stats.violations[ruleKey].files.has(relativePath)) {
                        stats.violations[ruleKey].files.set(relativePath, []);
                    }

                    stats.violations[ruleKey].files.get(relativePath).push({
                        line: index + 1,
                        content: line.trim(),
                        match,
                        category,
                    });

                    // Increment category counters
                    if (category === 'REAL_VIOLATION') {
                        stats.violations[ruleKey].real++;
                    } else if (category === 'ALLOWED_GLOBAL') {
                        stats.violations[ruleKey].allowedGlobal++;
                    } else if (category === 'ALLOWED_BY_PATH') {
                        stats.violations[ruleKey].allowedByPath++;
                    }
                });
            }
        });
    });

    stats.filesScanned++;
}

/**
 * Recursively scan directory
 */
function scanDirectory(dir) {
    const entries = readdirSync(dir);

    entries.forEach(entry => {
        const fullPath = join(dir, entry);
        const relativePath = relative(rootDir, fullPath);

        if (shouldIgnore(relativePath)) {
            return;
        }

        const stat = statSync(fullPath);

        if (stat.isDirectory()) {
            scanDirectory(fullPath);
        } else if (stat.isFile() && /\.(ts|tsx)$/.test(entry)) {
            scanFile(fullPath);
        }
    });
}

/**
 * Print report
 */
function printReport() {
    const totalReal = Object.values(stats.violations).reduce((sum, v) => sum + v.real, 0);
    const totalAllowedGlobal = Object.values(stats.violations).reduce((sum, v) => sum + v.allowedGlobal, 0);
    const totalAllowedByPath = Object.values(stats.violations).reduce((sum, v) => sum + v.allowedByPath, 0);

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('📊 UI Design System Check Report');
    console.log('═══════════════════════════════════════════════════════\n');

    console.log(`Files scanned: ${stats.filesScanned}`);
    console.log(`Real violations: ${totalReal}`);
    console.log(`Allowed (global): ${totalAllowedGlobal}`);
    console.log(`Allowed (by path): ${totalAllowedByPath}\n`);

    // Real violations by rule
    console.log('🚨 Real Violations by Rule:');
    Object.entries(stats.violations).forEach(([key, data]) => {
        const icon = data.real > 0 ? '❌' : '✅';
        console.log(`  ${icon} ${key.padEnd(12)} ${data.real.toString().padStart(4)} - ${RULES[key].description}`);
    });

    // Allowed patterns summary
    console.log('\n✅ Allowed Patterns (not counted as violations):');
    Object.entries(stats.violations).forEach(([key, data]) => {
        const totalAllowed = data.allowedGlobal + data.allowedByPath;
        if (totalAllowed > 0) {
            console.log(`  ${key.padEnd(12)} ${totalAllowed.toString().padStart(4)} (${data.allowedGlobal} global, ${data.allowedByPath} by path)`);
        }
    });

    // Top violating files (REAL violations only)
    console.log('\n───────────────────────────────────────────────────────');
    console.log('Top 10 Files by Real Violations:\n');

    const fileRealViolationCounts = new Map();
    Object.values(stats.violations).forEach(ruleData => {
        ruleData.files.forEach((violations, file) => {
            const realCount = violations.filter(v => v.category === 'REAL_VIOLATION').length;
            if (realCount > 0) {
                fileRealViolationCounts.set(
                    file,
                    (fileRealViolationCounts.get(file) || 0) + realCount
                );
            }
        });
    });

    const topFiles = Array.from(fileRealViolationCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

    if (topFiles.length === 0) {
        console.log('  ✨ No files with real violations!');
    } else {
        topFiles.forEach(([file, count], index) => {
            console.log(`  ${(index + 1).toString().padStart(2)}. ${file.padEnd(60)} ${count} violations`);
        });
    }

    // Detailed violations
    console.log('\n───────────────────────────────────────────────────────');
    console.log('Real Violations (first 200):\n');

    let linesPrinted = 0;
    const MAX_REAL_LINES = 200;

    for (const [ruleKey, ruleData] of Object.entries(stats.violations)) {
        for (const [file, violations] of ruleData.files.entries()) {
            const realViolations = violations.filter(v => v.category === 'REAL_VIOLATION');
            for (const violation of realViolations) {
                if (linesPrinted >= MAX_REAL_LINES) break;

                console.log(`  ${file}:${violation.line}`);
                console.log(`    [${ruleKey}] ${violation.match}`);
                console.log(`    ${violation.content.substring(0, 80)}${violation.content.length > 80 ? '...' : ''}`);
                console.log('');

                linesPrinted++;
            }
            if (linesPrinted >= MAX_REAL_LINES) break;
        }
        if (linesPrinted >= MAX_REAL_LINES) break;
    }

    if (linesPrinted >= MAX_REAL_LINES) {
        console.log('  ... (truncated, showing first 200 real violations)');
    }

    // Allowed by path (for audit)
    console.log('\n───────────────────────────────────────────────────────');
    console.log('Allowed by Path (first 50, audit only):\n');

    let allowedPrinted = 0;
    const MAX_ALLOWED_LINES = 50;

    for (const [ruleKey, ruleData] of Object.entries(stats.violations)) {
        for (const [file, violations] of ruleData.files.entries()) {
            const allowedViolations = violations.filter(v => v.category === 'ALLOWED_BY_PATH');
            for (const violation of allowedViolations) {
                if (allowedPrinted >= MAX_ALLOWED_LINES) break;

                console.log(`  ${file}:${violation.line}`);
                console.log(`    [${ruleKey}] ${violation.match} (allowed by path exception)`);
                console.log('');

                allowedPrinted++;
            }
            if (allowedPrinted >= MAX_ALLOWED_LINES) break;
        }
        if (allowedPrinted >= MAX_ALLOWED_LINES) break;
    }

    if (allowedPrinted >= MAX_ALLOWED_LINES) {
        console.log('  ... (truncated)');
    } else if (allowedPrinted === 0) {
        console.log('  (none)');
    }

    console.log('\n═══════════════════════════════════════════════════════');

    // Final status
    if (MODE === 'strict') {
        if (totalReal > 0) {
            console.log(`❌ UI CHECK (STRICT): Failed - ${totalReal} real violations detected`);
            console.log('═══════════════════════════════════════════════════════\n');
            process.exit(1);
        } else {
            console.log('✅ UI CHECK (STRICT): Passed - no real violations');
            console.log('═══════════════════════════════════════════════════════\n');
            process.exit(0);
        }
    } else {
        if (totalReal > 0) {
            console.log(`⚠️  UI CHECK (WARN): ${totalReal} real violations found`);
            console.log(`   ${totalAllowedGlobal + totalAllowedByPath} patterns allowed by design system rules`);
            console.log('   Run "npm run ui:check:strict" to enforce these rules');
        } else {
            console.log('✅ UI CHECK (WARN): No real violations found!');
            console.log(`   ${totalAllowedGlobal + totalAllowedByPath} patterns allowed by design system rules`);
        }
        console.log('═══════════════════════════════════════════════════════\n');
        process.exit(0);
    }
}

// Main execution
console.log(`\n🔍 Scanning for UI violations (mode: ${MODE})...\n`);

SCAN_DIRS.forEach(dir => {
    const fullPath = join(rootDir, dir);
    try {
        scanDirectory(fullPath);
    } catch (err) {
        console.error(`Error scanning ${dir}:`, err.message);
    }
});

printReport();
