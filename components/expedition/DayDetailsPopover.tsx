"use client";

import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { DeliveryRoute } from "@/types/sales";
import { Calendar, Truck, Package, DollarSign, X, CalendarOff } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface DayDetailsPopoverProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    date: Date;
    routes: DeliveryRoute[];
    onUnscheduleRoute: (routeId: string) => void;
    onRemoveOrderFromRoute: (orderId: string, routeId: string) => void;
    onOpenRouteDetails?: (routeId: string) => void;
}

export function DayDetailsPopover({
    open,
    onOpenChange,
    date,
    routes,
    onUnscheduleRoute,
    onRemoveOrderFromRoute,
    onOpenRouteDetails,
}: DayDetailsPopoverProps) {
    return (
        <Sheet isOpen={open} onClose={() => onOpenChange(false)} title={format(date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}>
            <div className="space-y-4">
                <p className="text-sm text-gray-500">
                    {routes.length} {routes.length === 1 ? 'rota agendada' : 'rotas agendadas'} para este dia
                </p>

                {routes.length === 0 ? (
                    <div className="py-12 text-center text-gray-400">
                        <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p className="text-sm">Nenhuma rota agendada para este dia</p>
                    </div>
                ) : (
                    routes.map((route) => {
                        const orderCount = route.orders?.length || 0;
                        const totalValue = route.orders?.reduce((sum, ro) => sum + (ro.sales_order?.total_amount || 0), 0) || 0;

                        return (
                            <div key={route.id} className="border border-gray-200 rounded-lg overflow-hidden">
                                {/* Route Header */}
                                <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                                    <div className="flex items-start justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <Truck className="w-4 h-4 text-blue-500" />
                                            <h3 className="font-semibold text-gray-900">{route.name}</h3>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 px-2 text-xs text-gray-500 hover:text-red-600"
                                            onClick={() => onUnscheduleRoute(route.id)}
                                        >
                                            <CalendarOff className="w-3 h-3 mr-1" />
                                            Desagendar
                                        </Button>
                                    </div>
                                    <div className="flex items-center gap-4 text-xs text-gray-600">
                                        <div className="flex items-center gap-1">
                                            <Package className="w-3 h-3" />
                                            <span>{orderCount} {orderCount === 1 ? 'pedido' : 'pedidos'}</span>
                                        </div>
                                        <div className="flex items-center gap-1 font-medium">
                                            <DollarSign className="w-3 h-3" />
                                            <span>
                                                {new Intl.NumberFormat('pt-BR', {
                                                    style: 'currency',
                                                    currency: 'BRL',
                                                }).format(totalValue)}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Orders List */}
                                <div className="divide-y divide-gray-100">
                                    {route.orders && route.orders.length > 0 ? (
                                        route.orders.map((ro) => {
                                            const order = ro.sales_order;
                                            if (!order) return null;

                                            return (
                                                <div
                                                    key={ro.id}
                                                    className="px-4 py-3 hover:bg-gray-50 transition-colors"
                                                >
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="flex-1 min-w-0">
                                                            <div className="text-sm font-medium text-gray-900 truncate">
                                                                {order.client?.trade_name || "Cliente Desconhecido"}
                                                            </div>
                                                            <div className="text-xs text-gray-500 mt-0.5">
                                                                Pedido #{order.document_number}
                                                            </div>
                                                            <div className="text-xs text-gray-600 font-medium mt-1">
                                                                {new Intl.NumberFormat('pt-BR', {
                                                                    style: 'currency',
                                                                    currency: 'BRL',
                                                                }).format(order.total_amount || 0)}
                                                            </div>
                                                        </div>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-7 w-7 p-0 text-gray-400 hover:text-red-600 flex-shrink-0"
                                                            onClick={() => onRemoveOrderFromRoute(order.id, route.id)}
                                                        >
                                                            <X className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <div className="px-4 py-6 text-center text-xs text-gray-400">
                                            Nenhum pedido nesta rota
                                        </div>
                                    )}
                                </div>

                                {/* Route Actions */}
                                {onOpenRouteDetails && (
                                    <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="w-full text-xs"
                                            onClick={() => onOpenRouteDetails(route.id)}
                                        >
                                            Ver detalhes completos da rota
                                        </Button>
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </Sheet>
    );
}
