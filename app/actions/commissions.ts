'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { getActiveCompanyId } from '@/lib/auth/get-active-company'
import {
  buildSettlementSelectionPayload,
  computeSettlementPreview,
  normalizeOpenItemsRows,
} from '@/lib/domain/commissions/settlement-calculations'
import type {
  CommissionConfirmResult,
  CommissionOpenItemRow,
  CommissionPaymentMode,
  CommissionRateOverrideResult,
  CommissionRepresentativeOption,
  CommissionSelectionPayloadItem,
  CommissionSettlementListItem,
  CommissionSettlementPreview,
} from '@/lib/domain/commissions/types'
import type { Json } from '@/types/supabase'

export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string }

const openItemsSchema = z.object({
  repId: z.string().uuid('Representante inválido.'),
  cutoffDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data de corte inválida.'),
})

const rateOverrideSchema = z.object({
  orderId: z.string().uuid('Pedido inválido.'),
  newRate: z.coerce.number().min(0).max(100),
  reason: z.string().min(3, 'Motivo obrigatório.'),
  sourceContext: z.string().min(1).max(80),
})

const selectedItemSchema = z.object({
  item_type: z.enum(['RELEASE', 'ENTITLEMENT']),
  item_id: z.string().uuid(),
})

const confirmSchema = z.object({
  repId: z.string().uuid('Representante inválido.'),
  cutoffDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data de corte inválida.'),
  allowAdvance: z.boolean(),
  selectedItems: z.array(selectedItemSchema).min(1, 'Selecione ao menos um item.'),
  totalToPay: z.coerce.number().min(0.01, 'Total inválido.'),
  requestKey: z.string().uuid('Chave de idempotência inválida.'),
})

const settlementDetailSchema = z.object({
  settlementId: z.string().uuid('Acerto inválido.'),
})

interface SettlementDetailLine {
  itemType: 'RELEASE' | 'ENTITLEMENT' | 'ADJUSTMENT'
  amount: number
  orderId: string | null
  orderNumber: number | null
  customerName: string | null
}

function firstOrNull<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value.length > 0 ? value[0] : null
  }

  return value ?? null
}

interface SettlementDetailDTO {
  header: CommissionSettlementListItem
  lines: SettlementDetailLine[]
  summary: {
    releases: number
    advances: number
    adjustments: number
    total: number
  }
}

function normalizeSettlementRow(raw: {
  id: string
  company_id: string
  rep_id: string
  cutoff_date: string
  allow_advance: boolean
  status: string
  total_paid: number
  created_by: string
  created_at: string
  updated_at: string
  request_key: string | null
  representative?: { full_name: string | null } | { full_name: string | null }[] | null
}): CommissionSettlementListItem {
  const representative = Array.isArray(raw.representative) ? raw.representative[0] : raw.representative

  const normalizedStatus = raw.status === 'RASCUNHO' || raw.status === 'CONFIRMADO' || raw.status === 'CANCELADO'
    ? raw.status
    : 'RASCUNHO'

  return {
    id: raw.id,
    company_id: raw.company_id,
    rep_id: raw.rep_id,
    cutoff_date: raw.cutoff_date,
    allow_advance: raw.allow_advance,
    status: normalizedStatus,
    total_paid: Number(raw.total_paid || 0),
    created_by: raw.created_by,
    created_at: raw.created_at,
    updated_at: raw.updated_at,
    request_key: raw.request_key,
    rep_name: representative?.full_name ?? null,
  }
}

export async function listCommissionRepresentativesAction(): Promise<ActionResult<CommissionRepresentativeOption[]>> {
  try {
    const companyId = await getActiveCompanyId()
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('users')
      .select('id, full_name, email')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('full_name', { ascending: true })

    if (error) {
      throw new Error(error.message)
    }

    const reps: CommissionRepresentativeOption[] = (data ?? []).map((row) => ({
      id: row.id,
      full_name: row.full_name,
      email: row.email,
    }))

    return { success: true, data: reps }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Não foi possível carregar representantes.',
    }
  }
}

export async function listCommissionSettlementsAction(): Promise<ActionResult<CommissionSettlementListItem[]>> {
  try {
    const companyId = await getActiveCompanyId()
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('commission_settlements')
      .select(`
        id,
        company_id,
        rep_id,
        cutoff_date,
        allow_advance,
        status,
        total_paid,
        created_by,
        created_at,
        updated_at,
        request_key,
        representative:users!commission_settlements_rep_id_fkey(full_name)
      `)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error(error.message)
    }

    const settlements = (data ?? []).map((row) => normalizeSettlementRow(row))

    return { success: true, data: settlements }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Não foi possível carregar acertos.',
    }
  }
}

