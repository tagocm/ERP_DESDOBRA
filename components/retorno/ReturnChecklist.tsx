'use client';

import { useState } from 'react';
import { MapPin, Eye, Package } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ReturnOutcomeSelector } from './ReturnOutcomeSelector';
import { NotDeliveredModal } from './NotDeliveredModal';
import { PartialReturnModal } from './PartialReturnModal';

export type OutcomeType = 'ENTREGUE' | 'NAO_ENTREGUE' | 'DEVOLVIDO_PARCIAL';

export interface ReturnStaging {
    orderId: string;
    outcomeType: OutcomeType;
    reason?: string;
    payload?: any;
}

interface ReturnChecklistProps {
    route: any;
    staging: Record<string, ReturnStaging>;
    onUpdateStaging: (orderId: string, data: ReturnStaging) => void;
}

export function ReturnChecklist({ route, staging, onUpdateStaging }: ReturnChecklistProps) {
    const orders = route?.orders || [];

    const [selectedOrder, setSelectedOrder] = useState<any>(null);
    const [notDeliveredModalOpen, setNotDeliveredModalOpen] = useState(false);
    const [partialReturnModalOpen, setPartialReturnModalOpen] = useState(false);

    const handleOutcomeSelect = (routeOrder: any, outcome: OutcomeType) => {
        const order = routeOrder.sales_order; // Ensure we are working with sales_order if needed, or routeOrder object as passed
        // The original code passed 'routeOrder' to handleOutcomeSelect, but called it 'order' in the arg. 
        // Then in handleDeliveredConfirm it did: const orderId = selectedOrder.sales_order?.id || selectedOrder.id;
        // So let's keep it consistent.

        setSelectedOrder(routeOrder);

        if (outcome === 'ENTREGUE') {
            const orderId = routeOrder.sales_order?.id || routeOrder.id;
            onUpdateStaging(orderId, {
                orderId,
                outcomeType: 'ENTREGUE',
                reason: 'Entregue normalmente'
            });
        } else if (outcome === 'NAO_ENTREGUE') {
            setNotDeliveredModalOpen(true);
        } else if (outcome === 'DEVOLVIDO_PARCIAL') {
            setPartialReturnModalOpen(true);
        }
    };

    const handleNotDeliveredConfirm = (reason: string, notes?: string, actionFlags?: any) => {
        if (!selectedOrder) return;
        const orderId = selectedOrder.sales_order?.id || selectedOrder.id;
        onUpdateStaging(orderId, {
            orderId,
            outcomeType: 'NAO_ENTREGUE',
            reason,
            payload: { notes, actionFlags }
        });
        setNotDeliveredModalOpen(false);
    };

    const handlePartialReturnConfirm = async (deliveredItems: { itemId: string; deliveredQty: number }[], reasonLabel: string, details: any) => {
        if (!selectedOrder) return;
        const orderId = selectedOrder.sales_order?.id || selectedOrder.id;
        onUpdateStaging(orderId, {
            orderId,
            outcomeType: 'DEVOLVIDO_PARCIAL',
            reason: reasonLabel,
            payload: details // Pass the whole details object from modal which contains everything
        });
        setPartialReturnModalOpen(false);
    };

    if (orders.length === 0) {
        return (
            <div className="p-12 text-center text-gray-500">
                <Package className="w-12 h-12 mx-auto mb-4 opacity-20" />
                <p>Nenhum pedido nesta rota</p>
            </div>
        );
    }

    return (
        <>
            <div className="divide-y divide-gray-100">
                {orders.map((routeOrder: any) => {
                    const order = routeOrder.sales_order;
                    if (!order) return null;

                    const orderId = order.id;
                    const currentStaging = staging[orderId];
                    const outcome = currentStaging?.outcomeType;

                    // Determine background color based on outcome
                    let bgColor = '';
                    if (outcome === 'ENTREGUE') bgColor = 'bg-green-50/40';
                    else if (outcome === 'NAO_ENTREGUE') bgColor = 'bg-red-50/40';
                    else if (outcome === 'DEVOLVIDO_PARCIAL') bgColor = 'bg-amber-50/40';

                    return (
                        <div key={orderId} className={`p-4 hover:bg-gray-50 transition-colors ${bgColor}`}>
                            <div className="flex items-start gap-4">
                                {/* Outcome Selector (4 vertical buttons) */}
                                <ReturnOutcomeSelector
                                    currentOutcome={outcome}
                                    onOutcomeSelect={(newOutcome) => handleOutcomeSelect(routeOrder, newOutcome)}
                                />

                                {/* Order Info */}
                                <div className="flex-1 min-w-0">
                                    {/* Line 1: Client Name + Order # + City */}
                                    <div className="flex items-center justify-between mb-1">
                                        <div className="flex items-center gap-2">
                                            <span className={`font-semibold transition-colors ${outcome === 'ENTREGUE' ? 'text-green-900' :
                                                outcome === 'NAO_ENTREGUE' ? 'text-red-800 line-through decoration-red-400' :
                                                    outcome === 'DEVOLVIDO_PARCIAL' ? 'text-amber-800' :
                                                        'text-gray-900'
                                                }`}>
                                                {order.client?.trade_name || 'Cliente Desconhecido'}
                                            </span>
                                            <span className="text-xs text-gray-500">
                                                Pedido #{order.document_number}
                                            </span>
                                        </div>
                                        {order.client?.addresses?.[0]?.city && (
                                            <div className="flex items-center gap-1 text-xs text-gray-600">
                                                <MapPin className="w-3 h-3" />
                                                {order.client.addresses[0].city}
                                            </div>
                                        )}
                                    </div>

                                    {/* Weight + Volumes */}
                                    <div className="flex items-center gap-3 mb-2 text-xs text-gray-600">
                                        {order.total_weight_kg && (
                                            <span className="font-medium">
                                                {new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(order.total_weight_kg)} kg
                                            </span>
                                        )}
                                        {routeOrder.volumes && (
                                            <>
                                                <span className="text-gray-300">|</span>
                                                <span>{routeOrder.volumes} vol{routeOrder.volumes > 1 ? 's' : ''}</span>
                                            </>
                                        )}
                                    </div>

                                    {/* Items Summary (1 line) */}
                                    <div className="text-sm text-gray-600 mb-2">
                                        {order.items && order.items.length > 0 ? (
                                            <span>
                                                {order.items.length} {order.items.length === 1 ? 'item' : 'itens'}
                                                {order.total_amount && ` • ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.total_amount)}`}
                                            </span>
                                        ) : (
                                            <span className="text-gray-400">Sem itens</span>
                                        )}
                                    </div>

                                    {/* View Order Link */}
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 px-2 text-xs gap-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                        onClick={() => window.open(`/app/vendas/pedidos/${order.id}`, '_blank')}
                                        title="Ver pedido em nova aba"
                                    >
                                        <Eye className="w-3 h-3" />
                                        Ver pedido
                                    </Button>

                                    {/* Status Feedback */}
                                    {outcome && currentStaging?.reason && (
                                        <div className="mt-2 text-xs text-gray-700 bg-gray-100 px-2 py-1 rounded">
                                            <strong>Motivo:</strong> {currentStaging.reason}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Modals */}
            {selectedOrder && (
                <>
                    <NotDeliveredModal
                        isOpen={notDeliveredModalOpen}
                        onClose={() => setNotDeliveredModalOpen(false)}
                        onConfirm={handleNotDeliveredConfirm}
                        order={selectedOrder}
                    />
                    <PartialReturnModal
                        isOpen={partialReturnModalOpen}
                        onClose={() => setPartialReturnModalOpen(false)}
                        onConfirm={handlePartialReturnConfirm}
                        order={selectedOrder}
                    />
                </>
            )}
        </>
    );
}
