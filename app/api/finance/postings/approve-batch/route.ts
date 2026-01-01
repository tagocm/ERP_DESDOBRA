import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

async function createClient() {
    const cookieStore = await cookies();
    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() { return cookieStore.getAll() },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
                    } catch { }
                },
            },
        }
    );
}

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
    } catch (e: any) {
        console.error('Batch approve error:', e);
        return NextResponse.json({ error: e.message || 'Erro interno' }, { status: 500 });
    }
}
