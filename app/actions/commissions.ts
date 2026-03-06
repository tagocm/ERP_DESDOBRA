'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { getActiveCompanyId } from '@/lib/auth/get-active-company'
import {
  normalizeOpenItemsRows,
} from '@/lib/domain/commissions/settlement-calculations'
import type {
  CommissionConfirmResult,
  CommissionEntitlementRateOverrideResult,
  CommissionOpenItemRow,
  CommissionRateOverrideResult,
  CommissionRepresentativeOption,
  CommissionSelectionPayloadItem,
  CommissionSettlementListItem,
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

const entitlementRateOverrideSchema = z.object({
  entitlementId: z.string().uuid('Item de comissão inválido.'),
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
  payableDueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data de vencimento inválida.'),
})

const settlementDetailSchema = z.object({
  settlementId: z.string().uuid('Acerto inválido.'),
})

const deleteDraftSchema = z.object({
  settlementId: z.string().uuid('Acerto inválido.'),
})

const draftSchema = z.object({
  repId: z.string().uuid('Representante inválido.'),
  cutoffDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data de corte inválida.'),
  allowAdvance: z.boolean(),
  selectedItems: z.array(selectedItemSchema).default([]),
})

interface SettlementDetailLine {
  itemType: 'RELEASE' | 'ENTITLEMENT' | 'ADJUSTMENT'
  amount: number
  orderId: string | null
  orderNumber: number | null
  customerName: string | null
  statusLogistico: string | null
  statusFinanceiro: string | null
  baseAmount: number
  commissionRate: number
  commissionAmount: number
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

interface AuthUserSnapshot {
  id: string
  email: string | null
}

interface CommissionOrderSnapshot {
  document_number: number | null
  customer_name: string | null
  status_logistico: string | null
  status_financeiro: string | null
}

async function resolveInternalAuditUserId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  companyId: string,
  authUser: AuthUserSnapshot,
): Promise<string> {
  const { data: directUser, error: directUserError } = await supabase
    .from('users')
    .select('id')
    .eq('company_id', companyId)
    .eq('id', authUser.id)
    .is('deleted_at', null)
    .maybeSingle()

  if (directUserError) {
    throw new Error(directUserError.message)
  }

  if (directUser?.id) {
    return directUser.id
  }

  const normalizedEmail = authUser.email?.trim().toLowerCase() ?? null
  if (normalizedEmail) {
    const { data: emailUsers, error: emailUsersError } = await supabase
      .from('users')
      .select('id, email')
      .eq('company_id', companyId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })

    if (emailUsersError) {
      throw new Error(emailUsersError.message)
    }

    const matchedByEmail = (emailUsers ?? []).find(
      (candidate) => candidate.email.trim().toLowerCase() === normalizedEmail,
    )

    if (matchedByEmail?.id) {
      return matchedByEmail.id
    }
  }

  throw new Error(
    'Usuário logado não está vinculado ao cadastro interno (public.users) desta empresa. Contate o administrador.',
  )
}

