import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

function applySecurityHeaders(response: NextResponse, request: NextRequest) {
    const enabled =
        process.env.SECURITY_HEADERS === "true" || process.env.NODE_ENV === "production";
    if (!enabled) return;

    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    response.headers.set("X-Frame-Options", "SAMEORIGIN");
    response.headers.set("Content-Security-Policy", "frame-ancestors 'self';");

    const forwardedProto = request.headers.get("x-forwarded-proto");
    const isHttps = forwardedProto === "https" || request.nextUrl.protocol === "https:";
    if (isHttps) {
        response.headers.set(
            "Strict-Transport-Security",
            "max-age=15552000; includeSubDomains"
        );
    }
}

export async function proxy(request: NextRequest) {
    // STRICT ENV VAR CHECK - Fail fast if missing
    if (
        !process.env.NEXT_PUBLIC_SUPABASE_URL ||
        !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ) {
        throw new Error("Supabase environment variables are missing (URL or ANON_KEY)");
    }

    let response = NextResponse.next({
        request: {
            headers: request.headers,
        },
    });

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) =>
                        request.cookies.set(name, value)
                    );
                    response = NextResponse.next({
                        request,
                    });
                    cookiesToSet.forEach(({ name, value, options }) =>
                        response.cookies.set(name, value, options)
                    );
                },
            },
        }
    );

    try {
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (request.nextUrl.pathname.startsWith("/app") && !user) {
            const redirectResponse = NextResponse.redirect(new URL("/login", request.url));
            applySecurityHeaders(redirectResponse, request);
            return redirectResponse;
        }
    } catch {
        // Error handling can be added here if needed
    }

    applySecurityHeaders(response, request);
    return response;
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * Feel free to modify this pattern to include more paths.
         */
        "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    ],
};
