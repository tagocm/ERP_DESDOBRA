import { describe, expect, it } from 'vitest'
import {
  buildSettlementSelectionPayload,
  computeSettlementPreview,
} from '@/lib/domain/commissions/settlement-calculations'
import type { CommissionOpenItemRow } from '@/lib/domain/commissions/types'

const sampleRows: CommissionOpenItemRow[] = [
  {
    entitlement_id: 'ent-1',
    order_id: 'ord-1',
    order_number: 101,
    customer_id: 'cust-1',
    customer_name: 'Cliente A',
    delivery_item_id: 'del-1',
    delivered_date: '2026-03-01',
    status_logistico: 'delivered',
    status_financeiro: 'partial',
    base_delivered_amount: 1000,
    commission_rate: 5,
    commission_total: 50,
    released_open_amount: 30,
    unreleased_open_amount: 20,
    total_open_amount: 50,
    max_payable_amount: 50,
    release_item_ids: ['rel-1', 'rel-2'],
    default_selected: true,
  },
  {
    entitlement_id: 'ent-2',
    order_id: 'ord-2',
    order_number: 102,
    customer_id: 'cust-2',
    customer_name: 'Cliente B',
    delivery_item_id: 'del-2',
    delivered_date: '2026-03-02',
    status_logistico: 'delivered',
    status_financeiro: 'pending',
    base_delivered_amount: 800,
    commission_rate: 5,
    commission_total: 40,
    released_open_amount: 0,
    unreleased_open_amount: 40,
    total_open_amount: 40,
    max_payable_amount: 40,
    release_item_ids: [],
    default_selected: false,
  },
]

describe('computeSettlementPreview', () => {
  it('calcula somente liberado no modo LIBERADO', () => {
    const preview = computeSettlementPreview(sampleRows, new Set(['ent-1', 'ent-2']), 'LIBERADO')

    expect(preview.selectedLines).toBe(2)
    expect(preview.totalReleased).toBe(30)
    expect(preview.totalAdvance).toBe(0)
    expect(preview.totalPayable).toBe(30)
    expect(preview.deliveredCeiling).toBe(90)
  })

  it('calcula liberado + adiantamento no modo ADIANTAMENTO', () => {
    const preview = computeSettlementPreview(sampleRows, new Set(['ent-1', 'ent-2']), 'ADIANTAMENTO')

    expect(preview.totalReleased).toBe(30)
    expect(preview.totalAdvance).toBe(60)
    expect(preview.totalPayable).toBe(90)
  })
})

describe('buildSettlementSelectionPayload', () => {
  it('gera payload deduplicado e idempotente', () => {
    const duplicatedRows: CommissionOpenItemRow[] = [
      sampleRows[0],
      {
        ...sampleRows[0],
        entitlement_id: 'ent-3',
        release_item_ids: ['rel-2', 'rel-3'],
      },
    ]

    const payload = buildSettlementSelectionPayload(duplicatedRows, new Set(['ent-1', 'ent-3']), 'ADIANTAMENTO')

    expect(payload).toEqual([
      { item_type: 'RELEASE', item_id: 'rel-1' },
      { item_type: 'RELEASE', item_id: 'rel-2' },
      { item_type: 'ENTITLEMENT', item_id: 'ent-1' },
      { item_type: 'RELEASE', item_id: 'rel-3' },
      { item_type: 'ENTITLEMENT', item_id: 'ent-3' },
    ])
  })
})
