import { describe, expect, it } from 'vitest'
import {
  buildProductionDropId,
  computeWorkOrderMovePatch,
  parseProductionDropId,
} from '@/lib/pcp/production-schedule-dnd'

describe('production schedule drag and drop rules', () => {
  it('serializes and parses drop target with sector', () => {
    const dropId = buildProductionDropId({
      sectorId: 'sector-1',
      scheduledDate: '2026-03-05',
    })

    expect(parseProductionDropId(dropId)).toEqual({
      sectorId: 'sector-1',
      scheduledDate: '2026-03-05',
    })
  })

  it('serializes and parses drop target without sector', () => {
    const dropId = buildProductionDropId({
      sectorId: null,
      scheduledDate: '2026-03-05',
    })

    expect(parseProductionDropId(dropId)).toEqual({
      sectorId: null,
      scheduledDate: '2026-03-05',
    })
  })

  it('updates scheduled_date and sector_id when moving between lanes', () => {
    const patch = computeWorkOrderMovePatch(
      {
        id: 'wo-1',
        status: 'planned',
        scheduledDate: '2026-03-05',
        sectorId: 'sector-envase',
      },
      {
        scheduledDate: '2026-03-06',
        sectorId: 'sector-producao',
      }
    )

    expect(patch).toEqual({
      scheduledDate: '2026-03-06',
      sectorId: 'sector-producao',
    })
  })

  it('blocks moving sectorized OP into sem setor lane', () => {
    expect(() =>
      computeWorkOrderMovePatch(
        {
          id: 'wo-1',
          status: 'planned',
          scheduledDate: '2026-03-05',
          sectorId: 'sector-envase',
        },
        {
          scheduledDate: '2026-03-06',
          sectorId: null,
        }
      )
    ).toThrow(/sem setor/i)
  })
})

