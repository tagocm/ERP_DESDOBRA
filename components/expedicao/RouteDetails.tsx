'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, Truck, Package, Printer } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ProductSeparationList } from './ProductSeparationList';
import { LoadingChecklist } from './LoadingChecklist';
import { useQZPrinter } from '@/hooks/useQZPrinter';
import { PrinterConfigDialog } from '@/components/print/PrinterConfigDialog';
import { generateVolumeLabelZPL, downloadZpl } from '@/lib/zpl-generator';
import { useToast } from "@/components/ui/use-toast";
import { DeliveryRoute } from '@/types/sales';
import { normalizeLoadingStatus, normalizeLogisticsStatus } from '@/lib/constants/status';

interface RouteDetailsProps {
    route: any;
    onClose: () => void;
    onStartRoute: (routeId: string) => void;
}

export function RouteDetails({ route, onClose, onStartRoute }: RouteDetailsProps) {
    const [activeTab, setActiveTab] = useState<'separation' | 'checklist'>('separation');
    const { toast } = useToast();
    const printer = useQZPrinter();

    if (!route) {
        return (
            <div className="bg-white border border-gray-200 rounded-lg p-12 text-center text-gray-500">
                <Package className="w-12 h-12 mx-auto mb-4 opacity-20" />
                <p>Selecione uma rota para ver os detalhes</p>
            </div>
        );
    }

    const handlePrintRoute = async () => {
        let zpl = '';
        route.orders?.forEach((ro: any) => {
            const vols = ro.volumes || 1;
            const order = ro.sales_order!;
            for (let i = 1; i <= vols; i++) {
                zpl += generateVolumeLabelZPL(order, route, i, vols);
            }
        });

        if (!zpl) {
            toast({ title: "Nada para imprimir", variant: "destructive" });
            return;
        }

        await printer.print(zpl);
    };

    const countLoaded = route.orders?.filter((o: any) => normalizeLoadingStatus(o.loading_status) === 'loaded').length || 0;
    const countPartial = route.orders?.filter((o: any) => normalizeLoadingStatus(o.loading_status) === 'partial').length || 0;
    const countNotLoaded = route.orders?.filter((o: any) => normalizeLoadingStatus(o.loading_status) === 'not_loaded').length || 0;
    const totalCount = route.orders?.length || 0;

    // Effective pending: real pending ones (no status decision yet)
    // Processed if it has a hard status OR has an occurrence registered
    const countProcessed = route.orders?.filter((o: any) => {
        const hasStatus = ['loaded', 'partial', 'not_loaded'].includes(normalizeLoadingStatus(o.loading_status) || o.loading_status) || o.sales_order?.loading_checked;
        const hasLegacyNotLoaded = (normalizeLoadingStatus(o.loading_status) === 'pending') && o.partial_payload?.status === 'not_loaded';
        const hasOccurrence = o.sales_order?.occurrences?.length > 0;
        return hasStatus || hasLegacyNotLoaded || hasOccurrence;
    }).length || 0;

    const countPending = totalCount - countProcessed;

    const isReady = countPending === 0 && totalCount > 0;
    const hasPartials = countPartial > 0;
    const hasNotLoaded = countNotLoaded > 0;

    const hasInRouteOrders = route.orders?.some((o: any) => (normalizeLogisticsStatus(o.sales_order?.status_logistic) || o.sales_order?.status_logistic) === 'in_route');
    const totalWeight = route.orders?.reduce((sum: number, ro: any) => sum + (ro.sales_order?.total_weight_kg || 0), 0) || 0;

    return (
        <div className="space-y-4">
            <PrinterConfigDialog
                open={printer.configOpen}
                onOpenChange={printer.setConfigOpen}
                printerHook={printer}
            />

            {/* Header */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between mb-4">
                    <div>
                        <h2 className="text-lg font-semibold mb-2">{route.name}</h2>
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                            <span className="flex items-center gap-1">
                                <Calendar className="w-4 h-4" />
                                {format(new Date(route.scheduled_date), "dd/MM/yyyy", { locale: ptBR })}
                            </span>
                            <span className="flex items-center gap-1">
                                <Truck className="w-4 h-4" />
                                {totalCount} {totalCount === 1 ? 'pedido' : 'pedidos'}
                            </span>
                            <span className="font-medium text-gray-900">
                                {new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(totalWeight)} kg
                            </span>
                        </div>

                        {/* Breakdown Counters */}
                        <div className="flex items-center gap-3 mt-3 text-xs font-medium">
                            <span className="text-green-700 bg-green-50 px-2 py-0.5 rounded">
                                Completos: {countLoaded}
                            </span>
                            <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                                Parciais: {countPartial}
                            </span>
                            <span className="text-red-700 bg-red-50 px-2 py-0.5 rounded">
                                Não Carregados: {countNotLoaded}
                            </span>
                            <span className="text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                                Pendentes: {countPending}
                            </span>
                        </div>
                    </div>

                    <div className="flex flex-col items-end gap-3">
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs gap-2"
                            onClick={handlePrintRoute}
                        >
                            <Printer className="w-3 h-3" />
                            Etiquetas ({totalCount})
                        </Button>

                        <div className="text-right">
                            <div className="text-sm text-gray-600">Carregamento</div>
                            <div className={`text-2xl font-bold ${isReady
                                ? (hasPartials || hasNotLoaded ? 'text-amber-600' : 'text-green-600')
                                : 'text-gray-900'
                                }`}>
                                {countProcessed} / {totalCount}
                            </div>
                        </div>
                    </div>
                </div>

                {isReady && !hasInRouteOrders && (
                    <div className={`border rounded-lg p-3 mb-4 ${hasPartials || hasNotLoaded ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
                        <p className={`text-sm ${hasPartials || hasNotLoaded ? 'text-amber-800' : 'text-green-800'}`}>
                            {hasPartials || hasNotLoaded
                                ? `✓ Conferência concluída (com ${hasPartials && hasNotLoaded ? "parciais e não carregados" : hasPartials ? "parciais" : "não carregados"}). Pronto para iniciar a rota!`
                                : "✓ Todos os pedidos foram conferidos e carregados. Pronto para iniciar a rota!"
                            }
                        </p>
                    </div>
                )}

                <div className="flex bg-gray-100 p-1 rounded-lg">
                    <button
                        onClick={() => setActiveTab('separation')}
                        className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'separation'
                            ? 'bg-white text-gray-900 ring-1 ring-gray-200'
                            : 'text-gray-500 hover:text-gray-900'
                            }`}
                    >
                        Lista de Separação
                    </button>
                    <button
                        onClick={() => setActiveTab('checklist')}
                        className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'checklist'
                            ? 'bg-white text-gray-900 ring-1 ring-gray-200'
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
                    <LoadingChecklist route={route} printer={printer} />
                )}
            </div>
        </div>
    );
}
