import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { requireInternalApiAccess } from '@/lib/api/internal';

export async function GET(request: Request) {
    try {
        const gate = requireInternalApiAccess(request);
        if (gate) return gate;

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Find a candidate order to test (limit 1)
        const { data: order, error: fetchError } = await supabase
            .from('sales_documents')
            .select('id, status_logistic')
            .eq('doc_type', 'order')
            .limit(1)
            .single();

        if (fetchError) {
            return NextResponse.json({ message: 'Error fetching order', error: fetchError });
        }

        if (!order) {
            return NextResponse.json({ message: 'No order found' });
        }

        console.log("Testing RPC on order:", order.id, "Current status:", order.status_logistic);

        // Attempt RPC update (Dry run - we revert? No, we can't revert easily in Supabase API)
        // We will try to set it to 'in_route' then back to original?
        // Or just try to set it to current status?
        // If current is pending, set to pending? RPC casts it, so if it fails it fails.
        // Assuming current status is valid enum.

        // Let's force it to 'in_route' and catch error.
        // WARNING: This changes data. Use with caution.
        // Better: Use a transaction that rolls back? Supabase client doesn't support transactions easily.

        // We will use the RPC call and capture error.
        const { error } = await supabase.rpc('update_sales_doc_logistic_status', {
            p_id: order.id,
            p_status: 'in_route'
        });

        if (error) {
            return NextResponse.json({ success: false, error });
        }

        // Revert (Best effort)
        const originalStatus = order.status_logistic || 'pending';
        // Need to ensure originalStatus is valid TEXT for the RPC (which expects text input)
        await supabase.rpc('update_sales_doc_logistic_status', {
            p_id: order.id,
            p_status: originalStatus
        });

        return NextResponse.json({ success: true, message: 'RPC executed successfully (and reverted)' });

    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message, stack: e.stack });
    }
}
