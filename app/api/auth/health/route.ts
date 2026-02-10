import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function hasRequiredSupabaseEnv() {
    return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
        Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export async function GET() {
    const hasEnv = hasRequiredSupabaseEnv();

    if (!hasEnv) {
        return NextResponse.json(
            {
                ok: false,
                provider: "supabase",
                env: {
                    NEXT_PUBLIC_SUPABASE_URL: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
                    NEXT_PUBLIC_SUPABASE_ANON_KEY: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
                },
                error: "Supabase env ausente no runtime do servidor.",
            },
            { status: 503 },
        );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
    const authHealthUrl = `${supabaseUrl.replace(/\/+$/, "")}/auth/v1/health`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
        const response = await fetch(authHealthUrl, {
            method: "GET",
            headers: { apikey: anonKey },
            cache: "no-store",
            signal: controller.signal,
        });

        if (!response.ok) {
            console.error("[api/auth/health] Supabase auth probe failed", {
                status: response.status,
                statusText: response.statusText,
            });
            return NextResponse.json(
                {
                    ok: false,
                    provider: "supabase",
                    env: {
                        NEXT_PUBLIC_SUPABASE_URL: true,
                        NEXT_PUBLIC_SUPABASE_ANON_KEY: true,
                    },
                    upstream: {
                        status: response.status,
                        statusText: response.statusText,
                    },
                    error: "Supabase Auth indisponível.",
                },
                { status: 503 },
            );
        }

        return NextResponse.json({
            ok: true,
            provider: "supabase",
            env: {
                NEXT_PUBLIC_SUPABASE_URL: true,
                NEXT_PUBLIC_SUPABASE_ANON_KEY: true,
            },
            upstream: {
                status: response.status,
                statusText: response.statusText,
            },
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "unknown_error";
        console.error("[api/auth/health] Supabase auth probe exception", { message });
        return NextResponse.json(
            {
                ok: false,
                provider: "supabase",
                env: {
                    NEXT_PUBLIC_SUPABASE_URL: true,
                    NEXT_PUBLIC_SUPABASE_ANON_KEY: true,
                },
                error: "Falha de conectividade com Supabase Auth.",
                details: message,
            },
            { status: 503 },
        );
    } finally {
        clearTimeout(timeout);
    }
}
