'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { PendingInvoice } from '@/lib/fiscal/nfe-actions';
import { Loader2, FileText, Building2, User, Package } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    order: PendingInvoice;
    onConfirm: () => void;
    isSubmitting: boolean;
}

export function InvoiceModal({ isOpen, onClose, order, onConfirm, isSubmitting }: Props) {
    const [orderDetails, setOrderDetails] = useState<any>(null);
    const [companyData, setCompanyData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (isOpen && order) {
            loadOrderDetails();
        }
    }, [isOpen, order]);

    async function loadOrderDetails() {
        setIsLoading(true);
        const supabase = createClient();

        try {
            // Load order with items
            const { data: orderData } = await supabase
                .from('sales_documents')
                .select(`
                    *,
                    client:organizations!client_id (*),
                    items:sales_document_items (
                        *,
                        item:items (name, sku)
                    )
                `)
                .eq('id', order.id)
                .single();

            // Load company data
            const { data: company } = await supabase
                .from('companies')
                .select('*')
                .eq('id', orderData.company_id)
                .single();

            setOrderDetails(orderData);
            setCompanyData(company);
        } catch (error) {
            console.error('Error loading order details:', error);
        } finally {
            setIsLoading(false);
        }
    }

    if (!isOpen) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileText className="w-5 h-5" />
                        Emitir NF-e - Pedido #{order.document_number}
                    </DialogTitle>
                </DialogHeader>

                {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Emitente */}
                        <div className="bg-blue-50 rounded-lg p-4">
                            <h3 className="font-semibold text-sm text-blue-900 mb-3 flex items-center gap-2">
                                <Building2 className="w-4 h-4" />
                                Emitente
                            </h3>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                    <span className="text-gray-600">Razão Social:</span>
                                    <p className="font-medium text-gray-900">{companyData?.name}</p>
                                </div>
                                <div>
                                    <span className="text-gray-600">CNPJ:</span>
                                    <p className="font-medium font-mono text-gray-900">
                                        {companyData?.corporate_name || '-'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Destinatário */}
                        <div className="bg-green-50 rounded-lg p-4">
                            <h3 className="font-semibold text-sm text-green-900 mb-3 flex items-center gap-2">
                                <User className="w-4 h-4" />
                                Destinatário
                            </h3>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                    <span className="text-gray-600">Nome/Razão Social:</span>
                                    <p className="font-medium text-gray-900">
                                        {orderDetails?.client?.name}
                                    </p>
                                </div>
                                <div>
                                    <span className="text-gray-600">CNPJ/CPF:</span>
                                    <p className="font-medium font-mono text-gray-900">
                                        {orderDetails?.client?.cnpj_cpf || '-'}
                                    </p>
                                </div>
                                <div className="col-span-2">
                                    <span className="text-gray-600">Endereço:</span>
                                    <p className="font-medium text-gray-900">
                                        {orderDetails?.client?.address || '-'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Items */}
                        <div>
                            <h3 className="font-semibold text-sm text-gray-900 mb-3 flex items-center gap-2">
                                <Package className="w-4 h-4" />
                                Itens da Nota
                            </h3>
                            <div className="overflow-x-auto rounded-lg border border-gray-200">
                                <table className="min-w-full divide-y divide-gray-200 text-sm">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                                Código
                                            </th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                                Descrição
                                            </th>
                                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                                                Qtd
                                            </th>
                                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                                                Valor Unit.
                                            </th>
                                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                                                Total
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {orderDetails?.items?.map((item: any) => (
                                            <tr key={item.id}>
                                                <td className="px-4 py-2 font-mono text-gray-600">
                                                    {item.item?.sku || '-'}
                                                </td>
                                                <td className="px-4 py-2 text-gray-900">
                                                    {item.item?.name}
                                                </td>
                                                <td className="px-4 py-2 text-right text-gray-900">
                                                    {item.quantity}
                                                </td>
                                                <td className="px-4 py-2 text-right text-gray-900">
                                                    {new Intl.NumberFormat('pt-BR', {
                                                        style: 'currency',
                                                        currency: 'BRL',
                                                    }).format(item.unit_price)}
                                                </td>
                                                <td className="px-4 py-2 text-right font-medium text-gray-900">
                                                    {new Intl.NumberFormat('pt-BR', {
                                                        style: 'currency',
                                                        currency: 'BRL',
                                                    }).format(item.total_amount)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Totais */}
                        <div className="bg-gray-50 rounded-lg p-4">
                            <div className="flex justify-between items-center text-lg font-bold">
                                <span className="text-gray-700">Total da Nota:</span>
                                <span className="text-gray-900">
                                    {new Intl.NumberFormat('pt-BR', {
                                        style: 'currency',
                                        currency: 'BRL',
                                    }).format(order.total_amount)}
                                </span>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-3 justify-end pt-4 border-t">
                            <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
                                Cancelar
                            </Button>
                            <Button onClick={onConfirm} disabled={isSubmitting}>
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Emitindo...
                                    </>
                                ) : (
                                    <>
                                        <FileText className="w-4 h-4 mr-2" />
                                        Emitir NF-e
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
