import { SupabaseClient } from '@supabase/supabase-js'
import { Database, Json } from '@/types/supabase'
import {
  computeDependencyBatchPlan,
  computeRequiredComponentQty,
  isPositive,
} from '@/lib/pcp/work-order-dependency-rules'

type SupabaseDB = SupabaseClient<Database>

type BomHeaderRow = Database['public']['Tables']['bom_headers']['Row']
type BomLineRow = Database['public']['Tables']['bom_lines']['Row']
type ItemRow = Database['public']['Tables']['items']['Row']
type ItemProductionProfileRow = Database['public']['Tables']['item_production_profiles']['Row']
type ProductionSectorRow = Database['public']['Tables']['production_sectors']['Row']
type ProductionProfileLegacyRow = Omit<ItemProductionProfileRow, 'default_sector_id'> & {
  default_sector_id?: string | null
}

type BomLineWithComponent = Pick<BomLineRow, 'component_item_id' | 'qty' | 'uom'> & {
  component: (Pick<ItemRow, 'id' | 'name' | 'type' | 'uom'> & {
    uoms: { abbrev: string } | null
  }) | Array<Pick<ItemRow, 'id' | 'name' | 'type' | 'uom'> & { uoms: { abbrev: string } | null }> | null
}
type ComponentProjection = Pick<ItemRow, 'id' | 'name' | 'type' | 'uom'> & { uoms: { abbrev: string } | null }

interface StockMovementRow {
  item_id: string
  qty_in: number | null
  qty_out: number | null
}

interface RpcCreateWorkOrdersResult {
  parent_work_order_id?: string
  child_work_order_ids?: unknown
}

interface CreatedWorkOrderNumberRow {
  id: string
  document_number: number | null
}

export interface WorkOrderDependencyWarning {
  code: 'FINISHED_GOOD_WITH_RAW_MATERIAL'
  message: string
  itemNames: string[]
}

export interface WorkOrderDependencyPreviewRow {
  componentItemId: string
  componentName: string
  componentUom: string
  requiredQty: number
  availableQty: number
  missingQty: number
  childBomId: string
  childYieldQty: number
  childYieldUom: string
  lossPercent: number
  effectiveYield: number
  suggestedBatches: number
  suggestedPlannedQty: number
  suggestedSectorId: string | null
  suggestedSectorName: string | null
}

export interface WorkOrderDependencyPreviewResult {
  itemId: string
  bomId: string
  plannedQty: number
  shouldPromptDependencies: boolean
  warnings: WorkOrderDependencyWarning[]
  dependencies: WorkOrderDependencyPreviewRow[]
  suggestedParentSectorId: string | null
  suggestedParentSectorName: string | null
}

export interface DependencyPreviewComputationInput {
  componentItemId: string
  componentName: string
  componentUom: string
  plannedQty: number
  parentBomYieldQty: number
  lineQty: number
  availableQty: number
  childBomId: string
  childYieldQty: number
  childYieldUom: string
  lossPercent: number | null
  suggestedSectorId: string | null
  suggestedSectorName: string | null
}

export interface WorkOrderDependencySelectionInput {
  componentItemId: string
  generateChild: boolean
  sectorId?: string | null
  notes?: string | null
}

export interface CreateWorkOrderWithDependenciesInput {
  companyId: string
  itemId: string
  bomId: string
  plannedQty: number
  scheduledDate: string
  notes?: string | null
  parentSectorId?: string | null
  dependencySelections?: WorkOrderDependencySelectionInput[]
}

export interface CreateWorkOrderWithDependenciesResult {
  parentWorkOrderId: string
  parentWorkOrderNumber: number | null
  childWorkOrderIds: string[]
  childWorkOrderNumbers: Array<{ id: string; documentNumber: number | null }>
  createdChildrenCount: number
  warnings: WorkOrderDependencyWarning[]
}

interface ChildWorkOrderRpcPayload {
  [key: string]: Json | undefined
  item_id: string
  bom_id: string
  planned_qty: number
  scheduled_date: string
  notes: string | null
  sector_id: string | null
}

