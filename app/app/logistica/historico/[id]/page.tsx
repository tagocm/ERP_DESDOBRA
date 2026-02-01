import { createClient } from '@/utils/supabase/server';
import { getCompletedRouteDetails } from '@/lib/data/expedition';
import { format } from 'date-fns';
import { ArrowLeft, CheckCircle2, XCircle, FileText } from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { normalizeLogisticsStatus, translateLogisticsStatusPt } from '@/lib/constants/status';

export default async function RouteHistoryDetailsPage({ params }: { params: Promise<{ id: string }> }) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { id } = await params;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!id || !uuidRegex.test(id)) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center">
                <div className="bg-red-50 p-4 rounded-full mb-4">
                    <XCircle className="w-8 h-8 text-red-500" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Rota Inválida</h2>
                <p className="text-gray-500 mb-6">O identificador da rota não é válido.</p>
                <Link href="/app/logistica/historico">
                    <Button variant="outline">Voltar para Histórico</Button>
                </Link>
            </div>
        );
    }

    if (!user) return <div className="p-8">Não autorizado</div>;

    const { data: memberData } = await supabase
        .from('company_members')
        .select('company_id')
        .eq('auth_user_id', user.id)
        .single();

    if (!memberData?.company_id) return <div className="p-8">Empresa não encontrada</div>;

    const route = await getCompletedRouteDetails(supabase, id, memberData.company_id);

    if (!route) return <div className="p-8">Rota não encontrada</div>;

    // Calculate Stats
    const stats = route.orders?.reduce((acc: any, order: any) => {
        acc.total++;
        const normalized = normalizeLogisticsStatus(order.sales_order?.status_logistic) || order.sales_order?.status_logistic;
        if (normalized === 'delivered') acc.delivered++;
        else if (normalized === 'not_delivered') acc.notDelivered++;

        acc.weight += order.sales_order?.total_weight_kg || 0;
        return acc;
    }, { total: 0, delivered: 0, notDelivered: 0, weight: 0 });

    return (
        <div className="flex flex-col min-h-screen bg-gray-50/30">
            <PageHeader
                title={route.name}
                subtitle={`Rota realizada em ${route.route_date ? format(new Date(route.route_date + 'T12:00:00'), 'dd/MM/yyyy') : '-'}`}
                actions={
                    <Link href="/app/logistica/historico">
                        <Button variant="outline" size="sm" className="gap-2">
                            <ArrowLeft className="w-4 h-4" />
                            Voltar
                        </Button>
                    </Link>
                }
            />

            <div className="flex flex-col gap-6 px-6 pb-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white p-4 rounded-xl border border-gray-200/60 shadow-sm">
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Total Pedidos</p>
                        <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-gray-200/60 shadow-sm">
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Peso Total</p>
                        <p className="text-2xl font-bold text-gray-900">{stats.weight.toFixed(1)} <span className="text-sm font-normal text-gray-500">kg</span></p>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-gray-200/60 shadow-sm">
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Entregues</p>
                        <p className="text-2xl font-bold text-green-600 flex items-center gap-2">
                            {stats.delivered}
                            <span className="text-xs font-normal bg-green-100 text-green-700 px-2 py-0.5 rounded-full">{(stats.delivered / stats.total * 100).toFixed(0)}%</span>
                        </p>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-gray-200/60 shadow-sm">
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Devoluções</p>
                        <p className="text-2xl font-bold text-red-600">{stats.notDelivered}</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {route.orders?.map((ro: any) => {
                        const order = ro.sales_order;
                        if (!order) return null;

                        const status = normalizeLogisticsStatus(order.status_logistic) || order.status_logistic;

                        let statusBadge = null;
                        if (status === 'delivered') {
                            statusBadge = (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-100">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    Entregue
                                </span>
                            );
                        } else if (status === 'not_delivered') {
                            statusBadge = (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-100">
                                    <XCircle className="w-3.5 h-3.5" />
                                    Não Entregue
                                </span>
                            );
                        } else {
                            statusBadge = (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">
                                    {translateLogisticsStatusPt(status)}
                                </span>
                            );
                        }

                        return (
                            <Card key={ro.id} className="h-full flex flex-col hover:shadow-lg transition-all duration-300">
                                <CardHeader className="pb-3 border-b border-gray-100">
                                    <div className="flex justify-between items-start mb-1">
                                        <div className="space-y-1">
                                            <CardTitle className="text-base line-clamp-1" title={order.client?.trade_name}>
                                                {order.client?.trade_name || 'Cliente Desconhecido'}
                                            </CardTitle>
                                            <Link href={`/app/vendas/pedidos/${order.id}`} className="inline-block text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline">
                                                Pedido #{order.document_number}
                                            </Link>
                                        </div>
                                        <div className="shrink-0 ml-3">
                                            {statusBadge}
                                        </div>
                                    </div>
                                </CardHeader>

                                <CardContent className="flex-1 py-4">
                                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Itens do Pedido</p>
                                    <ul className="space-y-2">
                                        {order.items?.map((item: any) => (
                                            <li key={item.id} className="text-sm flex justify-between items-start gap-3 group">
                                                <span className="text-gray-700 line-clamp-2 group-hover:text-gray-900 transition-colors">
                                                    {item.quantity}x {item.item?.name}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                </CardContent>

                                {order.internal_notes && (
                                    <div className="mt-auto p-4 bg-amber-50/50 border-t border-amber-100/50 rounded-b-2xl">
                                        <div className="flex gap-2">
                                            <FileText className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                            <div className="space-y-1">
                                                <p className="text-xs font-bold text-amber-800">Ocorrências / Notas</p>
                                                <p className="text-xs text-amber-700/90 whitespace-pre-wrap leading-relaxed">
                                                    {order.internal_notes}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </Card>
                        )
                    })}
                </div>
            </div>
        </div>
    );
}
