import { Suspense } from 'react';
import { createClient } from '@/utils/supabase/server';
import { PageHeader } from '@/components/ui/PageHeader';
import { getCompletedRoutes } from '@/lib/data/expedition';
import { RouteHistoryTable } from '@/components/expedition/RouteHistoryTable';
import { RouteHistoryFilters } from '@/components/expedition/RouteHistoryFilters';

export default async function RouteHistoryPage({ searchParams }: { searchParams: { [key: string]: string | string[] | undefined } }) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return <div className="p-8">Não autorizado</div>;

    const { data: memberData } = await supabase
        .from('company_members')
        .select('company_id')
        .eq('auth_user_id', user.id)
        .single();

    if (!memberData?.company_id) return <div className="p-8">Empresa não encontrada</div>;

    const search = typeof searchParams.search === 'string' ? searchParams.search : undefined;

    const routes = await getCompletedRoutes(supabase, memberData.company_id, {
        search
    });

    return (
        <div className="flex flex-col gap-6 p-6">
            <PageHeader
                title="Histórico de Rotas"
                description="Consulta de rotas, entregas e ocorrências finalizadas"
            />
            <div className="w-full">
                <Suspense fallback={<div className="h-14 bg-gray-50 rounded-2xl animate-pulse" />}>
                    <RouteHistoryFilters />
                </Suspense>
            </div>
            <RouteHistoryTable data={routes} />
        </div>
    )
}
