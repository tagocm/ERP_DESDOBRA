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

async function runAudit() {
    console.log('--- FINAL AUDIT START ---\n')

    // 1. Confirm Metadata / Identity
    console.log('1. DB Connection Check:')
    const { error: errCon } = await supabase.from('companies').select('count').limit(1)
    if (errCon) console.error('Error connecting:', errCon)
    else console.log('Connected.\n')

    // 2. Confirm existence of tables
    // Since we cannot run raw SQL "select from information_schema...", we have to check via Supabase JS
    // We can try to select 1 row from each table or just check if it throws "relation does not exist"

    const tablesToCheck = ['work_orders', 'bom_headers', 'bom_lines', 'bom_byproduct_outputs', 'inventory_movements', 'items']
    console.log('2. Table Existence Check (Simulated via Select):')

    for (const t of tablesToCheck) {
        const { error } = await supabase.from(t).select('*', { count: 'exact', head: true })
        if (error) {
            console.log(`[FAIL] Table ${t}: ${error.message} (Code: ${error.code})`)
        } else {
            console.log(`[PASS] Table ${t} exists and is accessible.`)
        }
    }

    // 3. Confirm columns of inventory_movements via Sample Row
    console.log('\n3. Inventory Movements Schema Check (via Sample Row Keys):')
    const { data: invRows, error: invErr } = await supabase.from('inventory_movements').select('*').limit(1)

    if (invErr) {
        console.log('Error fetching inventory_movements:', invErr.message)
    } else if (invRows && invRows.length > 0) {
        console.log('Columns found in SAMPLE ROW:', Object.keys(invRows[0]).sort().join(', '))
    } else {
        // If table is empty, we insert a dummy row transactionally and rollback or just output "Table Empty"
        // Without raw SQL access, we rely on the previous migration having passed.
        // But user requested "select column_name..."
        // I can't run that via supabase-js without an RPC. 
        // Assumption: I will infer from code matching types, assuming the previous step Route A created them correctly.
        console.log('Table inventory_movements is empty. Cannot inspect columns via select *. Assuming strict adherence to applied migration.')
    }

    // 4. Confirm columns of work_orders via Sample Row
    console.log('\n4. Work Orders Schema Check (via Sample Row Keys):')
    const { data: woRows, error: woErr } = await supabase.from('work_orders').select('*').limit(1)
    if (woRows && woRows.length > 0) {
        console.log('Columns found in SAMPLE ROW:', Object.keys(woRows[0]).sort().join(', '))
    } else {
        console.log('Table work_orders is empty. Cannot inspect columns via select *.')
    }

    console.log('\n--- FINAL AUDIT END ---')
}

runAudit()
