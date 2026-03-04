import type { SupabaseClient } from '@supabase/supabase-js'

export type InventoryCountStatus = 'DRAFT' | 'POSTED' | 'CANCELED'
export type InventoryCountScope = 'all_controlled' | 'selected_items'
export type InventoryItemType = 'raw_material' | 'packaging' | 'wip' | 'finished_good' | 'service' | 'other'

interface InventoryMovementBalanceRow {
  item_id: string
  qty_in: number | null
  qty_out: number | null
  qty_base: number | null
}

interface InventoryCountHeaderRow {
  id: string
  company_id: string
  number: number | null
  status: InventoryCountStatus
  counted_at: string
  notes: string | null
  created_at: string
  updated_at: string
  posted_at: string | null
}

interface InventoryCountLineRow {
  id: string
  company_id: string
  inventory_count_id: string
  item_id: string
  system_qty_base: number
  counted_qty_base: number | null
  diff_qty_base: number
  notes: string | null
  updated_at: string
}

interface ItemSummaryRow {
  id: string
  sku: string | null
  name: string
  uom: string | null
  type?: string | null
}

interface ItemWithInventoryProfileRow extends ItemSummaryRow {
  inventory_profile: { control_stock: boolean } | { control_stock: boolean }[] | null
}

interface InventoryCountPostRpcResult {
  inventory_count_id: string
  inventory_count_number: number | null
  posted_items: number
  status: InventoryCountStatus
}

export interface InventoryCountItem {
  id: string
  sku: string | null
  name: string
  uom: string | null
}

export interface InventoryCountLine {
  id: string
  itemId: string
  itemSku: string | null
  itemName: string
  uom: string | null
  itemType: string | null
  systemQtyBase: number
  countedQtyBase: number | null
  diffQtyBase: number
  notes: string | null
  updatedAt: string
}

export interface InventoryCountPrintCategory {
  key: string
  label: string
  lines: InventoryCountLine[]
}

export interface InventoryCountPrintData {
  id: string
  number: number | null
  status: InventoryCountStatus
  countedAt: string
  notes: string | null
  categories: InventoryCountPrintCategory[]
  totalItems: number
}

export interface InventoryCountTotals {
  totalItems: number
  countedItems: number
  divergenceItems: number
}

export interface InventoryCountSummary {
  id: string
  number: number | null
  status: InventoryCountStatus
  countedAt: string
  notes: string | null
  createdAt: string
  postedAt: string | null
  totals: InventoryCountTotals
}

export interface InventoryCountDetail extends InventoryCountSummary {
  lines: InventoryCountLine[]
}

export interface CreateInventoryCountDraftInput {
  companyId: string
  createdBy: string | null
  countedAt?: string
  notes?: string | null
  scope: InventoryCountScope
  itemIds?: string[]
}

export interface InventoryCountLinePatch {
  id: string
  countedQtyBase?: number | null
  notes?: string | null
}

export interface UpdateInventoryCountLinesInput {
  companyId: string
  inventoryCountId: string
  patches: InventoryCountLinePatch[]
}

export interface PostInventoryCountInput {
  companyId: string
  inventoryCountId: string
  postedBy: string | null
}

function singleRelation<T>(value: T | T[] | null): T | null {
  if (!value) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

function toNumber(value: number | null | undefined): number {
  return Number(value ?? 0)
}

function normalizeCountedAt(input?: string): string {
  if (!input) {
    return new Date().toISOString()
  }

  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(input)
  const parsed = isDateOnly ? new Date(`${input}T23:59:59.999`) : new Date(input)

  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Data de inventário inválida.')
  }

  return parsed.toISOString()
}

export function calculateMovementBalance(row: Pick<InventoryMovementBalanceRow, 'qty_in' | 'qty_out' | 'qty_base'>): number {
  if (row.qty_in !== null || row.qty_out !== null) {
    return toNumber(row.qty_in) - toNumber(row.qty_out)
  }

  return toNumber(row.qty_base)
}

