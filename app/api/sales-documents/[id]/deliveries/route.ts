
import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

export async function GET(
    request: Request,
    props: { params: Promise<{ id: string }> }
) {
    const params = await props.params;
    const { id } = params; // salesDocumentId
    const supabase = await createClient();

    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { data: deliveries, error } = await supabase
            .from('deliveries')
            .select(`
                *,
                items:delivery_items(
                    *
                ),
                route:delivery_routes(name, route_date)
            `)
            .eq('sales_document_id', id)
            .order('number', { ascending: true });

        if (error) throw error;

        return NextResponse.json(deliveries);

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        logger.error("[sales-documents/deliveries] Error", { salesDocumentId: id, message });
        return NextResponse.json(
            { error: process.env.NODE_ENV === "production" ? "Erro ao buscar entregas" : message },
            { status: 500 }
        );
    }
}
