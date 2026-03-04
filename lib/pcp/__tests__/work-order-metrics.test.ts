import { describe, expect, it } from 'vitest'
import { computeCapacityState, computeRecipeCountWithFallback } from '@/lib/pcp/work-order-metrics'

describe('work order metrics', () => {
  it('computes recipes using bom yield when available', () => {
    const result = computeRecipeCountWithFallback({
      plannedQty: 101,
      bomYieldQty: 25,
      profileBatchSize: 10,
    })

    expect(result).toEqual({
      kind: 'bom_yield',
      recipes: 5,
      yieldQty: 25,
    })
  })

  it('falls back to production profile batch size when bom yield is missing', () => {
    const result = computeRecipeCountWithFallback({
      plannedQty: 101,
      bomYieldQty: null,
      profileBatchSize: 20,
    })

    expect(result).toEqual({
      kind: 'profile_batch',
      recipes: 6,
      batchSize: 20,
    })
  })

  it('marks recipe count as unknown when there is no valid divisor', () => {
    const result = computeRecipeCountWithFallback({
      plannedQty: 50,
      bomYieldQty: null,
      profileBatchSize: null,
    })

    expect(result).toEqual({ kind: 'unknown' })
  })

  it('returns exceeded state when known load is over capacity', () => {
    const state = computeCapacityState({
      plannedRecipesKnown: 12,
      capacityRecipes: 10,
      indeterminateCount: 0,
    })

    expect(state.state).toBe('EXCEEDED')
    expect(state.percent).toBeCloseTo(1.2)
  })

  it('returns partial state when there are indeterminate cards', () => {
    const state = computeCapacityState({
      plannedRecipesKnown: 8,
      capacityRecipes: 10,
      indeterminateCount: 2,
    })

    expect(state.state).toBe('PARTIAL')
    expect(state.percent).toBeCloseTo(0.8)
  })
})

