import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { workOrdersRepo } from '@/lib/data/work-orders'
import { bomsRepo } from '@/lib/data/boms'
import { itemsRepo } from '@/lib/data/items'
import { inventoryRepo } from '@/lib/data/inventory'

const finishSchema = z.object({
    companyId: z.string().uuid(),
    produced_qty: z.number().positive()
})

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params

    try {
        const body = await request.json()
        const parsed = finishSchema.parse(body)
        const { companyId, produced_qty } = parsed

        // 1. Get work order
        const workOrder = await workOrdersRepo.getById(companyId, id)

        // 2. Validate status
        if (workOrder.status === 'done' || workOrder.status === 'cancelled') {
            return NextResponse.json(
                { error: 'Work order is already finished or cancelled' },
                { status: 400 }
            )
        }

        // 3. Get BOM if exists
        if (!workOrder.bom_id) {
            return NextResponse.json(
                { error: 'Work order has no BOM assigned' },
                { status: 400 }
            )
        }

        const bom = await bomsRepo.getById(companyId, workOrder.bom_id)

        // 4. Calculate consumption factor
        const factor = produced_qty / bom.yield_qty

        // 5. Process each component
        let totalProductionCost = 0

        for (const line of bom.lines) {
            const consumedQty = line.qty * factor

            // Get component's current avg cost
            const component = await itemsRepo.getById(companyId, line.component_item_id)
            const componentAvgCost = component.avg_cost

            // Calculate cost
            const lineTotalCost = consumedQty * componentAvgCost
            totalProductionCost += lineTotalCost

            // Create production_out movement
            await inventoryRepo.createMovement(companyId, {
                item_id: line.component_item_id,
                qty_in: 0,
                qty_out: consumedQty,
                unit_cost: componentAvgCost,
                total_cost: lineTotalCost,
                reason: 'production_out',
                ref_type: 'work_order',
                ref_id: id,
                notes: `Consumo OP #${id.substring(0, 8)}`
            })
        }

        // 6. Calculate unit cost of produced item
        const unitCostProduced = totalProductionCost / produced_qty

        // 7. Create production_in movement for finished good
        await inventoryRepo.createMovement(companyId, {
            item_id: workOrder.item_id,
            qty_in: produced_qty,
            qty_out: 0,
            unit_cost: unitCostProduced,
            total_cost: totalProductionCost,
            reason: 'production_in',
            ref_type: 'work_order',
            ref_id: id,
            notes: `Produção OP #${id.substring(0, 8)}`
        })

        // 8. Update finished good's avg cost
        const currentStock = await inventoryRepo.getStock(companyId, workOrder.item_id)
        const finishedItem = await itemsRepo.getById(companyId, workOrder.item_id)

        await inventoryRepo.recalcAvgCost(
            companyId,
            workOrder.item_id,
            currentStock - produced_qty, // stock before this production
            finishedItem.avg_cost,
            produced_qty,
            unitCostProduced
        )

        // 9. Update work order
        const updatedWorkOrder = await workOrdersRepo.updateStatus(
            companyId,
            id,
            'done',
            {
                produced_qty,
                finished_at: new Date().toISOString()
            }
        )

        return NextResponse.json({
            work_order: updatedWorkOrder,
            production_cost: {
                total: totalProductionCost,
                unit: unitCostProduced,
                qty: produced_qty
            }
        })
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.issues }, { status: 400 })
        }
        console.error('Error finishing work order:', error)
        return NextResponse.json(
            { error: error.message || 'Internal Server Error' },
            { status: 500 }
        )
    }
}
