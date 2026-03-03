export function calculateRecipeCount(plannedQty: number, yieldQty: number | null | undefined): number | null {
  if (!Number.isFinite(plannedQty) || plannedQty <= 0) {
    return null
  }

  if (yieldQty === null || yieldQty === undefined || !Number.isFinite(yieldQty) || yieldQty <= 0) {
    return null
  }

  return Math.ceil(plannedQty / yieldQty)
}

export function formatRecipeCountLabel(recipeCount: number | null): string {
  if (recipeCount === null) {
    return 'Sem rendimento'
  }

  return `${recipeCount} receita${recipeCount === 1 ? '' : 's'}`
}