interface ActiveSectorValidationInput {
  activeSectors: Array<Pick<ProductionSectorRow, 'id' | 'code' | 'name'>>
  parentSectorId: string | null | undefined
  childSectorIds: string[]
}

type ActiveSectorValidationResult = { valid: true } | { valid: false; message: string }

export function computeDependencyPreviewRow(
  input: DependencyPreviewComputationInput
): WorkOrderDependencyPreviewRow | null {
  const requiredQty = computeRequiredComponentQty(
    Number(input.plannedQty),
    Number(input.lineQty),
    Number(input.parentBomYieldQty)
  )

  const batchPlan = computeDependencyBatchPlan({
    requiredQty,
    availableQty: Number(input.availableQty),
    yieldQty: Number(input.childYieldQty),
    lossPercent: input.lossPercent,
  })

  if (!isPositive(batchPlan.missingQty)) {
    return null
  }

  return {
    componentItemId: input.componentItemId,
    componentName: input.componentName,
    componentUom: input.componentUom,
    requiredQty,
    availableQty: Number(input.availableQty),
    missingQty: batchPlan.missingQty,
    childBomId: input.childBomId,
    childYieldQty: Number(input.childYieldQty),
    childYieldUom: input.childYieldUom,
    lossPercent: Number(input.lossPercent ?? 0),
    effectiveYield: batchPlan.effectiveYield,
    suggestedBatches: batchPlan.suggestedBatches,
    suggestedPlannedQty: batchPlan.plannedQty,
    suggestedSectorId: input.suggestedSectorId,
    suggestedSectorName: input.suggestedSectorName,
  }
}

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase()
}

