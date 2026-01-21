
import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";
import { createDeliveryFromSalesOrder } from "@/lib/services/deliveries";

export async function POST(request: Request) {
    const supabase = await createClient();

    try {
        const body = await request.json();
        const { salesDocumentId, routeId } = body;

        if (!salesDocumentId) {
            return NextResponse.json({ error: "Missing salesDocumentId" }, { status: 400 });
        }

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        // Get Company
        // Simplification: We assume user belongs to at least one company or pass it in body
        // Ideally we fetch from session or body. Let's fetch from member table for safety.
        const { data: member } = await supabase
            .from('company_members')
            .select('company_id')
            .eq('auth_user_id', user.id)
            .limit(1)
            .single();

        if (!member) return NextResponse.json({ error: "No company found" }, { status: 403 });

        const delivery = await createDeliveryFromSalesOrder(supabase, {
            salesDocumentId,
            routeId,
            userId: user.id,
            companyId: member.company_id
        });

        return NextResponse.json(delivery);

    } catch (error: any) {
        console.error("Error creating delivery:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