function normalizeSettlementRow(raw: {
  id: string
  document_number: number | null
  company_id: string
  rep_id: string
  cutoff_date: string
  payment_date?: string | null
  payment_status?: string | null
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
    document_number: raw.document_number,
    company_id: raw.company_id,
    rep_id: raw.rep_id,
    cutoff_date: raw.cutoff_date,
    payment_date: raw.payment_date ?? null,
    payment_status: raw.payment_status ?? null,
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

async function resolveCommissionRepId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  companyId: string,
  selectedRepId: string,
): Promise<string> {
  const { data: roleRow, error } = await supabase
    .from('organization_roles')
    .select(`
      organization_id,
      organization:organizations!organization_roles_organization_id_fkey(
        id,
        company_id,
        deleted_at,
        sales_rep_user_id
      )
    `)
    .eq('company_id', companyId)
    .eq('organization_id', selectedRepId)
    .eq('role', 'representative')
    .is('deleted_at', null)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  const organization = firstOrNull(roleRow?.organization)

  if (!organization || organization.deleted_at !== null || organization.company_id !== companyId) {
    return selectedRepId
  }

  return organization.sales_rep_user_id ?? organization.id
}

async function loadRepresentativeNamesMap(
  supabase: Awaited<ReturnType<typeof createClient>>,
  companyId: string,
  repIds: string[],
): Promise<Map<string, string>> {
  const nameMap = new Map<string, string>()

  if (repIds.length === 0) {
    return nameMap
  }

  const { data: usersData, error: usersError } = await supabase
    .from('users')
    .select('id, full_name')
    .in('id', repIds)
    .is('deleted_at', null)

  if (usersError) {
    throw new Error(usersError.message)
  }

  for (const user of usersData ?? []) {
    nameMap.set(user.id, user.full_name)
  }

  const missingIds = repIds.filter((id) => !nameMap.has(id))
  if (missingIds.length === 0) {
    return nameMap
  }

  const { data: organizationsData, error: organizationsError } = await supabase
    .from('organizations')
    .select('id, trade_name, legal_name')
    .eq('company_id', companyId)
    .in('id', missingIds)
    .is('deleted_at', null)

  if (organizationsError) {
    throw new Error(organizationsError.message)
  }

  for (const organization of organizationsData ?? []) {
    const label = organization.trade_name || organization.legal_name || 'Representante'
    nameMap.set(organization.id, label)
  }

  return nameMap
}

async function loadRepresentativeOrganizationNamesByUserIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  companyId: string,
  userIds: string[],
): Promise<Map<string, string>> {
  const userIdSet = new Set(userIds)
  const nameMap = new Map<string, string>()

  if (userIdSet.size === 0) {
    return nameMap
  }

  const { data: representativeRoles, error: representativeRolesError } = await supabase
    .from('organization_roles')
    .select(`
      organization:organizations!organization_roles_organization_id_fkey(
        id,
        trade_name,
        legal_name,
        sales_rep_user_id,
        status,
        deleted_at
      )
    `)
    .eq('company_id', companyId)
    .eq('role', 'representative')
    .is('deleted_at', null)

  if (representativeRolesError) {
    throw new Error(representativeRolesError.message)
  }

  for (const role of representativeRoles ?? []) {
    const organization = firstOrNull(role.organization)
    if (!organization || organization.deleted_at !== null || organization.status !== 'active') {
      continue
    }

    if (!organization.sales_rep_user_id || !userIdSet.has(organization.sales_rep_user_id)) {
      continue
    }

    if (!nameMap.has(organization.sales_rep_user_id)) {
      nameMap.set(organization.sales_rep_user_id, organization.trade_name || organization.legal_name || 'Representante')
    }
  }

  return nameMap
}

async function loadCommissionOrderSnapshotsByIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  companyId: string,
  orderIds: string[],
): Promise<Map<string, CommissionOrderSnapshot>> {
  const snapshots = new Map<string, CommissionOrderSnapshot>()
  const uniqueOrderIds = Array.from(new Set(orderIds))

  if (uniqueOrderIds.length === 0) {
    return snapshots
  }

  const { data: ordersData, error: ordersError } = await supabase
    .from('sales_documents')
    .select('id, document_number, client_id, status_logistic, financial_status')
    .eq('company_id', companyId)
    .in('id', uniqueOrderIds)

  if (ordersError) {
    throw new Error(ordersError.message)
  }

  const clientIds = Array.from(
    new Set(
      (ordersData ?? [])
        .map((order) => order.client_id)
        .filter((clientId): clientId is string => typeof clientId === 'string' && clientId.length > 0),
    ),
  )

  const customerNameById = new Map<string, string>()
  if (clientIds.length > 0) {
    const { data: organizationsData, error: organizationsError } = await supabase
      .from('organizations')
      .select('id, trade_name, legal_name')
      .eq('company_id', companyId)
      .in('id', clientIds)

    if (organizationsError) {
      throw new Error(organizationsError.message)
    }

    for (const organization of organizationsData ?? []) {
      customerNameById.set(organization.id, organization.trade_name ?? organization.legal_name ?? 'Cliente')
    }
  }

  for (const order of ordersData ?? []) {
    snapshots.set(order.id, {
      document_number: order.document_number,
      customer_name: customerNameById.get(order.client_id) ?? null,
      status_logistico: order.status_logistic ?? null,
      status_financeiro: order.financial_status ?? null,
    })
  }

  return snapshots
}

