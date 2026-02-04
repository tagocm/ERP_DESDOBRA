
import { createBrowserClient } from '@supabase/ssr'

export const createClient = () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!url || !anonKey) {
        if (process.env.CI === 'true') {
            return createBrowserClient(
                "https://dummy-project.supabase.co",
                "dummy-key"
            )
        }
        throw new Error('Supabase environment variables are missing (URL or ANON_KEY)')
    }

    return createBrowserClient(url, anonKey)
}
