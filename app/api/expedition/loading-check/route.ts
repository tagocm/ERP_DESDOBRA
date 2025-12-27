import { createClient } from '@/utils/supabase/server';
import { updateLoadingChecked } from '@/lib/data/expedition';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const supabase = await createClient();
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { orderId, checked, userId } = await request.json();

        if (!orderId) {
            return NextResponse.json({ error: 'Order ID required' }, { status: 400 });
        }

        await updateLoadingChecked(supabase, orderId, checked, userId);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error updating loading check:', error);
        return NextResponse.json(
            { error: 'Failed to update loading check' },
            { status: 500 }
        );
    }
}
