import { RecipeCountWithFallbackResult } from '@/lib/pcp/work-order-metrics'

export interface OverflowOrderInput {
  id: string
  scheduledDate: string | null
  documentNumber: number | null
  createdAt: string
  plannedQty: number
  recipeMetrics: RecipeCountWithFallbackResult
}

export interface OverflowDisplayCard {
  cardId: string
  orderId: string
  scheduledDate: string
  allocatedPlannedQty: number
  allocatedRecipes: number | null
  totalRecipes: number | null
  segmentIndex: number
  isSplit: boolean
  startsFromPreviousDay: boolean
  continuesToNextDay: boolean
}

function emissionSortKey(order: Pick<OverflowOrderInput, 'documentNumber' | 'createdAt'>): string {
  const documentPart = order.documentNumber === null ? '999999999' : String(order.documentNumber).padStart(9, '0')
  return `${documentPart}::${order.createdAt}`
}

function roundToFour(value: number): number {
  return Math.round(value * 10000) / 10000
}

function buildSingleCard(order: OverflowOrderInput, scheduledDate: string): OverflowDisplayCard {
  const recipes = order.recipeMetrics.kind === 'unknown' ? null : order.recipeMetrics.recipes
  return {
    cardId: `${order.id}::segment::0`,
    orderId: order.id,
    scheduledDate,
    allocatedPlannedQty: order.plannedQty,
    allocatedRecipes: recipes,
    totalRecipes: recipes,
    segmentIndex: 0,
    isSplit: false,
    startsFromPreviousDay: false,
    continuesToNextDay: false,
  }
}

export function allocateOrdersWithCapacity(params: {
  orders: OverflowOrderInput[]
  dayRange: string[]
  capacityRecipes: number | null
}): OverflowDisplayCard[] {
  const { dayRange, capacityRecipes } = params
  if (dayRange.length === 0) {
    return []
  }

  const dayIndexByDate = new Map(dayRange.map((date, index) => [date, index]))

  const scheduledOrders = params.orders
    .filter((order) => Boolean(order.scheduledDate) && dayIndexByDate.has(order.scheduledDate as string))
    .sort((a, b) => {
      const dateCompare = (a.scheduledDate as string).localeCompare(b.scheduledDate as string)
      if (dateCompare !== 0) {
        return dateCompare
      }
      return emissionSortKey(a).localeCompare(emissionSortKey(b))
    })

  if (!capacityRecipes || capacityRecipes <= 0) {
    return scheduledOrders.map((order) => buildSingleCard(order, order.scheduledDate as string))
  }

  const knownLoadByDay = new Map(dayRange.map((date) => [date, 0]))
  const results: OverflowDisplayCard[] = []

  for (const order of scheduledOrders) {
    const startDate = order.scheduledDate as string
    const startDayIndex = dayIndexByDate.get(startDate)
    if (startDayIndex === undefined) {
      continue
    }

    if (order.recipeMetrics.kind === 'unknown') {
      results.push(buildSingleCard(order, startDate))
      continue
    }

    let recipesLeft = order.recipeMetrics.recipes
    let dayCursor = startDayIndex
    let segmentIndex = 0
    let allocatedQtyTotal = 0

    while (recipesLeft > 0) {
      const boundedCursor = Math.min(dayCursor, dayRange.length - 1)
      const date = dayRange[boundedCursor]
      const used = knownLoadByDay.get(date) ?? 0
      const freeCapacity = Math.max(0, capacityRecipes - used)
      const allocation = boundedCursor === dayRange.length - 1
        ? recipesLeft
        : freeCapacity > 0
          ? Math.min(recipesLeft, freeCapacity)
          : 0

      if (allocation === 0) {
        dayCursor += 1
        continue
      }

      const startsFromPreviousDay = segmentIndex > 0
      const remainingAfter = recipesLeft - allocation
      const continuesToNextDay = remainingAfter > 0
      const ratio = allocation / order.recipeMetrics.recipes
      const provisionalQty = roundToFour(order.plannedQty * ratio)
      const allocatedPlannedQty =
        continuesToNextDay
          ? provisionalQty
          : roundToFour(order.plannedQty - allocatedQtyTotal)

      allocatedQtyTotal += allocatedPlannedQty
      results.push({
        cardId: `${order.id}::segment::${segmentIndex}`,
        orderId: order.id,
        scheduledDate: date,
        allocatedPlannedQty,
        allocatedRecipes: allocation,
        totalRecipes: order.recipeMetrics.recipes,
        segmentIndex,
        isSplit: startsFromPreviousDay || continuesToNextDay,
        startsFromPreviousDay,
        continuesToNextDay,
      })

      knownLoadByDay.set(date, used + allocation)
      recipesLeft -= allocation
      dayCursor += 1
      segmentIndex += 1
    }
  }

  return results
}

export function sortUnscheduledQueueByEmission<T extends { id: string; documentNumber: number | null; createdAt: string }>(
  orders: T[],
  storedOrderIds: string[]
): T[] {
  const baseSorted = [...orders].sort((a, b) => emissionSortKey(a).localeCompare(emissionSortKey(b)))
  if (storedOrderIds.length === 0) {
    return baseSorted
  }

  const byId = new Map(baseSorted.map((order) => [order.id, order]))
  const result: T[] = []
  const used = new Set<string>()

  for (const id of storedOrderIds) {
    const found = byId.get(id)
    if (found) {
      result.push(found)
      used.add(id)
    }
  }

  for (const order of baseSorted) {
    if (!used.has(order.id)) {
      result.push(order)
    }
  }

  return result
}

export function moveQueueCardBefore(params: {
  currentOrderIds: string[]
  movingOrderId: string
  targetOrderId: string
}): string[] {
  const { currentOrderIds, movingOrderId, targetOrderId } = params
  if (movingOrderId === targetOrderId) {
    return currentOrderIds
  }

  const next = currentOrderIds.filter((id) => id !== movingOrderId)
  const targetIndex = next.findIndex((id) => id === targetOrderId)
  if (targetIndex === -1) {
    return [...next, movingOrderId]
  }

  next.splice(targetIndex, 0, movingOrderId)
  return next
}

