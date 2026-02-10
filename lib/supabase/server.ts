import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { createAdminClient } from "./admin"
import { SupabaseClient } from "@supabase/supabase-js"
import { Database } from "@/types/supabase"

export async function createClient() {
    const cookieStore = await cookies()

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!url || !key) {
        throw new Error("Supabase environment variables are missing (URL or ANON_KEY)")
    }

    return createServerClient(url, key, {
        cookies: {
            getAll() {
                return cookieStore.getAll()
            },
            setAll(cookiesToSet) {
                try {
                    cookiesToSet.forEach(({ name, value, options }) =>
                        cookieStore.set(name, value, options)
                    )
                } catch {
                    // The `setAll` method was called from a Server Component.
                    // This can be ignored if you have middleware refreshing
                    // user sessions.
                }
            },
        },
    })
}

// Legacy support for lib/data/* using Service Role Client (Admin)
// This is used for background tasks and data access layers that bypass RLS or don't have user session
export const supabaseServer = new Proxy({} as SupabaseClient<Database>, {
    get(target, prop, receiver) {
        const instance = createAdminClient()
        const value = Reflect.get(instance, prop, receiver)
        if (typeof value === 'function') {
            return value.bind(instance)
        }
        return value
    }
})
