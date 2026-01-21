import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseServer';

export async function GET(req: NextRequest) {
    try {
        const adminSupabase = createAdminClient();

        const { data: settings } = await adminSupabase
            .from('company_settings')
            .select('logo_path')
            .single();

        return NextResponse.json({
            logo_url: settings?.logo_path || null
        });
    } catch (error: any) {
        console.error('[Logo API] Error:', error);
        return NextResponse.json({ logo_url: null }, { status: 200 }); // Return null instead of error
    }
}
