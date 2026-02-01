"use client";

import { format } from "date-fns";
import { Eye, FileText } from "lucide-react";
import { Button } from "@/components/ui/Button";
import Link from "next/link";
import { DeliveryRoute } from "@/types/sales";
import { normalizeLogisticsStatus } from "@/lib/constants/status";

interface RouteHistoryTableProps {
    data: any[]; // Extended DeliveryRoute with joined orders/sales_order
    isLoading?: boolean;
}

export function RouteHistoryTable({ data, isLoading }: RouteHistoryTableProps) {
    if (isLoading) {
        return <div className="p-8 text-center text-gray-500">Carregando histórico...</div>;
    }

    if (!data || data.length === 0) {
        return (
            <div className="p-12 text-center border border-gray-200 rounded-lg bg-gray-50 text-gray-500">
                <FileText className="w-12 h-12 mx-auto mb-4 opacity-20" />
                <h3 className="text-lg font-medium">Nenhuma rota concluída encontrada</h3>
                <p>Ajuste os filtros ou finalize uma rota na tela de Retorno.</p>
            </div>
        );
    }

    return (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-white text-gray-500 font-semibold border-b border-gray-200">
                        <tr>
                            <th className="px-6 py-4 text-xs uppercase tracking-wider">Data</th>
                            <th className="px-6 py-4 text-xs uppercase tracking-wider">Rota</th>
                            <th className="px-6 py-4 text-center text-xs uppercase tracking-wider">Pedidos</th>
                            <th className="px-6 py-4 text-center text-xs uppercase tracking-wider">Peso Total</th>
                            <th className="px-6 py-4 text-center text-xs uppercase tracking-wider">Resultados</th>
                            <th className="px-6 py-4 text-center text-xs uppercase tracking-wider">Status</th>
                            <th className="px-6 py-4 w-[60px]"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {data.map((route) => {
                            const totalWeight = route.orders?.reduce((acc: number, o: any) => acc + (o.sales_order?.total_weight_kg || 0), 0) || 0;
                            const orderCount = route.orders?.length || 0;

                            // Stats
                            let delivered = 0;
                            let notDelivered = 0;

                            route.orders?.forEach((o: any) => {
                                const st = normalizeLogisticsStatus(o.sales_order?.status_logistic) || o.sales_order?.status_logistic;
                                if (st === 'delivered') delivered++;
                                else if (st === 'not_delivered') notDelivered++;
                            });

                            return (
                                <tr key={route.id} className="hover:bg-gray-50/80 group transition-colors">
                                    <td className="px-6 py-4 font-medium text-gray-900">
                                        {route.route_date ? format(new Date(route.route_date + 'T12:00:00'), 'dd/MM/yyyy') : '-'}
                                    </td>
                                    <td className="px-6 py-4 font-semibold text-gray-900">
                                        {route.name}
                                    </td>
                                    <td className="px-6 py-4 text-center text-gray-600">
                                        {orderCount}
                                    </td>
                                    <td className="px-6 py-4 text-center text-gray-600">
                                        {new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(totalWeight)} kg
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center justify-center gap-2 text-[10px] font-bold">
                                            {delivered > 0 && <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full" title="Entregues">{delivered} OK</span>}
                                            {notDelivered > 0 && <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full" title="Não Entregues">{notDelivered} NÃO</span>}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className="inline-flex px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800">
                                            CONCLUÍDA
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <Link href={`/app/logistica/historico/${route.id}`}>
                                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                                <Eye className="h-4 w-4" />
                                            </Button>
                                        </Link>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
