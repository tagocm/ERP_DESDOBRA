'use server'

import { getActiveCompanyId } from '@/lib/auth/get-active-company'
import { logger } from '@/lib/logger'
import { createClient } from '@/utils/supabase/server'
import { purchasesRepository } from '@/lib/purchases/purchases-db'
import type { Json } from '@/types/supabase'

export async function listPurchaseOrdersAction(filters?: {
    status?: string
    supplier_id?: string
    from_date?: string
    to_date?: string
}) {
    const companyId = await getActiveCompanyId()
    return await purchasesRepository.listPurchaseOrders(companyId, filters)
}

export async function getPurchaseOrderByIdAction(purchaseOrderId: string) {
    const companyId = await getActiveCompanyId()
    return await purchasesRepository.getPurchaseOrderById(companyId, purchaseOrderId)
}

export async function createPurchaseOrderAction(data: {
    supplier_id?: string | null
    expected_at?: string | null
    notes?: string | null
    payment_terms_id?: string | null
    payment_mode_id?: string | null
    price_table_id?: string | null
    freight_amount?: number
    discount_amount?: number
    subtotal_amount?: number
    total_amount?: number
    total_weight_kg?: number
    total_gross_weight_kg?: number
    delivery_address_json?: Json
    items: Array<{
        item_id: string
        qty_display: number
        uom_label: string
        conversion_factor: number
        unit_cost?: number | null
        notes?: string | null
    }>
}) {
    const companyId = await getActiveCompanyId()
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) throw new Error('Unauthorized')

    return await purchasesRepository.createPurchaseOrder(companyId, user.id, data)
}

export async function updatePurchaseOrderAction(
    purchaseOrderId: string,
    data: {
        supplier_id?: string | null
        expected_at?: string | null
        notes?: string | null
        payment_terms_id?: string | null
        payment_mode_id?: string | null
        price_table_id?: string | null
        freight_amount?: number
        discount_amount?: number
        subtotal_amount?: number
        total_amount?: number
        total_weight_kg?: number
        total_gross_weight_kg?: number
        delivery_address_json?: Json
        items?: Array<{
            id?: string
            item_id: string
            qty_display: number
            uom_label: string
            conversion_factor: number
            unit_cost?: number | null
            notes?: string | null
        }>
    }
) {
    const companyId = await getActiveCompanyId()
    return await purchasesRepository.updatePurchaseOrder(companyId, purchaseOrderId, data)
}

export async function receivePurchaseOrderAction(
    purchaseOrderId: string,
    receiptData?: {
        supplier_invoice_number: string
        supplier_invoice_series?: string
        supplier_invoice_date?: string
        payment_terms_id?: string
        payment_mode_id?: string
        generate_financial?: boolean
        receipt_notes?: string
        received_at?: string
    }
) {
    // Force reload check
    const companyId = await getActiveCompanyId()
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) throw new Error('Unauthorized')

    return await purchasesRepository.receivePurchaseOrder(companyId, user.id, purchaseOrderId, receiptData)
}

export async function cancelPurchaseOrderAction(purchaseOrderId: string, reason?: string) {
    const companyId = await getActiveCompanyId()
    return await purchasesRepository.cancelPurchaseOrder(companyId, purchaseOrderId)
}

export async function archivePurchaseOrderAction(purchaseOrderId: string, reason: string) {
    const companyId = await getActiveCompanyId()
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) throw new Error('Unauthorized')

    return await purchasesRepository.archivePurchaseOrder(companyId, user.id, purchaseOrderId, reason)
}

export async function sendPurchaseOrderAction(purchaseOrderId: string) {
    const companyId = await getActiveCompanyId()
    return await purchasesRepository.sendPurchaseOrder(companyId, purchaseOrderId)
}

// BATCH ACTIONS

export async function sendPurchaseOrderBatchAction(ids: string[]) {
    const companyId = await getActiveCompanyId()
    let successCount = 0
    let failureCount = 0

    for (const id of ids) {
        try {
            await purchasesRepository.sendPurchaseOrder(companyId, id)
            successCount++
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Unknown error'
            logger.warn('[purchases] Failed to send PO', { id, message })
            failureCount++
        }
    }

    return {
        data: {
            success: true,
            sent: successCount,
            skipped: failureCount
        }
    }
}

export async function receivePurchaseOrderBatchAction(ids: string[]) {
    const companyId = await getActiveCompanyId()
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) throw new Error('Unauthorized')

    let successCount = 0
    let failureCount = 0

    for (const id of ids) {
        try {
            await purchasesRepository.receivePurchaseOrder(companyId, user.id, id)
            successCount++
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Unknown error'
            logger.warn('[purchases] Failed to receive PO', { id, message })
            failureCount++
        }
    }

    return {
        data: {
            success: true,
            received: successCount,
            skipped: failureCount
        }
    }
}

export async function deletePurchaseOrderBatchAction(ids: string[]) {
    const companyId = await getActiveCompanyId()
    let successCount = 0
    let failureCount = 0

    for (const id of ids) {
        try {
            await purchasesRepository.archivePurchaseOrder(companyId, 'SYSTEM_BATCH', id, 'Batch Archive')
            successCount++
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Unknown error'
            logger.warn('[purchases] Failed to delete PO', { id, message })
            failureCount++
        }
    }

    return {
        data: {
            success: true,
            deleted: successCount,
            skipped: failureCount
        }
    }
}

export async function getItemsBelowMinAction() {
    const companyId = await getActiveCompanyId()
    return await purchasesRepository.getItemsBelowMin(companyId)
}
