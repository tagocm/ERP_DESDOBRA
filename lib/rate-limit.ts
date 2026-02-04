type RateLimitConfig = {
    key: string;
    limit?: number;
    windowMs?: number;
};

type RateLimitResult = {
    ok: boolean;
    remaining: number;
    resetAt: number;
};

const buckets = new Map<string, { count: number; resetAt: number }>();

function getClientIp(request: Request): string {
    const forwarded = request.headers.get("x-forwarded-for");
    if (forwarded) {
        return forwarded.split(",")[0]?.trim() || "unknown";
    }
    return request.headers.get("x-real-ip") || "unknown";
}

export function rateLimit(request: Request, config: RateLimitConfig): RateLimitResult {
    const limit = config.limit ?? 30;
    const windowMs = config.windowMs ?? 60_000;

    const ip = getClientIp(request);
    const bucketKey = `${config.key}:${ip}`;
    const now = Date.now();

    const current = buckets.get(bucketKey);
    if (!current || now > current.resetAt) {
        const resetAt = now + windowMs;
        buckets.set(bucketKey, { count: 1, resetAt });
        return { ok: true, remaining: limit - 1, resetAt };
    }

    if (current.count >= limit) {
        return { ok: false, remaining: 0, resetAt: current.resetAt };
    }

    current.count += 1;
    return { ok: true, remaining: limit - current.count, resetAt: current.resetAt };
}
