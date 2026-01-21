import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkDuplicateBoms() {
    console.log('--- Checking for Duplicate BOM Headers ---')

    const { data: boms, error } = await supabase
        .from('bom_headers')
        .select('id, item_id, is_active, created_at')
        .eq('is_active', true)

    if (error) {
        console.error('Error fetching boms:', error)
        return
    }

    const map = new Map<string, any[]>()

    boms.forEach(b => {
        if (!map.has(b.item_id)) map.set(b.item_id, [])
        map.get(b.item_id)?.push(b)
    })

    let foundDupe = false
    map.forEach((list, itemId) => {
        if (list.length > 1) {
            foundDupe = true
            console.log(`\nDUPLICATE FOUND for item_id: ${itemId}`)
            list.forEach(b => console.log(` - ID: ${b.id} Created: ${b.created_at}`))
        }
    })

    if (!foundDupe) console.log('No duplicates found.')

    console.log('--- End Check ---')
}

checkDuplicateBoms()
