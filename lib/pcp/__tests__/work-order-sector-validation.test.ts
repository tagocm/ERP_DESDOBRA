import { describe, expect, it } from 'vitest'
import { validateActiveSectorIds } from '@/lib/pcp/work-order-dependencies-service'

const activeSectors = [
  { id: 'sector-envase', code: 'ENVASE', name: 'Envase' },
  { id: 'sector-prod', code: 'PRODUCAO_GRANOLA', name: 'Produção de Granola' },
]

describe('work order sector validation', () => {
  it('fails when parent sector is missing', () => {
    const result = validateActiveSectorIds({
      activeSectors,
      parentSectorId: null,
      childSectorIds: [],
    })

    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.message).toMatch(/setor de produção ativo/i)
    }
  })

  it('fails when parent sector is inactive or from another company set', () => {
    const result = validateActiveSectorIds({
      activeSectors,
      parentSectorId: 'sector-inactive',
      childSectorIds: [],
    })

    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.message).toMatch(/setor de produção ativo/i)
    }
  })

  it('fails when any child sector is invalid', () => {
    const result = validateActiveSectorIds({
      activeSectors,
      parentSectorId: 'sector-envase',
      childSectorIds: ['sector-prod', 'sector-invalid'],
    })

    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.message).toMatch(/filhas/i)
    }
  })

  it('passes when parent and all children sectors are active and valid', () => {
    const result = validateActiveSectorIds({
      activeSectors,
      parentSectorId: 'sector-envase',
      childSectorIds: ['sector-prod'],
    })

    expect(result).toEqual({ valid: true })
  })
})

