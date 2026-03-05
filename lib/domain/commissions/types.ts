export type CommissionSettlementStatus = 'RASCUNHO' | 'CONFIRMADO' | 'CANCELADO'

export type CommissionPaymentMode = 'LIBERADO' | 'ADIANTAMENTO'

export interface CommissionOpenItemRow {
  entitlement_id: string
  order_id: string
  order_number: number | null
  customer_id: string | null
  customer_name: string | null
  delivery_item_id: string
  delivered_date: string | null
  status_logistico: string | null
  status_financeiro: string | null
  base_delivered_amount: number
  commission_rate: number
  commission_total: number
  released_open_amount: number
  unreleased_open_amount: number
  total_open_amount: number
  max_payable_amount: number
  release_item_ids: string[]
  default_selected: boolean
}

export interface CommissionSettlementListItem {
  id: string
  company_id: string
  rep_id: string
  cutoff_date: string
  allow_advance: boolean
  status: CommissionSettlementStatus
  total_paid: number
  created_by: string
  created_at: string
  updated_at: string
  request_key: string | null
  rep_name: string | null
}

export interface CommissionRepresentativeOption {
  id: string
  full_name: string
  email: string
}

export interface CommissionSelectionPayloadItem {
  item_type: 'RELEASE' | 'ENTITLEMENT'
  item_id: string
}

export interface CommissionSettlementPreview {
  selectedLines: number
  totalReleased: number
  totalAdvance: number
  totalPayable: number
  deliveredCeiling: number
}

export interface CommissionRateOverrideResult {
  order_id: string
  old_rate: number
  new_rate: number
  open_entitlements_count: number
  open_releases_count: number
  adjustment_delta: number
}

export interface CommissionConfirmResult {
  settlement_id: string
  total_released_selected: number
  total_advance_selected: number
  total_paid: number
  status: CommissionSettlementStatus
}
