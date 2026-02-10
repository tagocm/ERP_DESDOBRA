import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { createClient } from '@/utils/supabase/server';

export async function POST(req: Request) {
    const supabase = await createClient();
    const body = await req.json();
    const { ids } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return NextResponse.json({ error: 'Nenhum lançamento selecionado' }, { status: 400 });
    }

    try {
        const { data: { user } } = await supabase.auth.getUser();

        // 1. Update status to OPEN (Approved/Active)
        const { data, error } = await supabase
            .from('ar_titles') // Updated table name
            .update({
                status: 'OPEN', // Changed to OPEN as per AR logic
                approved_at: new Date().toISOString(),
                approved_by: user?.id
            })
            .in('id', ids)
            .select();

        if (error) throw error;

        return NextResponse.json({
            approved: data.length,
            skipped: ids.length - data.length
        });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        logger.error('[finance/postings/approve-batch] Error', { message });
        return NextResponse.json(
            { error: process.env.NODE_ENV === 'production' ? 'Erro interno' : message },
            { status: 500 }
        );
    }
}