export function toAdjustmentQuantities(diffQtyBase: number): { qtyIn: number; qtyOut: number; qtyBase: number } {
  if (diffQtyBase > 0) {
    return { qtyIn: diffQtyBase, qtyOut: 0, qtyBase: diffQtyBase }
  }

  if (diffQtyBase < 0) {
    return { qtyIn: 0, qtyOut: Math.abs(diffQtyBase), qtyBase: diffQtyBase }
  }

  return { qtyIn: 0, qtyOut: 0, qtyBase: 0 }
}

function buildTotals(lines: InventoryCountLine[]): InventoryCountTotals {
  let countedItems = 0
  let divergenceItems = 0

  for (const line of lines) {
    if (line.countedQtyBase !== null) {
      countedItems += 1
      if (line.diffQtyBase !== 0) {
        divergenceItems += 1
      }
    }
  }

  return {
    totalItems: lines.length,
    countedItems,
    divergenceItems,
  }
}

async function getStockByItemsBase(
  supabase: SupabaseClient,
  companyId: string,
  itemIds: string[],
  asOf?: string
): Promise<Map<string, number>> {
  const stockByItem = new Map<string, number>()

  if (itemIds.length === 0) {
    return stockByItem
  }

  let query = supabase
    .from('inventory_movements')
    .select('item_id, qty_in, qty_out, qty_base')
    .eq('company_id', companyId)
    .in('item_id', itemIds)

  if (asOf) {
    query = query.lte('occurred_at', asOf)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(`Falha ao carregar saldo de estoque: ${error.message}`)
  }

  for (const row of (data ?? []) as InventoryMovementBalanceRow[]) {
    const current = stockByItem.get(row.item_id) ?? 0
    stockByItem.set(row.item_id, current + calculateMovementBalance(row))
  }

  for (const itemId of itemIds) {
    if (!stockByItem.has(itemId)) {
      stockByItem.set(itemId, 0)
    }
  }

  return stockByItem
}

export async function getItemStockBase(
  supabase: SupabaseClient,
  companyId: string,
  itemId: string,
  asOf?: string
): Promise<number> {
  const stockByItem = await getStockByItemsBase(supabase, companyId, [itemId], asOf)
  return stockByItem.get(itemId) ?? 0
}

export async function listControlledStockItems(
  supabase: SupabaseClient,
  companyId: string
): Promise<InventoryCountItem[]> {
  const { data: itemsData, error: itemsError } = await supabase
    .from('items')
    .select('id, sku, name, uom, inventory_profile:item_inventory_profiles(control_stock)')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('name')

  if (itemsError) {
    throw new Error(`Falha ao carregar itens de inventário: ${itemsError.message}`)
  }

  return (itemsData ?? []).flatMap((row) => {
    const item = row as ItemWithInventoryProfileRow
    const inventoryProfile = singleRelation(item.inventory_profile)

    // Default sem perfil: control_stock = true
    if (inventoryProfile && inventoryProfile.control_stock === false) {
      return []
    }

    return [{
      id: item.id,
      sku: item.sku,
      name: item.name,
      uom: item.uom,
    }]
  })
}

async function resolveDraftItems(
  supabase: SupabaseClient,
  companyId: string,
  scope: InventoryCountScope,
  selectedItemIds: string[]
): Promise<InventoryCountItem[]> {
  const controlledItems = await listControlledStockItems(supabase, companyId)

  if (scope === 'all_controlled') {
    return controlledItems
  }

  const selectedSet = new Set(selectedItemIds)
  return controlledItems.filter((item) => selectedSet.has(item.id))
}

