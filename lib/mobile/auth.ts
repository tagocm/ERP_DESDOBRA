import crypto from 'node:crypto'

/**
 * Hashes a raw token using SHA-256
 */
export function hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex')
}

/**
 * Extracts a mobile bearer token (mb_*) from the Authorization header.
 */
export function extractMobileBearerToken(authHeader: string | null): string | null {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null
    }

    const token = authHeader.substring(7).trim()

    if (!token.startsWith('mb_')) {
        return null
    }

    return token
}

/**
 * Extracts and hashes a mobile bearer token from the Authorization header.
 * (DB validation is performed server-side via RPC in the mobile API routes.)
 */
export function getMobileTokenHashFromHeader(authHeader: string | null): string | null {
    const token = extractMobileBearerToken(authHeader)
    if (!token) return null
    return hashToken(token)
}
