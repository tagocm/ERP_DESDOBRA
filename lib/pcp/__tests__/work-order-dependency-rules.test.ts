import { describe, expect, it } from 'vitest'
import {
  computeDependencyBatchPlan,
  computeEffectiveYield,
} from '@/lib/pcp/work-order-dependency-rules'
import { computeDependencyPreviewRow } from '@/lib/pcp/work-order-dependencies-service'

describe('pcp dependency batch rules', () => {
  it('applies ceil by effective yield and keeps planned child qty in whole recipes', () => {
    const plan = computeDependencyBatchPlan({
      requiredQty: 100,
      availableQty: 10,
      yieldQty: 50,
      lossPercent: 10,
    })

    expect(plan.missingQty).toBe(90)
    expect(plan.effectiveYield).toBe(45)
    expect(plan.suggestedBatches).toBe(2)
    expect(plan.plannedQty).toBe(100)
  })

  it('throws when yield is missing/invalid', () => {
    expect(() => computeEffectiveYield(0, 0)).toThrow(/Rendimento da receita deve ser maior que zero/i)
  })

  it('computes service-level dependency suggestion with whole recipes for missing WIP', () => {
    const row = computeDependencyPreviewRow({
      componentItemId: 'wip-1',
      componentName: 'Granola Tradicional a Granel',
      componentUom: 'Kg',
      plannedQty: 1000,
      parentBomYieldQty: 1000,
      lineQty: 800,
      availableQty: 210,
      childBomId: 'bom-wip-1',
      childYieldQty: 120,
      childYieldUom: 'Kg',
      lossPercent: 5,
      suggestedSectorId: 'sector-prod',
      suggestedSectorName: 'PRODUÇÃO DE GRANOLA',
    })

    expect(row).not.toBeNull()
    expect(row?.requiredQty).toBe(800)
    expect(row?.missingQty).toBe(590)
    expect(row?.effectiveYield).toBe(114)
    expect(row?.suggestedBatches).toBe(6)
    expect(row?.suggestedPlannedQty).toBe(720)
  })
})