export async function getCommissionRepOpenItemsAction(input: {
  repId: string
  cutoffDate: string
}): Promise<ActionResult<CommissionOpenItemRow[]>> {
  try {
    const parsed = openItemsSchema.parse(input)
    const companyId = await getActiveCompanyId()
    const supabase = await createClient()

    const { data, error } = await supabase.rpc('commission_get_rep_open_items', {
      p_company_id: companyId,
      p_rep_id: parsed.repId,
      p_cutoff_date: parsed.cutoffDate,
    })

    if (error) {
      throw new Error(error.message)
    }

    return {
      success: true,
      data: normalizeOpenItemsRows(data),
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0]?.message ?? 'Dados inválidos.' }
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Não foi possível carregar pendências de comissão.',
    }
  }
}

export async function applyCommissionRateOverrideAction(input: {
  orderId: string
  newRate: number
  reason: string
  sourceContext: string
}): Promise<ActionResult<CommissionRateOverrideResult>> {
  try {
    const parsed = rateOverrideSchema.parse(input)
    const companyId = await getActiveCompanyId()
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      throw new Error('Usuário não autenticado.')
    }

    const { data, error } = await supabase.rpc('commission_apply_order_rate_override', {
      p_company_id: companyId,
      p_order_id: parsed.orderId,
      p_new_rate: parsed.newRate,
      p_reason: parsed.reason,
      p_changed_by: user.id,
      p_source_context: parsed.sourceContext,
    })

    if (error) {
      throw new Error(error.message)
    }

    if (!data || data.length === 0) {
      throw new Error('Nenhum resultado retornado na alteração da comissão.')
    }

    const row = data[0]

    revalidatePath('/app/financeiro/comissoes')

    return {
      success: true,
      data: {
        order_id: row.order_id,
        old_rate: Number(row.old_rate || 0),
        new_rate: Number(row.new_rate || 0),
        open_entitlements_count: Number(row.open_entitlements_count || 0),
        open_releases_count: Number(row.open_releases_count || 0),
        adjustment_delta: Number(row.adjustment_delta || 0),
      },
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0]?.message ?? 'Dados inválidos.' }
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Não foi possível alterar a taxa de comissão.',
    }
  }
}

export async function confirmCommissionSettlementAction(input: {
  repId: string
  cutoffDate: string
  allowAdvance: boolean
  selectedItems: CommissionSelectionPayloadItem[]
  totalToPay: number
  requestKey: string
}): Promise<ActionResult<CommissionConfirmResult>> {
  try {
    const parsed = confirmSchema.parse(input)
    const companyId = await getActiveCompanyId()
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      throw new Error('Usuário não autenticado.')
    }

    const selectedItems: Json = parsed.selectedItems.map((item) => ({
      item_type: item.item_type,
      item_id: item.item_id,
    }))

    const { data, error } = await supabase.rpc('commission_confirm_settlement', {
      p_company_id: companyId,
      p_rep_id: parsed.repId,
      p_cutoff_date: parsed.cutoffDate,
      p_allow_advance: parsed.allowAdvance,
      p_selected_items: selectedItems,
      p_total_to_pay: parsed.totalToPay,
      p_created_by: user.id,
      p_request_key: parsed.requestKey,
    })

    if (error) {
      throw new Error(error.message)
    }

    if (!data || data.length === 0) {
      throw new Error('Não foi possível confirmar o acerto.')
    }

    const row = data[0]

    revalidatePath('/app/financeiro/comissoes')
    revalidatePath(`/app/financeiro/comissoes/${row.settlement_id}`)

    return {
      success: true,
      data: {
        settlement_id: row.settlement_id,
        total_released_selected: Number(row.total_released_selected || 0),
        total_advance_selected: Number(row.total_advance_selected || 0),
        total_paid: Number(row.total_paid || 0),
        status: row.status === 'RASCUNHO' || row.status === 'CONFIRMADO' || row.status === 'CANCELADO'
          ? row.status
          : 'RASCUNHO',
      },
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0]?.message ?? 'Dados inválidos.' }
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Não foi possível confirmar o acerto.',
    }
  }
}

