import { describe, it, expect } from 'vitest'
import { hashToken, validateMobileToken } from '@/lib/mobile/auth'

// Simple mock for environment
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock-key'

describe('Mobile Auth', () => {
    it('should hash tokens consistently', () => {
        const token = 'mb_test_123'
        const hash = hashToken(token)
        expect(hash).toBeDefined()
        expect(hashToken(token)).toBe(hash)
    })

    it('should return null for invalid auth header format', async () => {
        expect(await validateMobileToken(null)).toBeNull()
        expect(await validateMobileToken('')).toBeNull()
        expect(await validateMobileToken('Basic abc')).toBeNull()
        expect(await validateMobileToken('Bearer ')).toBeNull()
    })

    it('should return null for tokens without mb_ prefix', async () => {
        expect(await validateMobileToken('Bearer invalid_token')).toBeNull()
    })
})
