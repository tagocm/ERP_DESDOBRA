import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function checkConstraints() {
    console.log('--- Checking Constraints for bom_byproduct_outputs ---')

    // We can't access information_schema directly with select * easily via JS client if restrictions apply,
    // but we can try an RPC or just try to guess.
    // Actually, we can try to "discover" the relationship by just querying without the hint and seeing if it works, 
    // or by catching the error.

    // 1. Try query WITHOUT hint
    console.log('1. Querying without explicit FK hint...')
    const { data, error } = await supabase.from('bom_byproduct_outputs')
        .select('*, item:items(name)')
        .limit(1)

    if (error) {
        console.log('Error without hint:', error.message)
        if (error.code === 'PGRST200') { // Ambiguous
            console.log('Ambiguous relationship. Need explicit FK.')
        }
    } else {
        console.log('Success without hint! The explicit hint in code is likely wrong or unnecessary.')
    }

    console.log('\n--- End ---')
}

checkConstraints()
