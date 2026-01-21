import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY // Use service key for admin access

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials in .env.local')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function runAudit() {
    console.log('--- AUDIT START ---\n')

    // 1. Confirm session/context (simulated via service role)
    console.log('1. Connection Check:')
    const { data: connectionData, error: connectionError } = await supabase.from('companies').select('count').limit(1)
    if (connectionError) {
        console.error('Failed to connect:', connectionError.message)
        return
    }
    console.log('Connected to DB. Companies count check passed.\n')

    // 2. Prove columns in inventory_movements
    console.log('2. Columns in inventory_movements:')
    // We can't query information_schema directly via JS client usually unless we use rpc or if exposed (rare).
    // BUT we can use a trick: inspect a select result or use a known RPC if exists.
    // Actually, the user wants "Run and register results" of specific SQL queries.
    // Since I don't have direct SQL access tool, I have to assume I can't run "select from information_schema" easily 
    // without a "raw sql" RPC or similar.
    // HOWEVER, I can infer keys by selecting a row.

    // UPDATE: I will try to use the 'read_terminal' tool output from `npm run dev` to see if I can inject a query? No.
    // Best bet: Try `npx supabase db execute` if I can.
    // But maybe the user HAS an rpc for sql? 
    // Let's try to find an RPC for SQL execution or just try to select one row from inventory_movements.

    const { data: movements, error: movError } = await supabase
        .from('inventory_movements')
        .select('*')
        .limit(1)

    if (movError) {
        console.error('Error querying inventory_movements:', movError.message)
    } else if (movements && movements.length > 0) {
        console.log('Found row:', Object.keys(movements[0]))
    } else {
        console.log('Table inventory_movements exists but is empty. Cannot verify columns precisely via JS select * without a row, but no error means table exists.')
    }
    console.log('\n')

    // 3. Prove tables existence (work_orders, bom, etc)
    console.log('3. Checking Tables Existence:')
    const tables = ['work_orders', 'bom_headers', 'bom_lines', 'bom_byproduct_outputs', 'inventory_movements', 'items']

    for (const table of tables) {
        const { error } = await supabase.from(table).select('count', { count: 'exact', head: true })
        if (error) {
            console.log(`[FAIL] Table '${table}' access error:`, error.message)
        } else {
            console.log(`[PASS] Table '${table}' exists.`)
        }
    }
    console.log('\n')

    console.log('--- AUDIT END ---')
}

runAudit()
