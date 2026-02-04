'use client';

import { CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { ReturnStaging } from './ReturnChecklist';

interface ReturnSummaryProps {
    route: any;
    staging: Record<string, ReturnStaging>;
}

export function ReturnSummary({ route, staging }: ReturnSummaryProps) {
    const orders = route?.orders || [];

    // Calculate counters
    const counters = {
        entregues: 0,
        naoEntregues: 0,
        devolvidosParciais: 0,
        pending: 0
    };

    const exceptions: any[] = [];

    orders.forEach((routeOrder: any) => {
        const order = routeOrder.sales_order;
        if (!order) return;

        const orderId = order.id;
        const currentStaging = staging[orderId];

        if (!currentStaging) {
            counters.pending++;
            return;
        }

        switch (currentStaging.outcomeType) {
            case 'ENTREGUE':
                counters.entregues++;
                break;
            case 'NAO_ENTREGUE':
                counters.naoEntregues++;
                exceptions.push({
                    order,
                    type: 'NAO_ENTREGUE',
                    reason: currentStaging.reason
                });
                break;
            case 'DEVOLVIDO_PARCIAL':
                counters.devolvidosParciais++;
                exceptions.push({
                    order,
                    type: 'DEVOLVIDO_PARCIAL',
                    reason: currentStaging.reason,
                    payload: currentStaging.payload
                });
                break;
        }
    });

    const hasBlockingIssues = counters.pending > 0;

    return (
        <div className="p-6 space-y-6">
            {/* Counters */}
            <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Resumo do Retorno</h3>
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
                        <div className="flex items-center gap-2 mb-1">
                            <CheckCircle2 className="w-5 h-5 text-green-600" />
                            <span className="text-sm font-medium text-green-900">Entregues</span>
                        </div>
                        <p className="text-3xl font-bold text-green-700">{counters.entregues}</p>
                    </div>

                    <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
                        <div className="flex items-center gap-2 mb-1">
                            <XCircle className="w-5 h-5 text-red-600" />
                            <span className="text-sm font-medium text-red-900">Não Entregues</span>
                        </div>
                        <p className="text-3xl font-bold text-red-700">{counters.naoEntregues}</p>
                    </div>

                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                        <div className="flex items-center gap-2 mb-1">
                            <AlertTriangle className="w-5 h-5 text-amber-600" />
                            <span className="text-sm font-medium text-amber-900">Devolvidos Parcial</span>
                        </div>
                        <p className="text-3xl font-bold text-amber-700">{counters.devolvidosParciais}</p>
                    </div>
                </div>
            </div>

            {/* Validation Alerts */}
            {hasBlockingIssues && (
                <div className="bg-red-50 border-2 border-red-300 rounded-2xl p-4">
                    <div className="flex items-start gap-2">
                        <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="font-semibold text-red-900">Atenção: Retorno Incompleto</p>
                            <p className="text-sm text-red-700 mt-1">
                                {counters.pending} {counters.pending === 1 ? 'pedido não possui' : 'pedidos não possuem'} resultado definido.
                                Para finalizar o retorno, você deve marcar todos os pedidos como Entregue, Não Entregue ou Devolvido Parcial.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Exceptions List */}
            {exceptions.length > 0 && (
                <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Ocorrências</h3>
                    <div className="space-y-3">
                        {exceptions.map((exc, idx) => {
                            let typeLabel = '';
                            let typeColor = '';
                            let icon = null;

                            if (exc.type === 'NAO_ENTREGUE') {
                                typeLabel = 'Não Entregue';
                                typeColor = 'bg-red-50 border-red-200';
                                icon = <XCircle className="w-4 h-4 text-red-600" />;
                            } else if (exc.type === 'DEVOLVIDO_PARCIAL') {
                                typeLabel = 'Devolvido Parcial';
                                typeColor = 'bg-amber-50 border-amber-200';
                                icon = <AlertTriangle className="w-4 h-4 text-amber-600" />;
                            }

                            return (
                                <div key={idx} className={`border rounded-2xl p-3 ${typeColor}`}>
                                    <div className="flex items-start gap-2">
                                        {icon}
                                        <div className="flex-1">
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="font-semibold text-gray-900">
                                                    {exc.order.client?.trade_name || 'Cliente Desconhecido'}
                                                </span>
                                                <span className="text-xs font-medium px-2 py-0.5 rounded bg-white border border-gray-200">
                                                    {typeLabel}
                                                </span>
                                            </div>
                                            <p className="text-sm text-gray-700">
                                                Pedido #{exc.order.document_number}
                                            </p>
                                            {exc.reason && (
                                                <p className="text-sm text-gray-600 mt-1">
                                                    <strong>Motivo:</strong> {exc.reason}
                                                </p>
                                            )}
                                            {exc.type === 'DEVOLVIDO_PARCIAL' && exc.payload?.deliveredItems && (
                                                <p className="text-xs text-gray-500 mt-1">
                                                    Alguns itens foram devolvidos. Um pedido complementar será gerado.
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Success Message */}
            {!hasBlockingIssues && exceptions.length === 0 && counters.entregues > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-center">
                    <CheckCircle2 className="w-8 h-8 text-green-600 mx-auto mb-2" />
                    <p className="font-semibold text-green-900">Retorno Pronto para Finalizar</p>
                    <p className="text-sm text-green-700 mt-1">
                        Todos os pedidos foram processados com sucesso.
                    </p>
                </div>
            )}
        </div>
    );
}
