import { describe, expect, it } from 'vitest'
import { SUPPLY_STATUSES, isSupplyStatus } from '@/lib/pcp/planning-service'

describe('planning supply statuses', () => {
  it('keeps only planned and in_progress as valid supply statuses', () => {
    const statuses: readonly string[] = SUPPLY_STATUSES
    expect(SUPPLY_STATUSES).toEqual(['planned', 'in_progress'])
    expect(statuses.includes('planned')).toBe(true)
    expect(statuses.includes('in_progress')).toBe(true)
    expect(statuses.includes('confirmed')).toBe(false)
  })

  it('validates status values through type guard', () => {
    expect(isSupplyStatus('planned')).toBe(true)
    expect(isSupplyStatus('in_progress')).toBe(true)
    expect(isSupplyStatus('confirmed')).toBe(false)
    expect(isSupplyStatus('done')).toBe(false)
  })
})
