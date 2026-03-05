import { createHash } from 'node:crypto'
import { z } from 'zod'
import { PostgrestError } from '@supabase/supabase-js'
import { supabaseServer } from '@/lib/supabase/server'
import { INVENTORY_REFERENCE_TYPES } from '@/lib/constants/inventory-ledger'

export const DIVERGENCE_TYPES = ['PARTIAL_EXECUTION', 'LOW_YIELD'] as const
export type DivergenceType = (typeof DIVERGENCE_TYPES)[number]

export interface ProductionPostingInput {
  companyId: string
  workOrderId: string
  occurredAt: string
  producedQty: number
  executedBatches?: number
  divergenceType: DivergenceType
  notes?: string
  createdBy: string
  idempotencyKey?: string
  markDone?: boolean
}

export interface ProductionConsumptionPreview {
  componentItemId: string
  qty: number
}

export interface ProductionByproductPreview {
  itemId: string
  qty: number
  basis: 'PERCENT' | 'FIXED'
}

export interface ProductionPostingPreview {
  workOrderId: string
  yieldQty: number
  producedQty: number
  executedBatches: number
  expectedOutputQty: number
  lossQty: number
  divergenceType: DivergenceType
  consumptions: ProductionConsumptionPreview[]
  byproducts: ProductionByproductPreview[]
}

export interface ProductionPostingResult {
  posted: boolean
  idempotencyKey: string
  referenceType: 'work_order'
  referenceId: string
  workOrderStatus: string
  producedTotal: number
  expectedOutputQty: number
  lossQty: number
  createdMovementCount: number
}

interface BomLinePostingRow {
  component_item_id: string
  qty: number
  loss_percent: number | null
}

interface BomByproductPostingRow {
  item_id: string
  qty: number
  basis: 'PERCENT' | 'FIXED'
}

interface WorkOrderPostingRow {
  id: string
  company_id: string
  item_id: string
  bom_id: string | null
  status: string
  planned_qty: number
  produced_qty: number
}

const workOrderPostingSchema = z.object({
  id: z.string().uuid(),
  company_id: z.string().uuid(),
  item_id: z.string().uuid(),
  bom_id: z.string().uuid().nullable(),
  status: z.string(),
  planned_qty: z.number(),
  produced_qty: z.number(),
})

const bomHeaderSchema = z.object({
  id: z.string().uuid(),
  yield_qty: z.number(),
})

const bomLineSchema = z.object({
  component_item_id: z.string().uuid(),
  qty: z.number(),
  loss_percent: z.number().nullable().optional().default(0),
})

const bomByproductSchema = z.object({
  item_id: z.string().uuid(),
  qty: z.number(),
  basis: z.enum(['PERCENT', 'FIXED']),
})

const postingResultRowSchema = z.object({
  posted: z.boolean(),
  work_order_status: z.string(),
  produced_total: z.number(),
  expected_output_qty: z.number(),
  loss_qty: z.number(),
  created_movement_count: z.number(),
})

function sanitizeNonNegative(value: number, fallback = 0): number {
  if (!Number.isFinite(value)) return fallback
  return Math.max(0, value)
}

function normalizeOccurredAt(occurredAt: string): string {
  const normalized = new Date(occurredAt)
  if (Number.isNaN(normalized.getTime())) {
    throw new Error('Data/hora de apontamento inválida.')
  }
  return normalized.toISOString()
}

function parsePostgrestErrorCode(error: PostgrestError | null): string | null {
  if (!error) return null
  return typeof error.code === 'string' ? error.code : null
}

function normalizeDivergenceType(value: string): DivergenceType {
  const normalized = value.trim().toUpperCase()
  if (normalized === 'LOW_YIELD') return 'LOW_YIELD'
  if (normalized === 'PARTIAL_EXECUTION') return 'PARTIAL_EXECUTION'
  throw new Error('Tipo de divergência inválido.')
}

export function computeExpectedOutput(executedBatches: number, yieldQty: number): number {
  const safeBatches = sanitizeNonNegative(executedBatches, 0)
  const safeYield = sanitizeNonNegative(yieldQty, 0)
  return safeBatches * safeYield
}

export function computeConsumptionsFromBOM(
  executedBatches: number,
  bomLines: ReadonlyArray<{ componentItemId: string; qtyPerBatch: number; lossPercent?: number | null }>
): ProductionConsumptionPreview[] {
  const safeBatches = sanitizeNonNegative(executedBatches, 0)
  return bomLines.map((line) => {
    const baseQty = sanitizeNonNegative(line.qtyPerBatch, 0) * safeBatches
    const lineLossPercent = sanitizeNonNegative(line.lossPercent ?? 0, 0)
    const qty = baseQty * (1 + lineLossPercent / 100)
    return {
      componentItemId: line.componentItemId,
      qty,
    }
  })
}

