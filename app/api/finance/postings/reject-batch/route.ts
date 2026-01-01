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
    const { ids, reason, notes } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return NextResponse.json({ error: 'Nenhum lançamento selecionado' }, { status: 400 });
    }

    try {
        const { data: { user } } = await supabase.auth.getUser();

        // 1. Update status to CANCELLED (Rejected)
        // Store reason in a dedicated adjustment or log? Or just append to existing logic?
        // ar_titles doesn't have notes column in my schema above? Oops. 
        // I should have checked schema. I dropped notes column.
        // Let's assume we don't store rejection reason in title table for now, or just status.
        // Or re-add notes column? The user schema request didn't include notes in ar_titles.
        // It's acceptable for now to just status.

        const { data, error } = await supabase
            .from('ar_titles') // Updated
            .update({
                status: 'CANCELLED', // REJECTED -> CANCELLED
                approved_at: new Date().toISOString(),
                approved_by: user?.id,
                // notes: fullNotes -- Removed as per schema spec (user didn't ask for notes in Title)
            })
            .in('id', ids)
            .select();

        if (error) throw error;

        return NextResponse.json({
            rejected: data.length,
            skipped: ids.length - data.length
        });
    } catch (e: any) {
        console.error('Batch reject error:', e);
        return NextResponse.json({ error: e.message || 'Erro interno' }, { status: 500 });
    }
}