export async function getCommissionSettlementDetailAction(input: {
  settlementId: string
}): Promise<ActionResult<SettlementDetailDTO>> {
  try {
    const parsed = settlementDetailSchema.parse(input)
    const companyId = await getActiveCompanyId()
    const supabase = await createClient()

    const { data: settlementData, error: settlementError } = await supabase
      .from('commission_settlements')
      .select(`
        id,
        company_id,
        rep_id,
        cutoff_date,
        allow_advance,
        status,
        total_paid,
        created_by,
        created_at,
        updated_at,
        request_key,
        representative:users!commission_settlements_rep_id_fkey(full_name)
      `)
      .eq('id', parsed.settlementId)
      .eq('company_id', companyId)
      .single()

    if (settlementError || !settlementData) {
      throw new Error(settlementError?.message ?? 'Acerto não encontrado.')
    }

    const { data: itemsData, error: itemsError } = await supabase
      .from('commission_settlement_items')
      .select('item_type, item_id, amount')
      .eq('settlement_id', parsed.settlementId)

    if (itemsError) {
      throw new Error(itemsError.message)
    }

    const releaseIds = (itemsData ?? [])
      .filter((item) => item.item_type === 'RELEASE')
      .map((item) => item.item_id)

    const entitlementIds = (itemsData ?? [])
      .filter((item) => item.item_type === 'ENTITLEMENT')
      .map((item) => item.item_id)

    const releaseById = new Map<string, { order_id: string; order_number: number | null; customer_name: string | null }>()
    const entitlementById = new Map<string, { order_id: string; order_number: number | null; customer_name: string | null }>()

    if (releaseIds.length > 0) {
      const { data: releasesData, error: releasesError } = await supabase
        .from('commission_releases')
        .select(`
          id,
          order_id,
          sales_documents!commission_releases_order_id_fkey(document_number, client_id, organizations!sales_documents_client_id_fkey(trade_name, legal_name))
        `)
        .in('id', releaseIds)

      if (releasesError) {
        throw new Error(releasesError.message)
      }

      for (const release of releasesData ?? []) {
        const order = firstOrNull(release.sales_documents)
        const organization = firstOrNull(order?.organizations)
        releaseById.set(release.id, {
          order_id: release.order_id,
          order_number: order?.document_number ?? null,
          customer_name: organization?.trade_name ?? organization?.legal_name ?? null,
        })
      }
    }

    if (entitlementIds.length > 0) {
      const { data: entitlementsData, error: entitlementsError } = await supabase
        .from('commission_entitlements')
        .select(`
          id,
          order_id,
          sales_documents!commission_entitlements_order_id_fkey(document_number, client_id, organizations!sales_documents_client_id_fkey(trade_name, legal_name))
        `)
        .in('id', entitlementIds)

      if (entitlementsError) {
        throw new Error(entitlementsError.message)
      }

      for (const entitlement of entitlementsData ?? []) {
        const order = firstOrNull(entitlement.sales_documents)
        const organization = firstOrNull(order?.organizations)
        entitlementById.set(entitlement.id, {
          order_id: entitlement.order_id,
          order_number: order?.document_number ?? null,
          customer_name: organization?.trade_name ?? organization?.legal_name ?? null,
        })
      }
    }

    const lines: SettlementDetailLine[] = (itemsData ?? []).map((item) => {
      const source = item.item_type === 'RELEASE'
        ? releaseById.get(item.item_id)
        : entitlementById.get(item.item_id)

      return {
        itemType: item.item_type,
        amount: Number(item.amount || 0),
        orderId: source?.order_id ?? null,
        orderNumber: source?.order_number ?? null,
        customerName: source?.customer_name ?? null,
      }
    })

    const summary = lines.reduce(
      (acc, line) => {
        if (line.itemType === 'RELEASE') {
          acc.releases += line.amount
        } else if (line.itemType === 'ENTITLEMENT') {
          acc.advances += line.amount
        } else {
          acc.adjustments += line.amount
        }
        acc.total += line.amount
        return acc
      },
      { releases: 0, advances: 0, adjustments: 0, total: 0 },
    )

    return {
      success: true,
      data: {
        header: normalizeSettlementRow(settlementData),
        lines,
        summary: {
          releases: Number(summary.releases.toFixed(2)),
          advances: Number(summary.advances.toFixed(2)),
          adjustments: Number(summary.adjustments.toFixed(2)),
          total: Number(summary.total.toFixed(2)),
        },
      },
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0]?.message ?? 'Dados inválidos.' }
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Não foi possível carregar o detalhe do acerto.',
    }
  }
}

export function buildCommissionSettlementPreview(
  rows: CommissionOpenItemRow[],
  selectedEntitlementIds: ReadonlySet<string>,
  mode: CommissionPaymentMode,
): CommissionSettlementPreview {
  return computeSettlementPreview(rows, selectedEntitlementIds, mode)
}

export function buildCommissionSettlementPayload(
  rows: CommissionOpenItemRow[],
  selectedEntitlementIds: ReadonlySet<string>,
  mode: CommissionPaymentMode,
): CommissionSelectionPayloadItem[] {
  return buildSettlementSelectionPayload(rows, selectedEntitlementIds, mode)
}
