'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { getActiveCompanyId } from '@/lib/auth/get-active-company'
import {
  createInventoryCountDraft,
  getInventoryCountDetail,
  listControlledStockItems,
  listInventoryCounts,
  postInventoryCount,
  type CreateInventoryCountDraftInput,
  type InventoryCountLinePatch,
  type InventoryCountStatus,
  updateInventoryCountLines,
} from '@/lib/inventory/inventory-counts'

async function resolveAuditUserId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  authUserId: string | null
): Promise<string | null> {
  if (!authUserId) {
    return null
  }

  const { data, error } = await supabase
    .from('user_profiles')
    .select('auth_user_id')
    .eq('auth_user_id', authUserId)
    .maybeSingle()

  if (error) {
    return null
  }

  return data?.auth_user_id ?? null
}

export async function listInventoryCountsAction(filters?: { status?: InventoryCountStatus }) {
  const companyId = await getActiveCompanyId()
  const supabase = await createClient()

  return listInventoryCounts(supabase, companyId, filters)
}

export async function listControlledStockItemsAction() {
  const companyId = await getActiveCompanyId()
  const supabase = await createClient()

  return listControlledStockItems(supabase, companyId)
}

export async function createInventoryCountDraftAction(input: {
  countedAt?: string
  notes?: string | null
  scope: CreateInventoryCountDraftInput['scope']
  itemIds?: string[]
}) {
  const companyId = await getActiveCompanyId()
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Unauthorized')
  }

  const auditUserId = await resolveAuditUserId(supabase, user.id)

  const result = await createInventoryCountDraft(supabase, {
    companyId,
    createdBy: auditUserId,
    countedAt: input.countedAt,
    notes: input.notes,
    scope: input.scope,
    itemIds: input.itemIds,
  })

  revalidatePath('/app/estoque/inventarios')
  return result
}

export async function getInventoryCountDetailAction(inventoryCountId: string) {
  const companyId = await getActiveCompanyId()
  const supabase = await createClient()

  return getInventoryCountDetail(supabase, companyId, inventoryCountId)
}

export async function updateInventoryCountLinesAction(inventoryCountId: string, patches: InventoryCountLinePatch[]) {
  const companyId = await getActiveCompanyId()
  const supabase = await createClient()

  const result = await updateInventoryCountLines(supabase, {
    companyId,
    inventoryCountId,
    patches,
  })

  revalidatePath(`/app/estoque/inventarios/${inventoryCountId}`)
  revalidatePath('/app/estoque/inventarios')

  return result
}

export async function postInventoryCountAction(inventoryCountId: string) {
  const companyId = await getActiveCompanyId()
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Unauthorized')
  }

  const auditUserId = await resolveAuditUserId(supabase, user.id)

  const result = await postInventoryCount(supabase, {
    companyId,
    inventoryCountId,
    postedBy: auditUserId,
  })

  revalidatePath(`/app/estoque/inventarios/${inventoryCountId}`)
  revalidatePath('/app/estoque/inventarios')
  revalidatePath('/app/estoque/movimentacoes')

  return result
}
