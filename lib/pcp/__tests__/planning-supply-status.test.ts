import { describe, expect, it } from 'vitest'
import { SUPPLY_STATUSES, isSupplyStatus, resolveSupplyAvailabilityDate } from '@/lib/pcp/planning-service'

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

  it('shifts planned and in-progress supply availability to next day', () => {
    expect(resolveSupplyAvailabilityDate('2026-03-04', 'planned')).toBe('2026-03-05')
    expect(resolveSupplyAvailabilityDate('2026-03-04', 'in_progress')).toBe('2026-03-05')
  })
})