export function computeByproducts(
  producedQty: number,
  executedBatches: number,
  byproducts: ReadonlyArray<{ itemId: string; qty: number; basis: 'PERCENT' | 'FIXED' }>
): ProductionByproductPreview[] {
  const safeProduced = sanitizeNonNegative(producedQty, 0)
  const safeBatches = sanitizeNonNegative(executedBatches, 0)
  return byproducts.map((byproduct) => {
    if (byproduct.basis === 'PERCENT') {
      return {
        itemId: byproduct.itemId,
        qty: safeProduced * (sanitizeNonNegative(byproduct.qty, 0) / 100),
        basis: byproduct.basis,
      }
    }
    return {
      itemId: byproduct.itemId,
      qty: sanitizeNonNegative(byproduct.qty, 0) * safeBatches,
      basis: byproduct.basis,
    }
  })
}

export function buildProductionIdempotencyKey(params: {
  companyId: string
  workOrderId: string
  occurredAtIso: string
  producedQty: number
  executedBatches: number
  divergenceType: DivergenceType
}): string {
  const serialized = [
    params.companyId,
    params.workOrderId,
    params.occurredAtIso,
    params.producedQty.toFixed(6),
    String(params.executedBatches),
    params.divergenceType,
  ].join('|')

  return createHash('sha256').update(serialized).digest('hex')
}

async function fetchBomLines(companyId: string, bomId: string): Promise<BomLinePostingRow[]> {
  const queryWithLoss = await supabaseServer
    .from('bom_lines')
    .select('component_item_id, qty, loss_percent')
    .eq('company_id', companyId)
    .eq('bom_id', bomId)

  if (!queryWithLoss.error) {
    return z.array(bomLineSchema).parse(queryWithLoss.data ?? []).map((row) => ({
      component_item_id: row.component_item_id,
      qty: row.qty,
      loss_percent: row.loss_percent ?? 0,
    }))
  }

  if (parsePostgrestErrorCode(queryWithLoss.error) !== '42703') {
    throw new Error(queryWithLoss.error.message)
  }

  const fallbackQuery = await supabaseServer
    .from('bom_lines')
    .select('component_item_id, qty')
    .eq('company_id', companyId)
    .eq('bom_id', bomId)

  if (fallbackQuery.error) {
    throw new Error(fallbackQuery.error.message)
  }

  const fallbackRows = z
    .array(
      z.object({
        component_item_id: z.string().uuid(),
        qty: z.number(),
      })
    )
    .parse(fallbackQuery.data ?? [])

  return fallbackRows.map((row) => ({
    component_item_id: row.component_item_id,
    qty: row.qty,
    loss_percent: 0,
  }))
}

async function fetchPostingContext(companyId: string, workOrderId: string): Promise<{
  workOrder: WorkOrderPostingRow
  yieldQty: number
  bomLines: BomLinePostingRow[]
  byproducts: BomByproductPostingRow[]
}> {
  const workOrderQuery = await supabaseServer
    .from('work_orders')
    .select('id, company_id, item_id, bom_id, status, planned_qty, produced_qty')
    .eq('company_id', companyId)
    .eq('id', workOrderId)
    .is('deleted_at', null)
    .single()

  if (workOrderQuery.error) {
    throw new Error(workOrderQuery.error.message)
  }

  const workOrder = workOrderPostingSchema.parse(workOrderQuery.data)
  if (!workOrder.bom_id) {
    throw new Error('OP sem receita vinculada. Não é possível apontar produção.')
  }

  const bomHeaderQuery = await supabaseServer
    .from('bom_headers')
    .select('id, yield_qty')
    .eq('company_id', companyId)
    .eq('id', workOrder.bom_id)
    .is('deleted_at', null)
    .single()

  if (bomHeaderQuery.error) {
    throw new Error(bomHeaderQuery.error.message)
  }

  const bomHeader = bomHeaderSchema.parse(bomHeaderQuery.data)
  const bomLines = await fetchBomLines(companyId, workOrder.bom_id)

  const byproductsQuery = await supabaseServer
    .from('bom_byproduct_outputs')
    .select('item_id, qty, basis')
    .eq('company_id', companyId)
    .eq('bom_id', workOrder.bom_id)

  if (byproductsQuery.error) {
    throw new Error(byproductsQuery.error.message)
  }

  const byproducts = z.array(bomByproductSchema).parse(byproductsQuery.data ?? []).map((row) => ({
    item_id: row.item_id,
    qty: row.qty,
    basis: row.basis,
  }))

  return {
    workOrder,
    yieldQty: sanitizeNonNegative(bomHeader.yield_qty, 1) || 1,
    bomLines,
    byproducts,
  }
}

