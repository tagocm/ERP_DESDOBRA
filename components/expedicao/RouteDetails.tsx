'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, Truck, Package } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ProductSeparationList } from './ProductSeparationList';
import { LoadingChecklist } from './LoadingChecklist';

interface RouteDetailsProps {
    route: any;
    onClose: () => void;
    onStartRoute: (routeId: string) => void;
}

export function RouteDetails({ route, onClose, onStartRoute }: RouteDetailsProps) {
    const [activeTab, setActiveTab] = useState<'separation' | 'checklist'>('separation');

    if (!route) {
        return (
            <div className="bg-white border border-gray-200 rounded-lg p-12 text-center text-gray-500">
                <Package className="w-12 h-12 mx-auto mb-4 opacity-20" />
                <p>Selecione uma rota para ver os detalhes</p>
            </div>
        );
    }

    const loadedCount = route.orders?.filter((o: any) => o.sales_order?.loading_checked).length || 0;
    const totalCount = route.orders?.length || 0;
    const allLoaded = loadedCount === totalCount && totalCount > 0;
    const hasInRouteOrders = route.orders?.some((o: any) => o.sales_order?.status_logistic === 'em_rota');

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-lg font-semibold">{route.name}</h2>
                        <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                            <span className="flex items-center gap-1">
                                <Calendar className="w-4 h-4" />
                                {format(new Date(route.scheduled_date), "dd/MM/yyyy", { locale: ptBR })}
                            </span>
                            <span className="flex items-center gap-1">
                                <Truck className="w-4 h-4" />
                                {totalCount} {totalCount === 1 ? 'pedido' : 'pedidos'}
                            </span>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-sm text-gray-600">Carregamento</div>
                        <div className={`text-2xl font-bold ${allLoaded ? 'text-green-600' : 'text-gray-900'}`}>
                            {loadedCount} / {totalCount}
                        </div>
                    </div>
                </div>

                {allLoaded && !hasInRouteOrders && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
                        <p className="text-sm text-green-800">
                            ✓ Todos os pedidos foram conferidos e carregados. Pronto para iniciar a rota!
                        </p>
                    </div>
                )}

                <div className="flex bg-gray-100 p-1 rounded-lg">
                    <button
                        onClick={() => setActiveTab('separation')}
                        className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'separation'
                                ? 'bg-white text-gray-900 shadow-sm ring-1 ring-gray-200'
                                : 'text-gray-500 hover:text-gray-900'
                            }`}
                    >
                        Lista de Separação
                    </button>
                    <button
                        onClick={() => setActiveTab('checklist')}
                        className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'checklist'
                                ? 'bg-white text-gray-900 shadow-sm ring-1 ring-gray-200'
                                : 'text-gray-500 hover:text-gray-900'
                            }`}
                    >
                        Romaneio / Checklist
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="bg-white border border-gray-200 rounded-lg">
                {activeTab === 'separation' ? (
                    <ProductSeparationList routeId={route.id} />
                ) : (
                    <LoadingChecklist route={route} />
                )}
            </div>
        </div>
    );
}
