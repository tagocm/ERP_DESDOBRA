import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

// Usage: npx tsx scripts/mobile/generate-token.ts <company_id> <name>
// Example: npx tsx scripts/mobile/generate-token.ts "martigran" "iPhone Tago"

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ Missing environment variables')
    process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function generateToken() {
    const companyId = process.argv[2]
    const name = process.argv[3] || 'Default Mobile Device'

    if (!companyId) {
        console.error('❌ Missing company_id')
        process.exit(1)
    }

    // 1. Generate a random secure token
    const rawToken = `mb_${crypto.randomBytes(32).toString('hex')}`

    // 2. Hash it for storage
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')

    // 3. Save to database
    const { data, error } = await supabase
        .from('mobile_api_tokens')
        .insert({
            company_id: companyId,
            name: name,
            token_hash: tokenHash,
            is_active: true
        })
        .select()

    if (error) {
        console.error('❌ Error saving token:', error.message)
        process.exit(1)
    }

    console.log('\n✅ Mobile API Token Generated Successfully!')
    console.log('-------------------------------------------')
    console.log(`Company ID: ${companyId}`)
    console.log(`Device Name: ${name}`)
    console.log(`\nRAW TOKEN (Copy this now, it won't be shown again!):`)
    console.log(`\x1b[32m${rawToken}\x1b[0m`)
    console.log('-------------------------------------------\n')
}

generateToken()
