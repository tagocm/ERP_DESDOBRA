#!/usr/bin/env node
/**
 * Non-blocking "any" usage report.
 *
 * Goal: give visibility and help plan gradual reduction without breaking dev flow.
 *
 * Usage:
 *   node scripts/any-report.js
 */

const { execSync } = require('child_process')
const path = require('path')

const ROOT = path.join(__dirname, '..')

const TARGETS = [
    'app/actions',
    'app/api',
    'lib',
    'components',
]

function countAny(dir) {
    const cmd = `find ${dir} -type f \\( -name "*.ts" -o -name "*.tsx" \\) -exec grep -n ": any\\|as any" {} + | wc -l`
    const out = execSync(cmd, { encoding: 'utf-8', cwd: ROOT })
    return parseInt(out.trim(), 10)
}

console.log('🔎 any usage report (": any" or "as any")\n')

let total = 0
for (const dir of TARGETS) {
    try {
        const count = countAny(dir)
        total += count
        console.log(`- ${dir}: ${count}`)
    } catch (err) {
        console.log(`- ${dir}: (error) ${err.message}`)
    }
}

console.log(`\nTotal: ${total}\n`)

