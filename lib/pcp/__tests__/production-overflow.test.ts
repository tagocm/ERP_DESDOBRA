import { describe, expect, it } from 'vitest'
import {
  allocateOrdersWithCapacity,
  moveQueueCardBefore,
  sortUnscheduledQueueByEmission,
} from '@/lib/pcp/production-overflow'

describe('production overflow allocation', () => {
  it('splits an order into the next day when recipes exceed daily capacity', () => {
    const cards = allocateOrdersWithCapacity({
      dayRange: ['2026-03-10', '2026-03-11'],
      capacityRecipes: 5,
      orders: [
        {
          id: 'wo-1',
          scheduledDate: '2026-03-10',
          documentNumber: 10,
          createdAt: '2026-03-01T08:00:00.000Z',
          plannedQty: 100,
          recipeMetrics: { kind: 'bom_yield', recipes: 7, yieldQty: 15 },
        },
      ],
    })

    expect(cards).toHaveLength(2)
    expect(cards[0]).toMatchObject({
      orderId: 'wo-1',
      scheduledDate: '2026-03-10',
      allocatedRecipes: 5,
      continuesToNextDay: true,
    })
    expect(cards[1]).toMatchObject({
      orderId: 'wo-1',
      scheduledDate: '2026-03-11',
      allocatedRecipes: 2,
      startsFromPreviousDay: true,
    })
    expect(cards[0].allocatedPlannedQty + cards[1].allocatedPlannedQty).toBeCloseTo(100, 3)
  })

  it('keeps unknown recipe orders on original day without split', () => {
    const cards = allocateOrdersWithCapacity({
      dayRange: ['2026-03-10', '2026-03-11'],
      capacityRecipes: 3,
      orders: [
        {
          id: 'wo-unknown',
          scheduledDate: '2026-03-10',
          documentNumber: 1,
          createdAt: '2026-03-01T08:00:00.000Z',
          plannedQty: 50,
          recipeMetrics: { kind: 'unknown' },
        },
      ],
    })

    expect(cards).toHaveLength(1)
    expect(cards[0]).toMatchObject({
      orderId: 'wo-unknown',
      scheduledDate: '2026-03-10',
      allocatedRecipes: null,
      isSplit: false,
    })
  })
})

describe('unscheduled queue ordering', () => {
  it('defaults to emission order and preserves stored manual order', () => {
    const queue = sortUnscheduledQueueByEmission(
      [
        { id: 'wo-2', documentNumber: 2, createdAt: '2026-03-01T10:00:00.000Z' },
        { id: 'wo-1', documentNumber: 1, createdAt: '2026-03-01T09:00:00.000Z' },
        { id: 'wo-3', documentNumber: 3, createdAt: '2026-03-01T11:00:00.000Z' },
      ],
      ['wo-2', 'wo-1']
    )

    expect(queue.map((item) => item.id)).toEqual(['wo-2', 'wo-1', 'wo-3'])
  })

  it('moves a queue card before another', () => {
    const ordered = moveQueueCardBefore({
      currentOrderIds: ['wo-1', 'wo-2', 'wo-3'],
      movingOrderId: 'wo-3',
      targetOrderId: 'wo-1',
    })

    expect(ordered).toEqual(['wo-3', 'wo-1', 'wo-2'])
  })
})