export async function createInventoryCountDraft(
  supabase: SupabaseClient,
  input: CreateInventoryCountDraftInput
): Promise<InventoryCountDetail> {
  const selectedIds = Array.from(new Set(input.itemIds ?? []))
  const scopedItems = await resolveDraftItems(supabase, input.companyId, input.scope, selectedIds)

  if (scopedItems.length === 0) {
    throw new Error('Nenhum item elegível para contagem no escopo selecionado.')
  }

  const countedAt = normalizeCountedAt(input.countedAt)

  const { data: insertedCount, error: insertCountError } = await supabase
    .from('inventory_counts')
    .insert({
      company_id: input.companyId,
      counted_at: countedAt,
      notes: input.notes ?? null,
      created_by: input.createdBy,
      status: 'DRAFT',
    })
    .select('id')
    .single()

  if (insertCountError || !insertedCount) {
    throw new Error(`Falha ao criar inventário: ${insertCountError?.message ?? 'sem retorno de dados'}`)
  }

  const stockByItem = await getStockByItemsBase(
    supabase,
    input.companyId,
    scopedItems.map((item) => item.id),
    countedAt
  )

  const lineInserts = scopedItems.map((item) => ({
    company_id: input.companyId,
    inventory_count_id: insertedCount.id,
    item_id: item.id,
    system_qty_base: stockByItem.get(item.id) ?? 0,
    counted_qty_base: null,
    diff_qty_base: 0,
  }))

  const { error: insertLinesError } = await supabase
    .from('inventory_count_lines')
    .insert(lineInserts)

  if (insertLinesError) {
    throw new Error(`Falha ao criar linhas do inventário: ${insertLinesError.message}`)
  }

  return getInventoryCountDetail(supabase, input.companyId, insertedCount.id)
}

function mapLineRow(row: InventoryCountLineRow & { item: ItemSummaryRow | ItemSummaryRow[] | null }): InventoryCountLine {
  const item = singleRelation(row.item)

  return {
    id: row.id,
    itemId: row.item_id,
    itemSku: item?.sku ?? null,
    itemName: item?.name ?? 'Item sem nome',
    uom: item?.uom ?? null,
    itemType: item?.type ?? null,
    systemQtyBase: toNumber(row.system_qty_base),
    countedQtyBase: row.counted_qty_base === null ? null : toNumber(row.counted_qty_base),
    diffQtyBase: toNumber(row.diff_qty_base),
    notes: row.notes,
    updatedAt: row.updated_at,
  }
}

function mapHeaderRow(row: InventoryCountHeaderRow): Omit<InventoryCountSummary, 'totals'> {
  return {
    id: row.id,
    number: row.number,
    status: row.status,
    countedAt: row.counted_at,
    notes: row.notes,
    createdAt: row.created_at,
    postedAt: row.posted_at,
  }
}

export async function getInventoryCountDetail(
  supabase: SupabaseClient,
  companyId: string,
  inventoryCountId: string
): Promise<InventoryCountDetail> {
  const { data: headerData, error: headerError } = await supabase
    .from('inventory_counts')
    .select('id, company_id, number, status, counted_at, notes, created_at, updated_at, posted_at')
    .eq('company_id', companyId)
    .eq('id', inventoryCountId)
    .is('deleted_at', null)
    .single()

  if (headerError || !headerData) {
    throw new Error(`Inventário não encontrado: ${headerError?.message ?? 'registro ausente'}`)
  }

  const { data: linesData, error: linesError } = await supabase
    .from('inventory_count_lines')
    .select('id, company_id, inventory_count_id, item_id, system_qty_base, counted_qty_base, diff_qty_base, notes, updated_at, item:items(id, sku, name, uom, type)')
    .eq('company_id', companyId)
    .eq('inventory_count_id', inventoryCountId)
    .order('id')

  if (linesError) {
    throw new Error(`Falha ao carregar linhas do inventário: ${linesError.message}`)
  }

  const lines = (linesData ?? []).map((row) => mapLineRow(row as InventoryCountLineRow & { item: ItemSummaryRow | ItemSummaryRow[] | null }))
  const base = mapHeaderRow(headerData as InventoryCountHeaderRow)

  return {
    ...base,
    totals: buildTotals(lines),
    lines,
  }
}

