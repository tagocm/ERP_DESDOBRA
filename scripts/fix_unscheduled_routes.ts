
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.error('Missing Supabase environment variables')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

const routesToUpdate = [
    'Sorocaba2',
    'Sorocaba1',
    'dale',
    'VAMOSVER',
    'TERCA',
    'NOVA3',
    'ixx',
    'HORA',
    'Nova1',
    'Bras'
]

async function main() {
    console.log(`Updating ${routesToUpdate.length} routes to 'concluida'...`)

    for (const routeName of routesToUpdate) {
        const { data: routes, error: searchError } = await supabase
            .from('delivery_routes')
            .select('id, name, status')
            .ilike('name', routeName)

        if (searchError) {
            console.error(`Error searching for route '${routeName}':`, searchError.message)
            continue
        }

        if (!routes || routes.length === 0) {
            console.warn(`Route '${routeName}' not found.`)
            continue
        }

        // Update all matching routes (might have duplicates if names aren't unique, but usually they are distinct enough contextually)
        for (const route of routes) {
            if (route.status === 'concluida') {
                console.log(`Route '${routeName}' (ID: ${route.id}) is already concluded. Skipping.`)
                continue
            }

            const { error: updateError } = await supabase
                .from('delivery_routes')
                .update({ status: 'concluida' })
                .eq('id', route.id)

            if (updateError) {
                console.error(`Failed to update route '${routeName}' (ID: ${route.id}):`, updateError.message)
            } else {
                console.log(`Successfully updated route '${routeName}' (ID: ${route.id}) to 'concluida'.`)
            }
        }
    }

    console.log('Update complete.')
}

main().catch(console.error)
