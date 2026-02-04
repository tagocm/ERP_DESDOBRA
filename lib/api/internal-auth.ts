import crypto from 'node:crypto'

function extractToken(request: Request): string | null {
    const authHeader = request.headers.get('authorization')
    if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7)
    return request.headers.get('x-internal-token')
}

function timingSafeEquals(a: string, b: string) {
    const aBuf = Buffer.from(a)
    const bBuf = Buffer.from(b)
    if (aBuf.length !== bBuf.length) return false
    return crypto.timingSafeEqual(aBuf, bBuf)
}

export function isInternalAuthorized(request: Request): boolean {
    const expected = process.env.INTERNAL_API_TOKEN
    if (!expected) return process.env.NODE_ENV !== 'production'

    const received = extractToken(request)
    if (!received) return false

    return timingSafeEquals(received, expected)
}

