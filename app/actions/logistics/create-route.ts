'use server'

import { getActiveCompanyId } from "@/lib/auth/get-active-company"
import { createClient } from "@/utils/supabase/server"
import { revalidatePath } from "next/cache"

interface CreateRoutePayload {
    name: string
    route_date: string
    scheduled_date?: string
    status?: string
}

export async function createRouteAction(payload: CreateRoutePayload) {
    const companyId = await getActiveCompanyId()
    const supabase = await createClient()

    // Get User for Audit
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    // 1. Create Route
    const { data: route, error } = await supabase
        .from('delivery_routes')
        .insert({
            company_id: companyId,
            name: payload.name,
            route_date: payload.route_date,
            scheduled_date: payload.scheduled_date || payload.route_date,
            status: payload.status || 'planned'
        })
        .select()
        .single()

    if (error) {
        console.error("Create Route Error:", error)
        throw new Error("Failed to create route")
    }

    // 2. Audit Log
    try {
        await supabase.from('audit_logs').insert({
            company_id: companyId,
            user_id: user.id,
            action: 'create_delivery_route',
            entity_type: 'delivery_routes',
            entity_id: route.id,
            details: { name: payload.name, date: payload.route_date }
        })
    } catch (auditError) {
        console.error("Audit Log Failed:", auditError)
        // Non-blocking
    }

    revalidatePath('/app/logistica/expedicao')
    return route
}