function singleRelation<T>(value: T | T[] | null): T | null {
  if (!value) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

function resolveUom(item: Pick<ItemRow, 'uom'> & { uoms?: { abbrev: string } | null }): string {
  return item.uoms?.abbrev ?? item.uom ?? 'UN'
}

function isNonEmptyString(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function resolveParentSector(sectors: ProductionSectorRow[]): ProductionSectorRow | null {
  const withNormalized = sectors.map((sector) => ({
    sector,
    code: normalizeText(sector.code),
    name: normalizeText(sector.name),
  }))

  return (
    withNormalized.find(({ code }) => code === 'ENVASE')?.sector ??
    withNormalized.find(({ name }) => name.includes('ENVASE'))?.sector ??
    null
  )
}

function resolveChildSector(sectors: ProductionSectorRow[]): ProductionSectorRow | null {
  const withNormalized = sectors.map((sector) => ({
    sector,
    code: normalizeText(sector.code),
    name: normalizeText(sector.name),
  }))

  return (
    withNormalized.find(({ code }) => code === 'PRODUCAO_GRANOLA')?.sector ??
    withNormalized.find(({ name }) => name.includes('PRODUCAO') && name.includes('GRANOLA'))?.sector ??
    withNormalized.find(({ name }) => name.includes('PRODUCAO'))?.sector ??
    null
  )
}

async function getActiveSectors(supabase: SupabaseDB, companyId: string): Promise<ProductionSectorRow[]> {
  const { data, error } = await supabase
    .from('production_sectors')
    .select('*')
    .eq('company_id', companyId)
    .is('deleted_at', null)
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (error) {
    throw new Error(`Falha ao buscar setores de produção: ${error.message}`)
  }

  return data ?? []
}

async function getProducedProfilesByItemIds(
  supabase: SupabaseDB,
  companyId: string,
  itemIds: string[]
): Promise<ProductionProfileLegacyRow[]> {
  if (itemIds.length === 0) {
    return []
  }

  const withDefaultSector = await supabase
    .from('item_production_profiles')
    .select('item_id, is_produced, batch_size, loss_percent, default_bom_id, default_sector_id')
    .eq('company_id', companyId)
    .in('item_id', itemIds)
    .eq('is_produced', true)

  if (!withDefaultSector.error) {
    return (withDefaultSector.data ?? []) as ProductionProfileLegacyRow[]
  }

  const missingDefaultSectorColumn =
    withDefaultSector.error.message.includes('default_sector_id') &&
    withDefaultSector.error.message.toLowerCase().includes('does not exist')

  if (!missingDefaultSectorColumn) {
    throw new Error(`Falha ao buscar perfis de produção de dependências: ${withDefaultSector.error.message}`)
  }

  const legacyQuery = await supabase
    .from('item_production_profiles')
    .select('item_id, is_produced, batch_size, loss_percent, default_bom_id')
    .eq('company_id', companyId)
    .in('item_id', itemIds)
    .eq('is_produced', true)

  if (legacyQuery.error) {
    throw new Error(`Falha ao buscar perfis de produção de dependências: ${legacyQuery.error.message}`)
  }

  return ((legacyQuery.data ?? []) as Omit<ProductionProfileLegacyRow, 'default_sector_id'>[]).map((profile) => ({
    ...profile,
    default_sector_id: null,
  }))
}

export function validateActiveSectorIds(input: ActiveSectorValidationInput): ActiveSectorValidationResult {
  const parentSectorId = input.parentSectorId?.trim() ?? ''
  if (!parentSectorId) {
    return {
      valid: false,
      message: 'Selecione um setor de produção ativo para criar a OP.',
    }
  }

  const activeSectorIds = new Set(input.activeSectors.map((sector) => sector.id))
  if (!activeSectorIds.has(parentSectorId)) {
    return {
      valid: false,
      message: 'Selecione um setor de produção ativo para criar a OP.',
    }
  }

  const invalidChildSectorIds = Array.from(new Set(input.childSectorIds)).filter(
    (sectorId) => !activeSectorIds.has(sectorId)
  )

  if (invalidChildSectorIds.length > 0) {
    return {
      valid: false,
      message: 'Uma ou mais OPs filhas possuem setor inválido ou inativo.',
    }
  }

  return { valid: true }
}

async function getCurrentStockByItemIds(
  supabase: SupabaseDB,
  companyId: string,
  itemIds: string[]
): Promise<Map<string, number>> {
  if (itemIds.length === 0) {
    return new Map<string, number>()
  }

  const { data, error } = await supabase
    .from('inventory_movements')
    .select('item_id, qty_in, qty_out')
    .eq('company_id', companyId)
    .in('item_id', itemIds)

  if (error) {
    throw new Error(`Falha ao calcular estoque atual por movimentações: ${error.message}`)
  }

  const rows = (data ?? []) as StockMovementRow[]
  const stockByItemId = new Map<string, number>()

  for (const row of rows) {
    const current = stockByItemId.get(row.item_id) ?? 0
    const qtyIn = Number(row.qty_in ?? 0)
    const qtyOut = Number(row.qty_out ?? 0)
    stockByItemId.set(row.item_id, current + qtyIn - qtyOut)
  }

  return stockByItemId
}

function extractWarnings(parentItem: Pick<ItemRow, 'type'>, lines: BomLineWithComponent[]): WorkOrderDependencyWarning[] {
  if (parentItem.type !== 'finished_good') {
    return []
  }

  const rawMaterialItems = lines
    .map((line) => singleRelation<ComponentProjection>(line.component))
    .filter((component): component is ComponentProjection => Boolean(component))
    .filter((component) => component.type === 'raw_material')
    .map((component) => component.name)

  if (rawMaterialItems.length === 0) {
    return []
  }

  return [
    {
      code: 'FINISHED_GOOD_WITH_RAW_MATERIAL',
      message:
        'Receita de produto acabado contém matéria-prima direta. Recomenda-se modelar produção no WIP e manter no acabado apenas WIP + embalagem.',
      itemNames: Array.from(new Set(rawMaterialItems)).sort(),
    },
  ]
}

export const workOrderDependenciesService = {
  async preview(
    supabase: SupabaseDB,
    companyId: string,
    input: { itemId: string; bomId: string; plannedQty: number }
  ): Promise<WorkOrderDependencyPreviewResult> {
    if (!isPositive(input.plannedQty)) {
      throw new Error('Quantidade planejada deve ser maior que zero.')
    }

    const [{ data: parentItem, error: parentItemError }, { data: parentBom, error: parentBomError }] =
      await Promise.all([
        supabase
          .from('items')
          .select('id, name, type, uom, uoms(abbrev)')
          .eq('company_id', companyId)
          .eq('id', input.itemId)
          .is('deleted_at', null)
          .single(),
        supabase
          .from('bom_headers')
          .select('id, item_id, yield_qty, yield_uom')
          .eq('company_id', companyId)
          .eq('id', input.bomId)
          .is('deleted_at', null)
          .single(),
      ])

    if (parentItemError || !parentItem) {
      throw new Error(parentItemError?.message ?? 'Item da OP não encontrado.')
    }

    if (parentBomError || !parentBom) {
      throw new Error(parentBomError?.message ?? 'Receita selecionada não encontrada.')
    }

    if (parentBom.item_id !== input.itemId) {
      throw new Error('A receita selecionada não pertence ao item informado.')
    }

    const parentBomYield = Number(parentBom.yield_qty)
    if (!isPositive(parentBomYield)) {
      throw new Error('Receita principal sem yield_qty válido.')
    }

    const { data: bomLinesData, error: bomLinesError } = await supabase
      .from('bom_lines')
      .select(
        'component_item_id, qty, uom, component:items!bom_lines_component_item_id_fkey(id, name, type, uom, uoms(abbrev))'
      )
      .eq('company_id', companyId)
      .eq('bom_id', input.bomId)
      .order('sort_order', { ascending: true })

    if (bomLinesError) {
      throw new Error(`Falha ao buscar componentes da receita: ${bomLinesError.message}`)
    }

    const bomLines = (bomLinesData ?? []) as BomLineWithComponent[]
    const warnings = extractWarnings(parentItem, bomLines)

    const componentItemIds = Array.from(
      new Set(
        bomLines
          .map((line) => line.component_item_id)
          .filter((itemId): itemId is string => Boolean(itemId))
      )
    )

    if (componentItemIds.length === 0) {
      const sectors = await getActiveSectors(supabase, companyId)
      const parentSector = resolveParentSector(sectors)
      return {
        itemId: input.itemId,
        bomId: input.bomId,
        plannedQty: input.plannedQty,
        shouldPromptDependencies: false,
        warnings,
        dependencies: [],
        suggestedParentSectorId: parentSector?.id ?? null,
        suggestedParentSectorName: parentSector?.name ?? null,
      }
    }

    const [profilesData, sectors] = await Promise.all([
      getProducedProfilesByItemIds(supabase, companyId, componentItemIds),
      getActiveSectors(supabase, companyId),
    ])

    const producedProfiles = profilesData as ProductionProfileLegacyRow[]
    const profileByItemId = new Map(producedProfiles.map((profile) => [profile.item_id, profile]))

    const producedItemIds = Array.from(profileByItemId.keys())
    if (producedItemIds.length === 0) {
      const parentSector = resolveParentSector(sectors)
      return {
        itemId: input.itemId,
        bomId: input.bomId,
        plannedQty: input.plannedQty,
        shouldPromptDependencies: false,
        warnings,
        dependencies: [],
        suggestedParentSectorId: parentSector?.id ?? null,
        suggestedParentSectorName: parentSector?.name ?? null,
      }
    }

    const [stockByItemId, activeChildBomsResult] = await Promise.all([
      getCurrentStockByItemIds(supabase, companyId, producedItemIds),
      supabase
        .from('bom_headers')
        .select('id, item_id, yield_qty, yield_uom, version, is_active')
        .eq('company_id', companyId)
        .is('deleted_at', null)
        .eq('is_active', true)
        .in('item_id', producedItemIds)
        .order('item_id', { ascending: true })
        .order('version', { ascending: false }),
    ])

    if (activeChildBomsResult.error) {
      throw new Error(`Falha ao buscar receitas ativas de dependências: ${activeChildBomsResult.error.message}`)
    }

    const activeChildBoms = (activeChildBomsResult.data ?? []) as BomHeaderRow[]
    const activeChildBomByItemId = new Map<string, BomHeaderRow>()
    for (const bom of activeChildBoms) {
      if (!activeChildBomByItemId.has(bom.item_id)) {
        activeChildBomByItemId.set(bom.item_id, bom)
      }
    }

    const defaultBomIds = Array.from(
      new Set(
        producedProfiles
          .map((profile) => profile.default_bom_id)
          .filter((bomId): bomId is string => Boolean(bomId))
      )
    )

    const defaultBomById = new Map<string, BomHeaderRow>()
    if (defaultBomIds.length > 0) {
      const { data: defaultBomsData, error: defaultBomsError } = await supabase
        .from('bom_headers')
        .select('id, item_id, yield_qty, yield_uom, version, is_active')
        .eq('company_id', companyId)
        .is('deleted_at', null)
        .in('id', defaultBomIds)

      if (defaultBomsError) {
        throw new Error(`Falha ao buscar receita padrão das dependências: ${defaultBomsError.message}`)
      }

      for (const bom of defaultBomsData ?? []) {
        defaultBomById.set(bom.id, bom as BomHeaderRow)
      }
    }

    const activeSectorById = new Map(sectors.map((sector) => [sector.id, sector]))
    const childSector = resolveChildSector(sectors)
    const parentSector = resolveParentSector(sectors)

    const dependencies: WorkOrderDependencyPreviewRow[] = []

    for (const line of bomLines) {
      const profile = profileByItemId.get(line.component_item_id)
      if (!profile) {
        continue
      }

      const component = singleRelation(line.component)
      if (!component) {
        continue
      }

      const availableQty = stockByItemId.get(line.component_item_id) ?? 0

      const childBom =
        activeChildBomByItemId.get(line.component_item_id) ??
        (profile.default_bom_id ? defaultBomById.get(profile.default_bom_id) : undefined)

      const yieldQtyCandidate =
        childBom && isPositive(Number(childBom.yield_qty))
          ? Number(childBom.yield_qty)
          : Number(profile.batch_size ?? 0)

      if (!isPositive(yieldQtyCandidate)) {
        throw new Error(
          `Item produzido ${component.name} não possui yield_qty/batch_size configurado para arredondamento de receita.`
        )
      }

      if (!childBom?.id) {
        throw new Error(`Item produzido ${component.name} não possui BOM ativo para gerar OP filha.`)
      }

      const profileDefaultSector = profile.default_sector_id
        ? activeSectorById.get(profile.default_sector_id) ?? null
        : null
      const suggestedSector = profileDefaultSector ?? childSector

      const dependencyPreviewRow = computeDependencyPreviewRow({
        componentItemId: line.component_item_id,
        componentName: component.name,
        componentUom: resolveUom(component),
        plannedQty: Number(input.plannedQty),
        parentBomYieldQty: parentBomYield,
        lineQty: Number(line.qty),
        availableQty,
        childBomId: childBom.id,
        childYieldQty: yieldQtyCandidate,
        childYieldUom: childBom.yield_uom || resolveUom(component),
        lossPercent: profile.loss_percent,
        suggestedSectorId: suggestedSector?.id ?? null,
        suggestedSectorName: suggestedSector?.name ?? null,
      })

      if (dependencyPreviewRow) {
        dependencies.push(dependencyPreviewRow)
      }
    }

    dependencies.sort((a, b) => b.missingQty - a.missingQty)

    return {
      itemId: input.itemId,
      bomId: input.bomId,
      plannedQty: input.plannedQty,
      shouldPromptDependencies: dependencies.length > 0,
      warnings,
      dependencies,
      suggestedParentSectorId: parentSector?.id ?? null,
      suggestedParentSectorName: parentSector?.name ?? null,
    }
  },

  async create(
    supabase: SupabaseDB,
    input: CreateWorkOrderWithDependenciesInput
  ): Promise<CreateWorkOrderWithDependenciesResult> {
    if (!isPositive(input.plannedQty)) {
      throw new Error('Quantidade planejada deve ser maior que zero.')
    }

    const activeSectors = await getActiveSectors(supabase, input.companyId)
    const explicitChildSectorIds = (input.dependencySelections ?? []).flatMap((selection) => {
      if (selection.generateChild && isNonEmptyString(selection.sectorId)) {
        return [selection.sectorId]
      }
      return []
    })

    const validation = validateActiveSectorIds({
      activeSectors,
      parentSectorId: input.parentSectorId,
      childSectorIds: explicitChildSectorIds,
    })
    if (!validation.valid) {
      throw new Error(validation.message)
    }

    const activeSectorIds = new Set(activeSectors.map((sector) => sector.id))
    const normalizedParentSectorId = input.parentSectorId?.trim() ?? ''

    const preview = await this.preview(supabase, input.companyId, {
      itemId: input.itemId,
      bomId: input.bomId,
      plannedQty: input.plannedQty,
    })

    const selectionMap = new Map(
      (input.dependencySelections ?? []).map((selection) => [selection.componentItemId, selection])
    )

    const childrenPayload: ChildWorkOrderRpcPayload[] = preview.dependencies
      .filter((dependency) => {
        const selection = selectionMap.get(dependency.componentItemId)
        return selection ? selection.generateChild : true
      })
      .map((dependency) => {
        const selection = selectionMap.get(dependency.componentItemId)
        const resolvedChildSectorId = selection?.sectorId ?? dependency.suggestedSectorId
        if (!resolvedChildSectorId) {
          throw new Error(`Selecione um setor de produção ativo para a OP filha de ${dependency.componentName}.`)
        }
        if (!activeSectorIds.has(resolvedChildSectorId)) {
          throw new Error(`Setor inválido ou inativo para a OP filha de ${dependency.componentName}.`)
        }

        return {
          item_id: dependency.componentItemId,
          bom_id: dependency.childBomId,
          planned_qty: dependency.suggestedPlannedQty,
          scheduled_date: input.scheduledDate,
          notes: selection?.notes ?? null,
          sector_id: resolvedChildSectorId,
        }
      })

    const { data, error } = await supabase.rpc('create_work_orders_with_dependencies', {
      p_company_id: input.companyId,
      p_parent_item_id: input.itemId,
      p_parent_bom_id: input.bomId,
      p_parent_planned_qty: input.plannedQty,
      p_parent_scheduled_date: input.scheduledDate,
      p_parent_notes: input.notes ?? undefined,
      p_parent_sector_id: normalizedParentSectorId,
      p_children: childrenPayload,
    })

    if (error) {
      throw new Error(`Falha ao criar ordens de produção: ${error.message}`)
    }

    const parsed = (data ?? {}) as RpcCreateWorkOrdersResult
    const parentWorkOrderId = parsed.parent_work_order_id

    if (!parentWorkOrderId || typeof parentWorkOrderId !== 'string') {
      throw new Error('Falha ao criar OP: retorno inválido da função transacional.')
    }

    const childWorkOrderIds = Array.isArray(parsed.child_work_order_ids)
      ? parsed.child_work_order_ids.filter((id): id is string => typeof id === 'string')
      : []

    const allCreatedIds = [parentWorkOrderId, ...childWorkOrderIds]
    const { data: createdRows, error: createdRowsError } = await supabase
      .from('work_orders')
      .select('id, document_number')
      .eq('company_id', input.companyId)
      .in('id', allCreatedIds)

    if (createdRowsError) {
      throw new Error(`Falha ao carregar numeracao das OPs criadas: ${createdRowsError.message}`)
    }

    const numberById = new Map<string, number | null>()
    for (const row of (createdRows ?? []) as CreatedWorkOrderNumberRow[]) {
      numberById.set(row.id, row.document_number)
    }

    return {
      parentWorkOrderId,
      parentWorkOrderNumber: numberById.get(parentWorkOrderId) ?? null,
      childWorkOrderIds,
      childWorkOrderNumbers: childWorkOrderIds.map((id) => ({
        id,
        documentNumber: numberById.get(id) ?? null,
      })),
      createdChildrenCount: childWorkOrderIds.length,
      warnings: preview.warnings,
    }
  },
}
