
import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

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

    } catch (error: any) {
        console.error("Error fetching deliveries:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
