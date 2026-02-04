"use client";

import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { DeliveryRoute } from "@/types/sales";
import { Calendar, Truck, Package, DollarSign, X, CalendarOff, Printer } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { createClient } from "@/utils/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { updateOrderVolumes } from "@/lib/data/expedition";
import { generateVolumeLabelZPL, downloadZpl } from "@/lib/zpl-generator";
import { Input } from "@/components/ui/Input";

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
    const supabase = createClient(); // Need supabase client
    const { toast } = useToast();

    const handleVolumeChange = async (routeId: string, orderId: string, newVolume: number) => {
        if (newVolume < 1) return;
        try {
            await updateOrderVolumes(supabase, routeId, orderId, newVolume);
            toast({ title: "Volumes atualizados" });
        } catch (e) {
            console.error(e);
            toast({ title: "Erro ao atualizar volumes", variant: "destructive" });
        }
    };

    const handlePrintRoute = (route: DeliveryRoute) => {
        let zpl = '';
        route.orders?.forEach(ro => {
            const vols = ro.volumes || 1;
            const order = ro.sales_order!;
            for (let i = 1; i <= vols; i++) {
                zpl += generateVolumeLabelZPL(order, route, i, vols);
            }
        });
        if (zpl) downloadZpl(zpl, `etiquetas-rota-${route.name}.zpl`);
        else toast({ title: "Nada para imprimir", variant: "destructive" });
    };

    const handlePrintOrder = (route: DeliveryRoute, ro: any) => {
        let zpl = '';
        const vols = ro.volumes || 1;
        const order = ro.sales_order!;
        for (let i = 1; i <= vols; i++) {
            zpl += generateVolumeLabelZPL(order, route, i, vols);
        }
        downloadZpl(zpl, `etiquetas-pedido-${order.document_number}.zpl`);
    };

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
                        const totalWeight = route.orders?.reduce((sum, ro) => sum + (ro.sales_order?.total_weight_kg || 0), 0) || 0;

                        return (
                            <div key={route.id} className="border border-gray-200 rounded-2xl overflow-hidden">
                                {/* Route Header */}
                                <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                                    <div className="flex items-start justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <Truck className="w-4 h-4 text-blue-500" />
                                            <div>
                                                <h3 className="font-semibold text-gray-900">{route.name}</h3>
                                                <div className="text-[10px] text-gray-500 font-medium">
                                                    {orderCount} pedidos • {new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(totalWeight)} kg
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex gap-1">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-7 px-2 text-xs"
                                                onClick={() => handlePrintRoute(route)}
                                                title="Imprimir etiquetas desta rota"
                                            >
                                                <Printer className="w-3 h-3 mr-1" />
                                                Etiquetas
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-7 px-2 text-xs text-gray-500 hover:text-red-600"
                                                onClick={() => onUnscheduleRoute(route.id)}
                                            >
                                                <CalendarOff className="w-3 h-3" />
                                            </Button>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between text-xs text-gray-600 mt-2">
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
                                                            <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-2">
                                                                <span>Pedido #{order.document_number}</span>
                                                                <span className="text-gray-300">|</span>
                                                                <span className="font-medium text-gray-600">
                                                                    {new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(order.total_weight_kg || 0)} kg
                                                                </span>
                                                            </div>
                                                            <div className="mt-2 flex items-center gap-2">
                                                                <div className="flex items-center gap-1">
                                                                    <label className="text-[10px] text-gray-500 uppercase font-bold">Vol:</label>
                                                                    <Input
                                                                        type="number"
                                                                        min={1}
                                                                        defaultValue={ro.volumes || 1}
                                                                        className="w-16 h-6 text-xs px-1"
                                                                        onBlur={(e) => handleVolumeChange(route.id, order.id, parseInt(e.target.value))}
                                                                    />
                                                                </div>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-6 w-6 p-0"
                                                                    onClick={() => handlePrintOrder(route, ro)}
                                                                    title="Imprimir etiquetas"
                                                                >
                                                                    <Printer className="w-3 h-3 text-gray-400 hover:text-blue-600" />
                                                                </Button>
                                                            </div>
                                                        </div>
                                                        <div className="flex flex-col items-end gap-1">
                                                            <div className="text-xs text-gray-600 font-medium">
                                                                {new Intl.NumberFormat('pt-BR', {
                                                                    style: 'currency',
                                                                    currency: 'BRL',
                                                                }).format(order.total_amount || 0)}
                                                            </div>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-7 w-7 p-0 text-gray-400 hover:text-red-600"
                                                                onClick={() => onRemoveOrderFromRoute(order.id, route.id)}
                                                            >
                                                                <X className="w-4 h-4" />
                                                            </Button>
                                                        </div>
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
                                            onClick={() => {
                                                // Close any open flyouts
                                                window.dispatchEvent(new CustomEvent('closeFlyouts'));
                                                onOpenRouteDetails(route.id);
                                            }}
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
