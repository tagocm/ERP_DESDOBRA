import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { inventoryRepo } from '@/lib/data/inventory'

const purchaseInSchema = z.object({
    companyId: z.string().uuid(),
    item_id: z.string().uuid(),
    qty: z.number().positive(),
    unit_cost: z.number().min(0),
    notes: z.string().optional()
})

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const parsed = purchaseInSchema.parse(body)

        const movement = await inventoryRepo.createPurchaseIn(parsed.companyId, {
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
        return NextResponse.json(
            { error: error.message || 'Internal Server Error' },
            { status: 500 }
        )
    }
}
