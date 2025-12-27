"use client";

import { SalesOrder } from "@/types/sales";
import { format } from "date-fns";
import { Eye, FileText } from "lucide-react";
import { Button } from "@/components/ui/Button";
import Link from "next/link";
import {
    getCommercialBadgeStyle,
    getLogisticsBadgeStyle,
    getFinancialBadgeStyle
} from "@/lib/constants/statusColors";

interface SalesTableProps {
    data: SalesOrder[];
    isLoading: boolean;
    onSelectionChange?: (selectedIds: string[]) => void;
}

export function SalesTable({ data, isLoading }: SalesTableProps) {
    if (isLoading) {
        return <div className="p-8 text-center text-gray-500">Carregando pedidos...</div>;
    }

    if (!data || data.length === 0) {
        return (
            <div className="p-12 text-center border border-gray-200 rounded-lg bg-gray-50 text-gray-500">
                <FileText className="w-12 h-12 mx-auto mb-4 opacity-20" />
                <h3 className="text-lg font-medium">Nenhum pedido encontrado</h3>
                <p>Ajuste os filtros ou crie um novo pedido.</p>
            </div>
        );
    }

    return (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-white text-gray-500 font-semibold border-b border-gray-200">
                        <tr>
                            <th className="px-6 py-4 w-[100px] text-xs uppercase tracking-wider">Número</th>
                            <th className="px-6 py-4 text-xs uppercase tracking-wider">Cliente</th>
                            <th className="px-6 py-4 w-[140px] text-xs uppercase tracking-wider">Data</th>
                            <th className="px-6 py-4 text-right text-xs uppercase tracking-wider">Total</th>
                            <th className="px-6 py-4 text-center text-xs uppercase tracking-wider">Comercial</th>
                            <th className="px-6 py-4 text-center text-xs uppercase tracking-wider">Logístico</th>
                            <th className="px-6 py-4 text-center text-xs uppercase tracking-wider">Financeiro</th>
                            <th className="px-6 py-4 w-[60px]"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {data.map((order) => (
                            <tr key={order.id} className="hover:bg-gray-50/80 group transition-colors">
                                <td className="px-6 py-4 font-medium text-gray-900">
                                    <Link href={`/app/vendas/pedidos/${order.id}`} className="hover:text-brand-700 text-brand-600 font-bold">
                                        #{order.document_number?.toString().padStart(4, '0') || '---'}
                                    </Link>
                                    <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">{order.doc_type === 'order' ? 'PEDIDO' : 'PROPOSTA'}</div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="font-semibold text-gray-900">{order.client?.trade_name || 'Desconhecido'}</div>
                                </td>
                                <td className="px-6 py-4 text-gray-500 text-sm">
                                    {order.date_issued ? format(new Date(order.date_issued), 'dd/MM/yyyy') : '-'}
                                </td>
                                <td className="px-6 py-4 text-right font-bold text-gray-900">
                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.total_amount || 0)}
                                </td>
                                <td className="px-6 py-4 text-center">
                                    <span className={`inline-flex px-3 py-1 rounded-full text-xs font-bold ${getCommercialBadgeStyle(order.status_commercial).bg} ${getCommercialBadgeStyle(order.status_commercial).text}`}>
                                        {getCommercialBadgeStyle(order.status_commercial).label}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-center">
                                    {order.doc_type === 'order' && (
                                        <span className={`inline-flex px-3 py-1 rounded-full text-xs font-bold ${getLogisticsBadgeStyle(order.status_logistic).bg} ${getLogisticsBadgeStyle(order.status_logistic).text}`}>
                                            {getLogisticsBadgeStyle(order.status_logistic).label}
                                        </span>
                                    )}
                                </td>
                                <td className="px-6 py-4 text-center">
                                    {order.doc_type === 'order' && (
                                        <span className={`inline-flex px-3 py-1 rounded-full text-xs font-bold ${getFinancialBadgeStyle(order.financial_status || 'pending').bg} ${getFinancialBadgeStyle(order.financial_status || 'pending').text}`}>
                                            {getFinancialBadgeStyle(order.financial_status || 'pending').label}
                                        </span>
                                    )}
                                </td>
                                <td className="px-4 py-3 text-right">
                                    <Link href={`/app/vendas/pedidos/${order.id}`}>
                                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                            <Eye className="h-4 w-4" />
                                        </Button>
                                    </Link>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {/* Pagination Footer would go here - implemented in parent usually or passed props */}
        </div>
    );
}
