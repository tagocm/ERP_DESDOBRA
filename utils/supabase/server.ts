
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
    const cookieStore = await cookies();

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    // During build or CI, if env vars are missing, we use dummies to prevent the factory from throwing.
    // This allows the Next.js build to complete prerendering.
    if (!url || !anonKey) {
        if (process.env.CI === 'true') {
            return createServerClient(
                "https://dummy-project.supabase.co",
                "dummy-key",
                {
                    cookies: {
                        getAll: () => [],
                        setAll: () => { }
                    }
                }
            );
        }
        throw new Error('Supabase environment variables are missing (URL or ANON_KEY)');
    }

    return createServerClient(
        url,
        anonKey,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll();
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        );
                    } catch {
                        // The `setAll` method was called from a Server Component.
                        // This can be ignored if you have middleware refreshing
                        // user sessions.
                    }
                },
            },
        }
    );
}
