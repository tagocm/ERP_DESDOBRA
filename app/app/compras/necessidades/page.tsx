import { Suspense } from 'react';
import PurchaseNeedsClient from './needs-client';
import { createClient } from '@/utils/supabase/server';

export default async function PurchaseNeedsPage() {
    const supabase = await createClient();
    // Fetching user to determine company context


    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return <div>Acesso negado</div>;

    // Fetch the first company execution context for now as per typical single-tenant-per-session patterns
    // or rely on the fact that RLS filters 'companies' to the one the user belongs to?
    // Let's try to get the company from `company_members` for this user.
    const { data: member } = await supabase
        .from('company_members')
        .select('company_id')
        .eq('auth_user_id', user.id)
        .single();

    const companyId = member?.company_id;

    if (!companyId) return <div>Empresa não encontrada</div>;

    return (
        <Suspense fallback={<div>Carregando...</div>}>
            <PurchaseNeedsClient companyId={companyId} />
        </Suspense>
    );
}