export async function listInventoryCounts(
  supabase: SupabaseClient,
  companyId: string,
  filters?: { status?: InventoryCountStatus }
): Promise<InventoryCountSummary[]> {
  let query = supabase
    .from('inventory_counts')
    .select('id, company_id, number, status, counted_at, notes, created_at, updated_at, posted_at')
    .eq('company_id', companyId)
    .is('deleted_at', null)
    .order('counted_at', { ascending: false })
    .order('created_at', { ascending: false })

  if (filters?.status) {
    query = query.eq('status', filters.status)
  }

  const { data: headersData, error: headersError } = await query

  if (headersError) {
    throw new Error(`Falha ao listar inventários: ${headersError.message}`)
  }

  const headers = (headersData ?? []) as InventoryCountHeaderRow[]
  if (headers.length === 0) {
    return []
  }

  const countIds = headers.map((row) => row.id)

  const { data: linesData, error: linesError } = await supabase
    .from('inventory_count_lines')
    .select('id, company_id, inventory_count_id, item_id, system_qty_base, counted_qty_base, diff_qty_base, notes, updated_at, item:items(id, sku, name, uom)')
    .eq('company_id', companyId)
    .in('inventory_count_id', countIds)

  if (linesError) {
    throw new Error(`Falha ao carregar linhas agregadas dos inventários: ${linesError.message}`)
  }

  const linesByCountId = new Map<string, InventoryCountLine[]>()

  for (const rawRow of (linesData ?? [])) {
    const row = rawRow as InventoryCountLineRow & { item: ItemSummaryRow | ItemSummaryRow[] | null }
    const mappedLine = mapLineRow(row)
    const bucket = linesByCountId.get(row.inventory_count_id) ?? []
    bucket.push(mappedLine)
    linesByCountId.set(row.inventory_count_id, bucket)
  }

  return headers.map((header) => {
    const base = mapHeaderRow(header)
    const lines = linesByCountId.get(header.id) ?? []

    return {
      ...base,
      totals: buildTotals(lines),
    }
  })
}

export async function updateInventoryCountLines(
  supabase: SupabaseClient,
  input: UpdateInventoryCountLinesInput
): Promise<InventoryCountDetail> {
  const { data: headerData, error: headerError } = await supabase
    .from('inventory_counts')
    .select('id, status')
    .eq('company_id', input.companyId)
    .eq('id', input.inventoryCountId)
    .is('deleted_at', null)
    .single()

  if (headerError || !headerData) {
    throw new Error(`Inventário não encontrado: ${headerError?.message ?? 'registro ausente'}`)
  }

  if (headerData.status !== 'DRAFT') {
    throw new Error('Inventários já postados não podem ser editados.')
  }

  for (const patch of input.patches) {
    if (patch.countedQtyBase !== undefined && patch.countedQtyBase !== null && patch.countedQtyBase < 0) {
      throw new Error('Contagem física não pode ser negativa.')
    }

    const updatePayload: {
      counted_qty_base?: number | null
      notes?: string | null
    } = {}

    if (patch.countedQtyBase !== undefined) {
      updatePayload.counted_qty_base = patch.countedQtyBase
    }
    if (patch.notes !== undefined) {
      updatePayload.notes = patch.notes
    }

    if (Object.keys(updatePayload).length === 0) {
      continue
    }

    const { error: updateError } = await supabase
      .from('inventory_count_lines')
      .update(updatePayload)
      .eq('company_id', input.companyId)
      .eq('inventory_count_id', input.inventoryCountId)
      .eq('id', patch.id)

    if (updateError) {
      throw new Error(`Falha ao atualizar linha de inventário: ${updateError.message}`)
    }
  }

  return getInventoryCountDetail(supabase, input.companyId, input.inventoryCountId)
}

