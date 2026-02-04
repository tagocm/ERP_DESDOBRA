import { createClient } from '@supabase/supabase-js'
import crypto from 'node:crypto'
import { logger } from '@/lib/logger'

/**
 * Hashes a raw token using SHA-256
 */
export function hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex')
}

/**
 * Validates a mobile API token from the Authorization header.
 * 
 * - Checks Bearer format
 * - Checks mb_ prefix
 * - Hashes and compares with mobile_api_tokens table
 * - Checks for active status and expiration
 * - Updates last_used_at on success
 * 
 * @returns company_id if valid, null otherwise
 */
export async function validateMobileToken(authHeader: string | null): Promise<string | null> {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null
    }

    const token = authHeader.substring(7)

    if (!token.startsWith('mb_')) {
        return null
    }

    const tokenHash = hashToken(token)

    // Using service role to look up tokens securely
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
        logger.error('[mobile-auth] Missing Supabase env vars for token validation')
        return null
    }

    const supabase = createClient(
        supabaseUrl,
        serviceRoleKey,
        {
            auth: { autoRefreshToken: false, persistSession: false }
        }
    )

    const now = new Date().toISOString()

    const { data: tokenData, error } = await supabase
        .from('mobile_api_tokens')
        .select('company_id, id')
        .eq('token_hash', tokenHash)
        .eq('is_active', true)
        .or(`expires_at.is.null,expires_at.gt.${now}`)
        .maybeSingle()

    if (error || !tokenData) {
        if (error) {
            logger.error('[mobile-auth] Token validation query failed', {
                code: error.code,
                message: error.message
            })
        }
        return null
    }

    // Update last_used_at asynchronously - don't block the request
    supabase
        .from('mobile_api_tokens')
        .update({ last_used_at: now })
        .eq('id', tokenData.id)
        .then(({ error: updateError }) => {
            if (updateError) {
                logger.warn('[mobile-auth] Failed to update last_used_at', {
                    code: updateError.code,
                    message: updateError.message
                })
            }
        })

    return tokenData.company_id
}
