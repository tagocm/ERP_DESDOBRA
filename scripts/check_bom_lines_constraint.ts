import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function checkBomLinesConstraints() {
    console.log('--- Checking Constraints for bom_lines ---')

    // Try to insert a duplicate to confirm the exact error
    const { data: item } = await supabase.from('items').select('id, company_id').limit(1).single()
    const { data: bom } = await supabase.from('bom_headers').select('id').limit(1).single()

    if (!item || !bom) {
        console.log('Not enough data to test.')
        return
    }

    console.log('Attempting duplicate insert...')
    // Clean up test data first
    await supabase.from('bom_lines').delete().eq('bom_id', bom.id).eq('component_item_id', item.id)

    const payload = {
        company_id: item.company_id,
        bom_id: bom.id,
        component_item_id: item.id,
        qty: 1,
        uom: 'UN',
        sort_order: 1
    }

    // Insert 1
    await supabase.from('bom_lines').insert(payload)

    // Insert 2 (Duplicate)
    const { error } = await supabase.from('bom_lines').insert(payload)

    if (error) {
        console.log('Error on duplicate:', error.message)
        console.log('Code:', error.code)
    } else {
        console.log('Duplicate insertion SUCCEEDED. No unique constraint?')
    }

    // Cleanup
    await supabase.from('bom_lines').delete().eq('bom_id', bom.id).eq('component_item_id', item.id)

    console.log('--- End ---')
}

checkBomLinesConstraints()
