
import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";
import { setDeliveryStatus } from "@/lib/services/deliveries";

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
        console.error("Error updating delivery status:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
