
import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

export async function GET(
    request: Request,
    props: { params: Promise<{ id: string }> }
) {
    const params = await props.params;
    const { id } = params; // deliveryId
    const supabase = await createClient();

    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { data: delivery, error } = await supabase
            .from('deliveries')
            .select(`
                *,
                items:delivery_items(
                    *,
                    sales_item:sales_document_items(
                        unit_price,
                        product:item_id(*)
                    )
                ),
                route:delivery_routes(*)
            `)
            .eq('id', id)
            .single();

        if (error) throw error;

        return NextResponse.json(delivery);

    } catch (error: any) {
        const message = error instanceof Error ? error.message : "Unknown error";
        logger.error("[deliveries] Error fetching delivery", { deliveryId: id, message });
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
