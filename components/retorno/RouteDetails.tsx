'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { Card } from '@/components/ui/Card';
import { X } from 'lucide-react';
import { ReturnChecklist, ReturnStaging } from './ReturnChecklist';
import { ReturnSummary } from './ReturnSummary';

interface RouteDetailsProps {
    route: any;
    onClose: () => void;
    onFinishRoute: () => void;
    staging: Record<string, ReturnStaging>;
    onUpdateStaging: (orderId: string, data: ReturnStaging) => void;
}

export function RouteDetails({ route, onClose, onFinishRoute, staging, onUpdateStaging }: RouteDetailsProps) {
    if (!route) {
        return (
            <Card className="p-12">
                <div className="text-center text-gray-400">
                    <p>Selecione uma rota para visualizar os detalhes</p>
                </div>
            </Card>
        );
    }

    const totalOrders = route.orders?.length || 0;

    return (
        <div className="space-y-4">
            {/* Header */}
            <Card className="p-6">
                <div className="flex items-start justify-between">
                    <div className="flex-1">
                        <h2 className="text-2xl font-bold text-gray-900">{route.name}</h2>
                        <p className="text-sm text-gray-500 mt-1">
                            Status: Em Rota • {totalOrders} {totalOrders === 1 ? 'pedido' : 'pedidos'}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5 text-gray-400" />
                    </button>
                </div>
            </Card>

            {/* Tabs */}
            <Card className="overflow-hidden">
                <Tabs defaultValue="checklist" className="w-full">
                    <TabsList className="w-full justify-start rounded-none border-b bg-gray-50">
                        <TabsTrigger value="checklist" className="data-[state=active]:bg-white">
                            Checklist de Retorno
                        </TabsTrigger>
                        <TabsTrigger value="summary" className="data-[state=active]:bg-white">
                            Resumo
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="checklist" className="p-0">
                        <ReturnChecklist
                            route={route}
                            staging={staging}
                            onUpdateStaging={onUpdateStaging}
                        />
                    </TabsContent>

                    <TabsContent value="summary" className="p-0">
                        <ReturnSummary
                            route={route}
                            staging={staging}
                        />
                    </TabsContent>
                </Tabs>
            </Card>
        </div>
    );
}
