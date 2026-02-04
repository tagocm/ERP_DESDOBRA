import { NextResponse } from "next/server";

/**
 * Blocks debug/test routes in production unless an explicit token is provided.
 *
 * Set `INTERNAL_API_TOKEN` in production and send it via `x-internal-token` header.
 * If `INTERNAL_API_TOKEN` is not set in production, routes are disabled (404).
 */
export function requireInternalApiAccess(request: Request) {
    const isProd = process.env.NODE_ENV === "production";
    if (!isProd) return null;

    const token = process.env.INTERNAL_API_TOKEN;
    if (!token) {
        return NextResponse.json({ error: "Not Found" }, { status: 404 });
    }

    const provided = request.headers.get("x-internal-token");
    if (!provided || provided !== token) {
        return NextResponse.json({ error: "Not Found" }, { status: 404 });
    }

    return null;
}