export async function listCommissionRepresentativesAction(): Promise<ActionResult<CommissionRepresentativeOption[]>> {
  try {
    const companyId = await getActiveCompanyId()
    const supabase = await createClient()

    const { data: representativeRoles, error: representativeRolesError } = await supabase
      .from('organization_roles')
      .select(`
        organization_id,
        organization:organizations!organization_roles_organization_id_fkey(
          id,
          company_id,
          trade_name,
          legal_name,
          email,
          sales_rep_user_id,
          status,
          deleted_at
        )
      `)
      .eq('company_id', companyId)
      .eq('role', 'representative')
      .is('deleted_at', null)
      .order('organization_id', { ascending: true })

    if (representativeRolesError) {
      throw new Error(representativeRolesError.message)
    }

    const representativesMap = new Map<string, CommissionRepresentativeOption>()

    for (const role of representativeRoles ?? []) {
      const organization = firstOrNull(role.organization)
      if (!organization || organization.deleted_at !== null || organization.status !== 'active') {
        continue
      }

      const label = organization.trade_name || organization.legal_name || 'Representante'
      const resolvedRepId = organization.sales_rep_user_id ?? organization.id

      representativesMap.set(organization.id, {
        id: organization.id,
        full_name: label,
        email: organization.email,
        resolved_rep_id: resolvedRepId,
      })
    }

    const reps: CommissionRepresentativeOption[] = Array.from(representativesMap.values()).sort((a, b) =>
      a.full_name.localeCompare(b.full_name, 'pt-BR'),
    )

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
        document_number,
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
    const settlementIds = settlements.map((settlement) => settlement.id)

    if (settlementIds.length > 0) {
      const { data: paymentEntries, error: paymentEntriesError } = await supabase
        .from('financial_entries')
        .select('origin_id, due_date, status')
        .eq('company_id', companyId)
        .eq('origin_type', 'COMMISSION_SETTLEMENT')
        .in('origin_id', settlementIds)

      if (paymentEntriesError) {
        throw new Error(paymentEntriesError.message)
      }

      const paymentBySettlementId = new Map<string, { due_date: string; status: string }>()
      for (const entry of paymentEntries ?? []) {
        paymentBySettlementId.set(entry.origin_id, { due_date: entry.due_date, status: entry.status })
      }

      for (const settlement of settlements) {
        const paymentEntry = paymentBySettlementId.get(settlement.id)
        settlement.payment_date = paymentEntry?.due_date ?? null
        settlement.payment_status = paymentEntry?.status ?? null
      }
    }
    const settlementRepIds = Array.from(new Set(settlements.map((settlement) => settlement.rep_id)))
    const organizationRepNameMap = await loadRepresentativeOrganizationNamesByUserIds(
      supabase,
      companyId,
      settlementRepIds,
    )

    for (const settlement of settlements) {
      const organizationRepName = organizationRepNameMap.get(settlement.rep_id)
      if (organizationRepName) {
        settlement.rep_name = organizationRepName
      }
    }

    const missingRepNameIds = Array.from(
      new Set(
        settlements
          .filter((settlement) => !settlement.rep_name)
          .map((settlement) => settlement.rep_id),
      ),
    )

    if (missingRepNameIds.length > 0) {
      const nameMap = await loadRepresentativeNamesMap(supabase, companyId, missingRepNameIds)
      for (const settlement of settlements) {
        if (!settlement.rep_name) {
          settlement.rep_name = nameMap.get(settlement.rep_id) ?? null
        }
      }
    }

    return { success: true, data: settlements }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Não foi possível carregar acertos.',
    }
  }
}

