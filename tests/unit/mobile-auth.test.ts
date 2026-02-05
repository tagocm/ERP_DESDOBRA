import { describe, it, expect } from 'vitest'
import { extractMobileBearerToken, getMobileTokenHashFromHeader, hashToken } from '@/lib/mobile/auth'

describe('Mobile Auth', () => {
    it('should hash tokens consistently', () => {
        const token = 'mb_test_123'
        const hash = hashToken(token)
        expect(hash).toBeDefined()
        expect(hashToken(token)).toBe(hash)
    })

    it('should return null for invalid auth header format', () => {
        expect(extractMobileBearerToken(null)).toBeNull()
        expect(extractMobileBearerToken('')).toBeNull()
        expect(extractMobileBearerToken('Basic abc')).toBeNull()
        expect(extractMobileBearerToken('Bearer ')).toBeNull()
    })

    it('should return null for tokens without mb_ prefix', () => {
        expect(extractMobileBearerToken('Bearer invalid_token')).toBeNull()
        expect(getMobileTokenHashFromHeader('Bearer invalid_token')).toBeNull()
    })

    it('should hash token from Authorization header', () => {
        const header = 'Bearer mb_test_123'
        expect(getMobileTokenHashFromHeader(header)).toBe(hashToken('mb_test_123'))
    })
})
