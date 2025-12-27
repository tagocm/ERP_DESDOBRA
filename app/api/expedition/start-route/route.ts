import { createClient } from '@/utils/supabase/server';
import { startRoute } from '@/lib/data/expedition';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const supabase = await createClient();
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { routeId } = await request.json();

        if (!routeId) {
            return NextResponse.json({ error: 'Route ID required' }, { status: 400 });
        }

        const result = await startRoute(supabase, routeId);

        return NextResponse.json({ success: true, affected: result.affected });
    } catch (error: any) {
        console.error('Error starting route:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to start route' },
            { status: 500 }
        );
    }
}