export async function deleteCommissionSettlementDraftAction(input: {
  settlementId: string
}): Promise<ActionResult<{ settlementId: string }>> {
  try {
    const parsed = deleteDraftSchema.parse(input)
    const companyId = await getActiveCompanyId()
    const supabase = await createClient()

    const { data: draft, error: draftLookupError } = await supabase
      .from('commission_settlements')
      .select('id, status')
      .eq('id', parsed.settlementId)
      .eq('company_id', companyId)
      .single()

    if (draftLookupError || !draft) {
      throw new Error(draftLookupError?.message ?? 'Acerto não encontrado.')
    }

    if (draft.status !== 'RASCUNHO') {
      throw new Error('Somente acertos em rascunho podem ser excluídos.')
    }

    const { error: deleteError } = await supabase
      .from('commission_settlements')
      .delete()
      .eq('id', parsed.settlementId)
      .eq('company_id', companyId)
      .eq('status', 'RASCUNHO')

    if (deleteError) {
      throw new Error(deleteError.message)
    }

    revalidatePath('/app/financeiro/comissoes')
    revalidatePath(`/app/financeiro/comissoes/${parsed.settlementId}`)

    return {
      success: true,
      data: { settlementId: parsed.settlementId },
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0]?.message ?? 'Dados inválidos.' }
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Não foi possível excluir o rascunho.',
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
    const resolvedRepId = await resolveCommissionRepId(supabase, companyId, parsed.repId)

    const { data, error } = await supabase.rpc('commission_get_rep_open_items', {
      p_company_id: companyId,
      p_rep_id: resolvedRepId,
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

    const internalAuditUserId = await resolveInternalAuditUserId(supabase, companyId, {
      id: user.id,
      email: user.email ?? null,
    })

    const { data, error } = await supabase.rpc('commission_apply_order_rate_override', {
      p_company_id: companyId,
      p_order_id: parsed.orderId,
      p_new_rate: parsed.newRate,
      p_reason: parsed.reason,
      p_changed_by: internalAuditUserId,
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

export async function applyCommissionEntitlementRateOverrideAction(input: {
  entitlementId: string
  newRate: number
  reason: string
  sourceContext: string
}): Promise<ActionResult<CommissionEntitlementRateOverrideResult>> {
  try {
    const parsed = entitlementRateOverrideSchema.parse(input)
    const companyId = await getActiveCompanyId()
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      throw new Error('Usuário não autenticado.')
    }

    const internalAuditUserId = await resolveInternalAuditUserId(supabase, companyId, {
      id: user.id,
      email: user.email ?? null,
    })

    const { data, error } = await supabase.rpc('commission_apply_entitlement_rate_override', {
      p_company_id: companyId,
      p_entitlement_id: parsed.entitlementId,
      p_new_rate: parsed.newRate,
      p_reason: parsed.reason,
      p_changed_by: internalAuditUserId,
      p_source_context: parsed.sourceContext,
    })

    if (error) {
      throw new Error(error.message)
    }

    if (!data || data.length === 0) {
      throw new Error('Nenhum resultado retornado na alteração da comissão do item.')
    }

    const row = data[0]

    revalidatePath('/app/financeiro/comissoes')

    return {
      success: true,
      data: {
        entitlement_id: row.entitlement_id,
        order_id: row.order_id,
        old_rate: Number(row.old_rate || 0),
        new_rate: Number(row.new_rate || 0),
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
      error: error instanceof Error ? error.message : 'Não foi possível alterar a taxa de comissão do item.',
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
  payableDueDate: string
}): Promise<ActionResult<CommissionConfirmResult>> {
  try {
    const parsed = confirmSchema.parse(input)
    const companyId = await getActiveCompanyId()
    const supabase = await createClient()
    const resolvedRepId = await resolveCommissionRepId(supabase, companyId, parsed.repId)

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

    const internalAuditUserId = await resolveInternalAuditUserId(supabase, companyId, {
      id: user.id,
      email: user.email ?? null,
    })

    const { data, error } = await supabase.rpc('commission_confirm_settlement', {
      p_company_id: companyId,
      p_rep_id: resolvedRepId,
      p_cutoff_date: parsed.cutoffDate,
      p_allow_advance: parsed.allowAdvance,
      p_selected_items: selectedItems,
      p_total_to_pay: parsed.totalToPay,
      p_created_by: internalAuditUserId,
      p_request_key: parsed.requestKey,
    })

    if (error) {
      throw new Error(error.message)
    }

    if (!data || data.length === 0) {
      throw new Error('Não foi possível confirmar o acerto.')
    }

    const row = data[0]
    const settlementId = row.settlement_id as string
    const { data: settlementDocumentData, error: settlementDocumentError } = await supabase
      .from('commission_settlements')
      .select('document_number')
      .eq('id', settlementId)
      .eq('company_id', companyId)
      .single()

    if (settlementDocumentError) {
      throw new Error(`Acerto confirmado, mas falhou ao carregar numero: ${settlementDocumentError.message}`)
    }

    const settlementDisplayNumber = settlementDocumentData.document_number === null
      ? settlementId.slice(0, 8)
      : String(settlementDocumentData.document_number).padStart(4, '0')

    const { error: payableError } = await supabase
      .from('financial_entries')
      .upsert(
        {
          company_id: companyId,
          origin_type: 'COMMISSION_SETTLEMENT',
          origin_id: settlementId,
          kind: 'PAYABLE',
          description: `Acerto de comissão #${settlementDisplayNumber}`,
          amount: Number(row.total_paid || 0),
          due_date: parsed.payableDueDate,
          status: 'PENDENTE_DE_APROVACAO',
        },
        {
          onConflict: 'company_id,origin_type,origin_id',
          ignoreDuplicates: false,
        },
      )

    if (payableError) {
      throw new Error(`Acerto confirmado, mas falhou ao gerar conta a pagar: ${payableError.message}`)
    }

    revalidatePath('/app/financeiro/comissoes')
    revalidatePath(`/app/financeiro/comissoes/${row.settlement_id}`)
    revalidatePath('/app/financeiro/contas')

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

export async function createCommissionSettlementDraftAction(input: {
  repId: string
  cutoffDate: string
  allowAdvance: boolean
  selectedItems: CommissionSelectionPayloadItem[]
}): Promise<ActionResult<{ settlementId: string }>> {
  let cleanupDraftId: string | null = null
  let cleanupCompanyId: string | null = null

  try {
    const parsed = draftSchema.parse(input)
    const companyId = await getActiveCompanyId()
    cleanupCompanyId = companyId
    const supabase = await createClient()
    const resolvedRepId = await resolveCommissionRepId(supabase, companyId, parsed.repId)

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      throw new Error('Usuário não autenticado.')
    }

    const internalAuditUserId = await resolveInternalAuditUserId(supabase, companyId, {
      id: user.id,
      email: user.email ?? null,
    })

    const { data: draft, error: draftError } = await supabase
      .from('commission_settlements')
      .insert({
        company_id: companyId,
        rep_id: resolvedRepId,
        cutoff_date: parsed.cutoffDate,
        allow_advance: parsed.allowAdvance,
        status: 'RASCUNHO',
        total_paid: 0,
        created_by: internalAuditUserId,
      })
      .select('id')
      .single()

    if (draftError || !draft) {
      throw new Error(draftError?.message ?? 'Não foi possível criar rascunho.')
    }
    cleanupDraftId = draft.id

    const releaseIds = parsed.selectedItems
      .filter((item) => item.item_type === 'RELEASE')
      .map((item) => item.item_id)

    const entitlementIds = parsed.selectedItems
      .filter((item) => item.item_type === 'ENTITLEMENT')
      .map((item) => item.item_id)

    if (releaseIds.length > 0) {
      const { data: releases, error: releasesError } = await supabase
        .from('commission_releases')
        .select('id, commission_released_amount')
        .eq('company_id', companyId)
        .eq('rep_id', resolvedRepId)
        .is('settlement_id', null)
        .in('id', releaseIds)

      if (releasesError) {
        throw new Error(releasesError.message)
      }

      const releaseItems = (releases ?? []).map((release) => ({
        settlement_id: draft.id,
        item_type: 'RELEASE' as const,
        item_id: release.id,
        amount: Number(release.commission_released_amount || 0),
      }))

      if (releaseItems.length > 0) {
        const { error: releaseInsertError } = await supabase
          .from('commission_settlement_items')
          .insert(releaseItems)

        if (releaseInsertError) {
          throw new Error(releaseInsertError.message)
        }
      }
    }

    if (parsed.allowAdvance && entitlementIds.length > 0) {
      const { data: entitlements, error: entitlementsError } = await supabase
        .from('commission_entitlements')
        .select('id, commission_total')
        .eq('company_id', companyId)
        .eq('rep_id', resolvedRepId)
        .is('settlement_id', null)
        .in('id', entitlementIds)

      if (entitlementsError) {
        throw new Error(entitlementsError.message)
      }

      const { data: entitlementReleases, error: entitlementReleasesError } = await supabase
        .from('commission_releases')
        .select('entitlement_id, commission_released_amount')
        .eq('company_id', companyId)
        .eq('rep_id', resolvedRepId)
        .in('entitlement_id', entitlementIds)

      if (entitlementReleasesError) {
        throw new Error(entitlementReleasesError.message)
      }

      const releasedByEntitlement = new Map<string, number>()
      for (const release of entitlementReleases ?? []) {
        const previous = releasedByEntitlement.get(release.entitlement_id) ?? 0
        releasedByEntitlement.set(release.entitlement_id, previous + Number(release.commission_released_amount || 0))
      }

      const entitlementItems = (entitlements ?? [])
        .map((entitlement) => {
          const released = releasedByEntitlement.get(entitlement.id) ?? 0
          const openAmount = Number(Math.max(0, Number(entitlement.commission_total || 0) - released).toFixed(2))
          return {
            settlement_id: draft.id,
            item_type: 'ENTITLEMENT' as const,
            item_id: entitlement.id,
            amount: openAmount,
          }
        })
        .filter((item) => item.amount > 0)

      if (entitlementItems.length > 0) {
        const { error: entitlementInsertError } = await supabase
          .from('commission_settlement_items')
          .insert(entitlementItems)

        if (entitlementInsertError) {
          throw new Error(entitlementInsertError.message)
        }
      }
    }

    revalidatePath('/app/financeiro/comissoes')
    revalidatePath(`/app/financeiro/comissoes/${draft.id}`)

    return {
      success: true,
      data: {
        settlementId: draft.id,
      },
    }
  } catch (error) {
    if (cleanupDraftId && cleanupCompanyId) {
      try {
        const cleanupClient = await createClient()
        await cleanupClient
          .from('commission_settlements')
          .delete()
          .eq('id', cleanupDraftId)
          .eq('company_id', cleanupCompanyId)
          .eq('status', 'RASCUNHO')
      } catch {
        // noop: preserva erro original para o usuário
      }
    }

    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0]?.message ?? 'Dados inválidos.' }
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Não foi possível salvar rascunho de acerto.',
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
        document_number,
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

    const organizationRepNameMap = await loadRepresentativeOrganizationNamesByUserIds(
      supabase,
      companyId,
      [settlementData.rep_id],
    )
    const organizationRepName = organizationRepNameMap.get(settlementData.rep_id)
    if (organizationRepName) {
      settlementData.representative = [{ full_name: organizationRepName }]
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

    const releaseById = new Map<
      string,
      {
        order_id: string
        order_number: number | null
        customer_name: string | null
        status_logistico: string | null
        status_financeiro: string | null
        base_amount: number
        commission_rate: number
      }
    >()
    const entitlementById = new Map<
      string,
      {
        order_id: string
        order_number: number | null
        customer_name: string | null
        status_logistico: string | null
        status_financeiro: string | null
        base_amount: number
        commission_rate: number
      }
    >()

    if (releaseIds.length > 0) {
      const { data: releasesData, error: releasesError } = await supabase
        .from('commission_releases')
        .select('id, order_id, entitlement_id, base_paid_amount')
        .in('id', releaseIds)

      if (releasesError) {
        throw new Error(releasesError.message)
      }

      const releaseOrderById = await loadCommissionOrderSnapshotsByIds(
        supabase,
        companyId,
        (releasesData ?? []).map((release) => release.order_id),
      )

      const releaseEntitlementIds = (releasesData ?? []).map((release) => release.entitlement_id)
      const releaseRatesByEntitlementId = new Map<string, number>()

      if (releaseEntitlementIds.length > 0) {
        const { data: releaseEntitlements, error: releaseEntitlementsError } = await supabase
          .from('commission_entitlements')
          .select('id, commission_rate')
          .in('id', releaseEntitlementIds)

        if (releaseEntitlementsError) {
          throw new Error(releaseEntitlementsError.message)
        }

        for (const entitlement of releaseEntitlements ?? []) {
          releaseRatesByEntitlementId.set(entitlement.id, Number(entitlement.commission_rate || 0))
        }
      }

      for (const release of releasesData ?? []) {
        const order = releaseOrderById.get(release.order_id)
        releaseById.set(release.id, {
          order_id: release.order_id,
          order_number: order?.document_number ?? null,
          customer_name: order?.customer_name ?? null,
          status_logistico: order?.status_logistico ?? null,
          status_financeiro: order?.status_financeiro ?? null,
          base_amount: Number(release.base_paid_amount || 0),
          commission_rate: releaseRatesByEntitlementId.get(release.entitlement_id) ?? 0,
        })
      }
    }

    if (entitlementIds.length > 0) {
      const { data: entitlementsData, error: entitlementsError } = await supabase
        .from('commission_entitlements')
        .select('id, order_id, base_delivered_amount, commission_rate')
        .in('id', entitlementIds)

      if (entitlementsError) {
        throw new Error(entitlementsError.message)
      }

      const entitlementOrderById = await loadCommissionOrderSnapshotsByIds(
        supabase,
        companyId,
        (entitlementsData ?? []).map((entitlement) => entitlement.order_id),
      )

      for (const entitlement of entitlementsData ?? []) {
        const order = entitlementOrderById.get(entitlement.order_id)
        entitlementById.set(entitlement.id, {
          order_id: entitlement.order_id,
          order_number: order?.document_number ?? null,
          customer_name: order?.customer_name ?? null,
          status_logistico: order?.status_logistico ?? null,
          status_financeiro: order?.status_financeiro ?? null,
          base_amount: Number(entitlement.base_delivered_amount || 0),
          commission_rate: Number(entitlement.commission_rate || 0),
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
        statusLogistico: source?.status_logistico ?? null,
        statusFinanceiro: source?.status_financeiro ?? null,
        baseAmount: source?.base_amount ?? 0,
        commissionRate: source?.commission_rate ?? 0,
        commissionAmount: Number(item.amount || 0),
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
