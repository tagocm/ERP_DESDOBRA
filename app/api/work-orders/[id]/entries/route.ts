import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { workOrdersRepo } from '@/lib/data/work-orders'
import { getActiveCompanyId } from '@/lib/auth/get-active-company'
import { errorResponse } from '@/lib/api/response'
import { logger } from '@/lib/logger'
import { createClient } from '@/utils/supabase/server'
import { productionPostingService } from '@/lib/production/production-posting-service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const createEntrySchema = z.object({
  companyId: z.string().uuid().optional(),
  produced_qty: z.number().positive(),
  executed_batches: z.number().int().positive().optional(),
  divergence_type: z.enum(['PARTIAL_EXECUTION', 'LOW_YIELD']).default('PARTIAL_EXECUTION'),
  occurred_at: z.string().datetime().optional(),
  notes: z.string().trim().max(2000).optional(),
  idempotency_key: z.string().trim().min(1).max(255).optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const body = await request.json()
    const parsed = createEntrySchema.parse(body)

    let activeCompanyId: string
    try {
      activeCompanyId = await getActiveCompanyId()
    } catch {
      return errorResponse('Unauthorized', 401)
    }

    if (parsed.companyId && parsed.companyId !== activeCompanyId) return errorResponse('Forbidden', 403)
    const companyId = activeCompanyId

    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) return errorResponse('Unauthorized', 401)

    const workOrder = await workOrdersRepo.getById(companyId, id)
    if (workOrder.status === 'cancelled') {
      return NextResponse.json({ error: 'Work order is cancelled' }, { status: 400 })
    }

    const postingResult = await productionPostingService.post({
      companyId,
      workOrderId: id,
      occurredAt: parsed.occurred_at ?? new Date().toISOString(),
      producedQty: parsed.produced_qty,
      executedBatches: parsed.executed_batches,
      divergenceType: parsed.divergence_type,
      notes: parsed.notes,
      createdBy: user.id,
      idempotencyKey: parsed.idempotency_key,
      markDone: false,
    })

    const updatedWorkOrder = await workOrdersRepo.getById(companyId, id)

    return NextResponse.json({
      work_order: updatedWorkOrder,
      posting: {
        posted: postingResult.posted,
        idempotency_key: postingResult.idempotencyKey,
        expected_output_qty: postingResult.expectedOutputQty,
        loss_qty: postingResult.lossQty,
        created_movement_count: postingResult.createdMovementCount,
      },
    })
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 })
    }
    const message = error instanceof Error ? error.message : 'Unknown error'
    logger.error('[work-orders/entries] Error', { id, message })
    return errorResponse('Internal Server Error', 500, undefined, error instanceof Error ? error.message : error)
  }
}

