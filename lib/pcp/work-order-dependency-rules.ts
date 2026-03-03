const EPSILON = 1e-9

export interface DependencyBatchPlan {
  missingQty: number
  effectiveYield: number
  suggestedBatches: number
  plannedQty: number
}

function assertPositive(value: number, fieldName: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${fieldName} deve ser maior que zero.`)
  }
}

export function computeRequiredComponentQty(
  parentPlannedQty: number,
  componentQtyPerBom: number,
  parentBomYieldQty: number
): number {
  assertPositive(parentPlannedQty, 'Quantidade planejada da OP')
  assertPositive(componentQtyPerBom, 'Quantidade do componente na receita')
  assertPositive(parentBomYieldQty, 'Rendimento da receita principal')

  return (parentPlannedQty / parentBomYieldQty) * componentQtyPerBom
}

export function computeEffectiveYield(yieldQty: number, lossPercent: number | null): number {
  assertPositive(yieldQty, 'Rendimento da receita')

  const sanitizedLoss = Math.max(0, Math.min(100, Number(lossPercent ?? 0)))
  const effectiveYield = yieldQty * (1 - sanitizedLoss / 100)

  if (effectiveYield <= EPSILON) {
    throw new Error('Rendimento efetivo invalido. Verifique rendimento e perda da receita.')
  }

  return effectiveYield
}

export function computeDependencyBatchPlan(params: {
  requiredQty: number
  availableQty: number
  yieldQty: number
  lossPercent: number | null
}): DependencyBatchPlan {
  const requiredQty = Number(params.requiredQty)
  const availableQty = Number(params.availableQty)
  const missingQty = Math.max(0, requiredQty - availableQty)

  if (missingQty <= EPSILON) {
    return {
      missingQty,
      effectiveYield: computeEffectiveYield(params.yieldQty, params.lossPercent),
      suggestedBatches: 0,
      plannedQty: 0,
    }
  }

  const effectiveYield = computeEffectiveYield(params.yieldQty, params.lossPercent)
  const suggestedBatches = Math.ceil(missingQty / effectiveYield)
  const plannedQty = suggestedBatches * params.yieldQty

  return {
    missingQty,
    effectiveYield,
    suggestedBatches,
    plannedQty,
  }
}

export function isPositive(value: number): boolean {
  return Number.isFinite(value) && value > EPSILON
}
