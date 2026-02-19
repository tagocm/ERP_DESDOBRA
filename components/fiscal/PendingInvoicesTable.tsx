'use client';

import Link from 'next/link';
import { PendingInvoice } from '@/lib/fiscal/nfe-actions';
import { Button } from '@/components/ui/Button';
import { FileText, Loader2 } from 'lucide-react';

interface Props {
    data: PendingInvoice[];
    isLoading: boolean;
    onInvoiceIssued: () => void;
    emptyTitle?: string;
    emptyDescription?: string;
}

export function PendingInvoicesTable({
    data,
    isLoading,
    onInvoiceIssued,
    emptyTitle = 'Nenhum pedido pendente',
    emptyDescription = 'Não há pedidos confirmados sem NF-e no momento.',
}: Props) {
    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
        );
    }

    if (data.length === 0) {
        return (
            <div className="text-center py-12">
                <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                    {emptyTitle}
                </h3>
                <p className="text-gray-500">
                    {emptyDescription}
                </p>
            </div>
        );
    }

    return (
        <div className="overflow-x-auto rounded-2xl border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Nº Pedido</th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Data</th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Cliente</th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">CNPJ/CPF</th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {data.map((order) => (
                        <tr key={order.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                                <span className="text-sm font-medium text-gray-900">#{order.document_number}</span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                                <span className="text-sm text-gray-900">{new Date(order.date_issued).toLocaleDateString('pt-BR')}</span>
                            </td>
                            <td className="px-6 py-4">
                                <span className="text-sm text-gray-900">{order.client?.trade_name || '-'}</span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                                <span className="text-sm text-gray-500 font-mono">{order.client?.document_number || '-'}</span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                                <span className="text-sm font-medium text-gray-900">
                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.total_amount)}
                                </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                                <Link href={`/app/fiscal/nfe/emitir/${order.id}`}>
                                    <Button size="sm">
                                        <FileText className="w-4 h-4 mr-2" />
                                        Emitir NF-e
                                    </Button>
                                </Link>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
