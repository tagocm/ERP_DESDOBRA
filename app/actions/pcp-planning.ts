'use server'

import { planningService, PlanningOptions } from '@/lib/pcp/planning-service'
import { createClient } from '@/utils/supabase/server'

import { getActiveCompanyId } from "@/lib/auth/get-active-company"

type WorkOrderUpdatePayload = {
    planned_qty?: number
    scheduled_date?: string
    notes?: string
}

export async function getPlanningDataAction(startDate: string, endDate: string, options?: PlanningOptions) {
    const companyId = await getActiveCompanyId()
    await planningService.rolloverOverdueOrders(companyId)
    return await planningService.getPlanningData(companyId, startDate, endDate, options)
}

export async function generateWorkOrdersAction(payload: {
    date: string
    items: { item_id: string, qty: number, bom_id?: string, route_id?: string }[]
}) {
    const companyId = await getActiveCompanyId()
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) throw new Error("Unauthorized")

    return await planningService.generateWorkOrders(companyId, user.id, payload)
}

export async function deleteWorkOrderAction(workOrderId: string) {
    const companyId = await getActiveCompanyId()
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) throw new Error("Unauthorized")

    return await planningService.deleteWorkOrder(companyId, user.id, workOrderId)
}

export async function updateWorkOrderAction(workOrderId: string, payload: WorkOrderUpdatePayload, reason?: string) {
    const companyId = await getActiveCompanyId()
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) throw new Error("Unauthorized")

    return await planningService.updateWorkOrder(companyId, user.id, workOrderId, payload, reason)
}

export async function changeWorkOrderStatusAction(
    workOrderId: string,
    newStatus: string,
    reason?: string,
    negativeStockConfirmed?: boolean,
    negativeStockReason?: string,
    negativeStockNote?: string
) {
    const companyId = await getActiveCompanyId()
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) throw new Error("Unauthorized")

    return await planningService.changeWorkOrderStatus(
        companyId,
        user.id,
        workOrderId,
        newStatus,
        reason,
        negativeStockConfirmed,
        negativeStockReason,
        negativeStockNote
    )
}
