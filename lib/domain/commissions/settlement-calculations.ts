import type {
  CommissionOpenItemRow,
  CommissionPaymentMode,
  CommissionSelectionPayloadItem,
  CommissionSettlementPreview,
} from './types'

const roundMoney = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100

export function computeSettlementPreview(
  rows: CommissionOpenItemRow[],
  selectedEntitlementIds: ReadonlySet<string>,
  mode: CommissionPaymentMode,
): CommissionSettlementPreview {
  let totalReleased = 0
  let totalAdvance = 0
  let deliveredCeiling = 0
  let selectedLines = 0

  for (const row of rows) {
    if (!selectedEntitlementIds.has(row.entitlement_id)) {
      continue
    }

    selectedLines += 1

    const released = Math.max(0, Number(row.released_open_amount || 0))
    const unreleased = Math.max(0, Number(row.unreleased_open_amount || 0))

    totalReleased += released
    deliveredCeiling += released + unreleased

    if (mode === 'ADIANTAMENTO') {
      totalAdvance += unreleased
    }
  }

  const roundedReleased = roundMoney(totalReleased)
  const roundedAdvance = roundMoney(totalAdvance)

  return {
    selectedLines,
    totalReleased: roundedReleased,
    totalAdvance: roundedAdvance,
    totalPayable: roundMoney(roundedReleased + roundedAdvance),
    deliveredCeiling: roundMoney(deliveredCeiling),
  }
}

export function buildSettlementSelectionPayload(
  rows: CommissionOpenItemRow[],
  selectedEntitlementIds: ReadonlySet<string>,
  mode: CommissionPaymentMode,
): CommissionSelectionPayloadItem[] {
  const payload: CommissionSelectionPayloadItem[] = []
  const seen = new Set<string>()

  const pushUnique = (item: CommissionSelectionPayloadItem): void => {
    const key = `${item.item_type}:${item.item_id}`
    if (seen.has(key)) {
      return
    }
    seen.add(key)
    payload.push(item)
  }

  for (const row of rows) {
    if (!selectedEntitlementIds.has(row.entitlement_id)) {
      continue
    }

    for (const releaseId of row.release_item_ids) {
      pushUnique({ item_type: 'RELEASE', item_id: releaseId })
    }

    if (mode === 'ADIANTAMENTO' && Number(row.unreleased_open_amount || 0) > 0) {
      pushUnique({ item_type: 'ENTITLEMENT', item_id: row.entitlement_id })
    }
  }

  return payload
}

export function normalizeOpenItemsRows(rawRows: unknown): CommissionOpenItemRow[] {
  if (!Array.isArray(rawRows)) {
    return []
  }

  return rawRows
    .map((raw): CommissionOpenItemRow | null => {
      if (typeof raw !== 'object' || raw === null) {
        return null
      }

      const row = raw as Record<string, unknown>
      const releaseIdsRaw = row.release_item_ids
      const releaseItemIds = Array.isArray(releaseIdsRaw)
        ? releaseIdsRaw.filter((value): value is string => typeof value === 'string')
        : []

      if (typeof row.entitlement_id !== 'string' || typeof row.order_id !== 'string' || typeof row.delivery_item_id !== 'string') {
        return null
      }

      return {
        entitlement_id: row.entitlement_id,
        order_id: row.order_id,
        order_number: typeof row.order_number === 'number' ? row.order_number : null,
        customer_id: typeof row.customer_id === 'string' ? row.customer_id : null,
        customer_name: typeof row.customer_name === 'string' ? row.customer_name : null,
        delivery_item_id: row.delivery_item_id,
        delivered_date: typeof row.delivered_date === 'string' ? row.delivered_date : null,
        status_logistico: typeof row.status_logistico === 'string' ? row.status_logistico : null,
        status_financeiro: typeof row.status_financeiro === 'string' ? row.status_financeiro : null,
        base_delivered_amount: Number(row.base_delivered_amount || 0),
        commission_rate: Number(row.commission_rate || 0),
        commission_total: Number(row.commission_total || 0),
        released_open_amount: Number(row.released_open_amount || 0),
        unreleased_open_amount: Number(row.unreleased_open_amount || 0),
        total_open_amount: Number(row.total_open_amount || 0),
        max_payable_amount: Number(row.max_payable_amount || 0),
        release_item_ids: releaseItemIds,
        default_selected: Boolean(row.default_selected),
      }
    })
    .filter((row): row is CommissionOpenItemRow => row !== null)
}
