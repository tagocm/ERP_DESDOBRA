
import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";
import { setDeliveryStatus } from "@/lib/services/deliveries";
import { logger } from "@/lib/logger";

export async function PATCH(
    request: Request,
    props: { params: Promise<{ id: string }> }
) {
    const params = await props.params;
    const { id } = params; // deliveryId
    const supabase = await createClient();

    try {
        const body = await request.json();
        const { status } = body;

        if (!status) {
            return NextResponse.json({ error: "Missing status" }, { status: 400 });
        }

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        await setDeliveryStatus(supabase, id, status);

        return NextResponse.json({ success: true });

    } catch (error: any) {
        const message = error instanceof Error ? error.message : "Unknown error";
        logger.error("[deliveries/status] Error updating delivery status", { deliveryId: id, message });
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