function defaultExecutedBatches(params: { producedQty: number; yieldQty: number }): number {
  const safeProduced = sanitizeNonNegative(params.producedQty, 0)
  const safeYield = sanitizeNonNegative(params.yieldQty, 1) || 1
  return Math.max(1, Math.ceil(safeProduced / safeYield))
}

export const productionPostingService = {
  async preview(params: {
    companyId: string
    workOrderId: string
    producedQty: number
    executedBatches?: number
    divergenceType: DivergenceType
  }): Promise<ProductionPostingPreview> {
    const safeProducedQty = sanitizeNonNegative(params.producedQty, 0)
    if (safeProducedQty <= 0) {
      throw new Error('Quantidade produzida deve ser maior que zero.')
    }

    const context = await fetchPostingContext(params.companyId, params.workOrderId)
    const executedBatches =
      params.executedBatches === undefined
        ? defaultExecutedBatches({ producedQty: safeProducedQty, yieldQty: context.yieldQty })
        : Math.max(0, Math.trunc(params.executedBatches))

    const expectedOutputQty = computeExpectedOutput(executedBatches, context.yieldQty)
    const computedLossQty = Math.max(0, expectedOutputQty - safeProducedQty)

    const lossQty = params.divergenceType === 'LOW_YIELD' ? computedLossQty : 0
    const consumptions = computeConsumptionsFromBOM(
      executedBatches,
      context.bomLines.map((line) => ({
        componentItemId: line.component_item_id,
        qtyPerBatch: line.qty,
        lossPercent: line.loss_percent,
      }))
    )
    const byproducts = computeByproducts(
      safeProducedQty,
      executedBatches,
      context.byproducts.map((row) => ({
        itemId: row.item_id,
        qty: row.qty,
        basis: row.basis,
      }))
    )

    return {
      workOrderId: params.workOrderId,
      yieldQty: context.yieldQty,
      producedQty: safeProducedQty,
      executedBatches,
      expectedOutputQty,
      lossQty,
      divergenceType: params.divergenceType,
      consumptions,
      byproducts,
    }
  },

  async post(input: ProductionPostingInput): Promise<ProductionPostingResult> {
    const occurredAtIso = normalizeOccurredAt(input.occurredAt)
    const divergenceType = normalizeDivergenceType(input.divergenceType)

    const preview = await this.preview({
      companyId: input.companyId,
      workOrderId: input.workOrderId,
      producedQty: input.producedQty,
      executedBatches: input.executedBatches,
      divergenceType,
    })

    if (preview.executedBatches <= 0) {
      throw new Error('Número de receitas executadas deve ser maior que zero.')
    }

    const idempotencyKey =
      input.idempotencyKey?.trim() ||
      buildProductionIdempotencyKey({
        companyId: input.companyId,
        workOrderId: input.workOrderId,
        occurredAtIso,
        producedQty: preview.producedQty,
        executedBatches: preview.executedBatches,
        divergenceType,
      })

    const rpc = await supabaseServer.rpc('post_work_order_entry', {
      p_company_id: input.companyId,
      p_work_order_id: input.workOrderId,
      p_occurred_at: occurredAtIso,
      p_produced_qty: preview.producedQty,
      p_executed_batches: preview.executedBatches,
      p_divergence_type: divergenceType,
      p_notes: input.notes ?? '',
      p_created_by: input.createdBy,
      p_idempotency_key: idempotencyKey,
      p_mark_done: input.markDone === true,
    })

    if (rpc.error) {
      throw new Error(rpc.error.message)
    }

    const rows = z.array(postingResultRowSchema).parse(rpc.data ?? [])
    const row = rows[0]
    if (!row) {
      throw new Error('Resposta vazia ao registrar apontamento.')
    }

    return {
      posted: row.posted,
      idempotencyKey,
      referenceType: INVENTORY_REFERENCE_TYPES.WORK_ORDER,
      referenceId: input.workOrderId,
      workOrderStatus: row.work_order_status,
      producedTotal: row.produced_total,
      expectedOutputQty: row.expected_output_qty,
      lossQty: row.loss_qty,
      createdMovementCount: row.created_movement_count,
    }
  },
}
