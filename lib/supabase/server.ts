import 'server-only'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/supabase'

let _instance: SupabaseClient<Database> | null = null

export function getSupabaseServer() {
    if (_instance) return _instance

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceRoleKey) {
        throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for server client')
    }

    _instance = createClient<Database>(supabaseUrl, supabaseServiceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    })
    return _instance
}

export const supabaseServer = new Proxy({} as SupabaseClient<Database>, {
    get(target, prop, receiver) {
        // Redirect all property access to the lazy-initialized instance
        const instance = getSupabaseServer()
        const value = Reflect.get(instance, prop, receiver)
        if (typeof value === 'function') {
            return value.bind(instance)
        }
        return value
    }
})