export async function postInventoryCount(
  supabase: SupabaseClient,
  input: PostInventoryCountInput
): Promise<{ detail: InventoryCountDetail; postedItems: number }> {
  const { data, error } = await supabase.rpc('post_inventory_count', {
    p_inventory_count_id: input.inventoryCountId,
    p_posted_by: input.postedBy,
  })

  if (error) {
    throw new Error(`Falha ao postar inventário: ${error.message}`)
  }

  const rpcResult = (data ?? null) as InventoryCountPostRpcResult | null
  const detail = await getInventoryCountDetail(supabase, input.companyId, input.inventoryCountId)

  return {
    detail,
    postedItems: rpcResult?.posted_items ?? 0,
  }
}

const INVENTORY_PRINT_CATEGORY_ORDER = [
  'finished_good',
  'wip',
  'packaging',
  'raw_material',
  'service',
  'other',
] as const
const INVENTORY_PRINT_CATEGORY_SET = new Set<string>(INVENTORY_PRINT_CATEGORY_ORDER)

const INVENTORY_PRINT_CATEGORY_LABELS: Record<string, string> = {
  finished_good: 'Produtos Acabados',
  wip: 'Semi-acabados',
  packaging: 'Embalagens',
  raw_material: 'Matérias-primas',
  service: 'Serviços',
  other: 'Outros',
}

function resolveInventoryPrintCategoryKey(itemType: string | null): string {
  if (!itemType) {
    return 'other'
  }

  if (INVENTORY_PRINT_CATEGORY_SET.has(itemType)) {
    return itemType
  }

  return 'other'
}

function compareLineAlphabetically(a: InventoryCountLine, b: InventoryCountLine): number {
  const byName = a.itemName.localeCompare(b.itemName, 'pt-BR', { sensitivity: 'base' })
  if (byName !== 0) {
    return byName
  }

  const skuA = a.itemSku ?? ''
  const skuB = b.itemSku ?? ''
  return skuA.localeCompare(skuB, 'pt-BR', { sensitivity: 'base' })
}

export function groupInventoryLinesForPrint(lines: InventoryCountLine[]): InventoryCountPrintCategory[] {
  const grouped = new Map<string, InventoryCountLine[]>()

  for (const line of lines) {
    const key = resolveInventoryPrintCategoryKey(line.itemType)
    const bucket = grouped.get(key) ?? []
    bucket.push(line)
    grouped.set(key, bucket)
  }

  const categories: InventoryCountPrintCategory[] = []

  for (const key of INVENTORY_PRINT_CATEGORY_ORDER) {
    const bucket = grouped.get(key)
    if (!bucket || bucket.length === 0) {
      continue
    }

    const sortedLines = [...bucket].sort(compareLineAlphabetically)
    categories.push({
      key,
      label: INVENTORY_PRINT_CATEGORY_LABELS[key],
      lines: sortedLines,
    })
  }

  for (const [key, bucket] of grouped.entries()) {
    if (INVENTORY_PRINT_CATEGORY_SET.has(key)) {
      continue
    }
    const sortedLines = [...bucket].sort(compareLineAlphabetically)
    categories.push({
      key,
      label: INVENTORY_PRINT_CATEGORY_LABELS.other,
      lines: sortedLines,
    })
  }

  return categories
}

export async function getInventoryCountPrintData(
  supabase: SupabaseClient,
  companyId: string,
  inventoryCountId: string
): Promise<InventoryCountPrintData> {
  const detail = await getInventoryCountDetail(supabase, companyId, inventoryCountId)

  return {
    id: detail.id,
    number: detail.number,
    status: detail.status,
    countedAt: detail.countedAt,
    notes: detail.notes,
    totalItems: detail.lines.length,
    categories: groupInventoryLinesForPrint(detail.lines),
  }
}
