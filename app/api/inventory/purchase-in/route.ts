import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { inventoryRepo } from '@/lib/data/inventory'
import { getActiveCompanyId } from '@/lib/auth/get-active-company'
import { errorResponse } from '@/lib/api/response'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const purchaseInSchema = z.object({
    companyId: z.string().uuid().optional(),
    item_id: z.string().uuid(),
    qty: z.number().positive(),
    unit_cost: z.number().min(0),
    notes: z.string().optional()
})

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const parsed = purchaseInSchema.parse(body)

        let activeCompanyId: string
        try {
            activeCompanyId = await getActiveCompanyId()
        } catch {
            return errorResponse('Unauthorized', 401)
        }

        if (parsed.companyId && parsed.companyId !== activeCompanyId) return errorResponse('Forbidden', 403)

        const movement = await inventoryRepo.createPurchaseIn(activeCompanyId, {
            item_id: parsed.item_id,
            qty: parsed.qty,
            unit_cost: parsed.unit_cost,
            notes: parsed.notes
        })

        return NextResponse.json(movement, { status: 201 })
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.issues }, { status: 400 })
        }
        return errorResponse('Internal Server Error', 500, undefined, error instanceof Error ? error.message : error)
    }
}
