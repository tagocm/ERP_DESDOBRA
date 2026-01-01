
import { createClient } from '@/utils/supabase/server';
import { getCompletedRouteDetails } from '@/lib/data/expedition';
import { format } from 'date-fns';
import { ArrowLeft, CheckCircle2, XCircle, FileText } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';

export default async function RouteHistoryDetailsPage({ params }: { params: { id: string } }) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return <div className="p-8">Não autorizado</div>;

    const { data: memberData } = await supabase
        .from('company_members')
        .select('company_id')
        .eq('auth_user_id', user.id)
        .single();

    if (!memberData?.company_id) return <div className="p-8">Empresa não encontrada</div>;

    const route = await getCompletedRouteDetails(supabase, params.id, memberData.company_id);

    if (!route) return <div className="p-8">Rota não encontrada</div>;

    return (
        <div className="flex flex-col gap-6 p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Link href="/app/logistica/historico">
                        <Button variant="ghost" size="sm">
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Voltar
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                            {route.name}
                            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-800 border border-green-200">
                                CONCLUÍDA
                            </span>
                        </h1>
                        <p className="text-sm text-gray-500">
                            Data da Rota: {route.route_date ? format(new Date(route.route_date + 'T12:00:00'), 'dd/MM/yyyy') : '-'}
                        </p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {route.orders?.map((ro: any) => {
                    const order = ro.sales_order;
                    if (!order) return null;

                    const status = order.status_logistic;

                    let statusBadge = null;
                    // Logic matching update status in finish return
                    if (status === 'entregue') statusBadge = <span className="flex items-center text-green-700 text-xs font-bold bg-green-50 px-2 py-1 rounded-full border border-green-100"><CheckCircle2 className="w-3 h-3 mr-1" /> Entregue</span>;
                    else if (status === 'nao_entregue') statusBadge = <span className="flex items-center text-red-700 text-xs font-bold bg-red-50 px-2 py-1 rounded-full border border-red-100"><XCircle className="w-3 h-3 mr-1" /> Não Entregue</span>;
                    else statusBadge = <span className="text-gray-500 text-xs bg-gray-100 px-2 py-1 rounded-full">{status}</span>;

                    return (
                        <div key={ro.id} className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm hover:shadow-md transition-all flex flex-col h-full">
                            <div className="flex justify-between items-start mb-3">
                                <div>
                                    <h3 className="font-bold text-gray-900 line-clamp-1 text-base">{order.client?.trade_name || 'Cliente Desconhecido'}</h3>
                                    <Link href={`/app/vendas/pedidos/${order.id}`} className="text-xs text-blue-600 hover:underline font-medium">
                                        Pedido #{order.document_number}
                                    </Link>
                                </div>
                                <div className="shrink-0 ml-2">
                                    {statusBadge}
                                </div>
                            </div>

                            <div className="border-t border-gray-100 my-3 pt-3 flex-1">
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Itens</p>
                                <ul className="text-sm text-gray-700 space-y-1.5 max-h-40 overflow-y-auto pr-1 scrollbar-thin">
                                    {order.items?.map((item: any) => (
                                        <li key={item.id} className="flex justify-between items-center bg-gray-50 p-1.5 rounded">
                                            <span className="truncate flex-1 mr-2">{item.item?.name}</span>
                                            <span className="font-mono text-xs bg-white border border-gray-200 px-1.5 rounded text-gray-500 whitespace-nowrap">{item.quantity} un</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {order.internal_notes && (
                                <div className="mt-auto pt-3 border-t border-gray-100">
                                    <div className="bg-amber-50 p-3 rounded-md text-xs text-amber-900 border border-amber-100">
                                        <p className="font-bold mb-1 flex items-center"><FileText className="w-3 h-3 mr-1" /> Notas / Ocorrências:</p>
                                        <p className="whitespace-pre-wrap leading-relaxed opacity-90">{order.internal_notes}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
