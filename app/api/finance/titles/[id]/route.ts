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

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const body = await request.json();
    const { payment_method_snapshot } = body; // notes ignored as requested previously
    const supabase = await createClient();

    try {
        const updates: any = {};
        if (payment_method_snapshot !== undefined) updates.payment_method_snapshot = payment_method_snapshot;

        if (Object.keys(updates).length === 0) {
            return NextResponse.json({ success: true });
        }

        const { error } = await supabase
            .from('ar_titles')
            .update(updates)
            .eq('id', id);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const supabase = await createClient();

    try {
        // 1. Check constraints
        const { data: title, error: fetchError } = await supabase
            .from('ar_titles')
            .select('status, amount_paid')
            .eq('id', id)
            .single();

        if (fetchError || !title) throw new Error('Lançamento não encontrado');

        if (title.amount_paid > 0) {
            return NextResponse.json({ error: 'Não é possível excluir lançamento com pagamentos registrados.' }, { status: 400 });
        }

        if (title.status !== 'PENDING_APPROVAL' && title.status !== 'ON_HOLD') {
            return NextResponse.json({ error: 'Apenas lançamentos pendentes ou em espera podem ser excluídos.' }, { status: 400 });
        }

        // 2. Delete (Cascade should handle installments, but we double check or let DB handle it)
        const { error: deleteError } = await supabase
            .from('ar_titles')
            .delete()
            .eq('id', id);

        if (deleteError) throw deleteError;

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
