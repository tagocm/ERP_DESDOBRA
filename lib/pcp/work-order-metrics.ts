export type DecimalLike = number | string

export interface RecipeCountWithFallbackInput {
  plannedQty: DecimalLike
  bomYieldQty?: DecimalLike | null
  profileBatchSize?: DecimalLike | null
}

export type RecipeCountWithFallbackResult =
  | { kind: 'unknown' }
  | { kind: 'bom_yield'; recipes: number; yieldQty: number }
  | { kind: 'profile_batch'; recipes: number; batchSize: number }

export interface CapacityStateInput {
  plannedRecipesKnown: number
  capacityRecipes: number | null
  indeterminateCount: number
}

export type CapacityState = 'OK' | 'NEAR_LIMIT' | 'EXCEEDED' | 'PARTIAL'

export interface CapacityStateResult {
  state: CapacityState
  percent: number | null
}

function toFinitePositiveNumber(value: DecimalLike | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null
  }

  const numeric = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null
  }

  return numeric
}

export function computeRecipeCountWithFallback(input: RecipeCountWithFallbackInput): RecipeCountWithFallbackResult {
  const plannedQty = toFinitePositiveNumber(input.plannedQty)
  if (!plannedQty) {
    return { kind: 'unknown' }
  }

  const bomYieldQty = toFinitePositiveNumber(input.bomYieldQty)
  if (bomYieldQty) {
    return {
      kind: 'bom_yield',
      recipes: Math.ceil(plannedQty / bomYieldQty),
      yieldQty: bomYieldQty,
    }
  }

  const profileBatchSize = toFinitePositiveNumber(input.profileBatchSize)
  if (profileBatchSize) {
    return {
      kind: 'profile_batch',
      recipes: Math.ceil(plannedQty / profileBatchSize),
      batchSize: profileBatchSize,
    }
  }

  return { kind: 'unknown' }
}

export function calculateRecipeCount(plannedQty: number, yieldQty: number | null | undefined): number | null {
  const result = computeRecipeCountWithFallback({
    plannedQty,
    bomYieldQty: yieldQty,
  })

  return result.kind === 'unknown' ? null : result.recipes
}

export function formatRecipeCountLabel(recipeCount: number | null): string {
  if (recipeCount === null) {
    return 'Sem rendimento'
  }

  return `${recipeCount} receita${recipeCount === 1 ? '' : 's'}`
}

export function computeCapacityState(input: CapacityStateInput): CapacityStateResult {
  if (input.indeterminateCount > 0) {
    const percent =
      input.capacityRecipes && input.capacityRecipes > 0 ? input.plannedRecipesKnown / input.capacityRecipes : null

    return {
      state: 'PARTIAL',
      percent,
    }
  }

  const capacityRecipes = input.capacityRecipes
  if (!capacityRecipes || capacityRecipes <= 0) {
    return {
      state: 'PARTIAL',
      percent: null,
    }
  }

  const percent = input.plannedRecipesKnown / capacityRecipes
  if (percent > 1) {
    return { state: 'EXCEEDED', percent }
  }
  if (percent > 0.9) {
    return { state: 'NEAR_LIMIT', percent }
  }

  return { state: 'OK', percent }
}
