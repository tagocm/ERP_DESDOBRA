"use client";

import { useState, memo, useRef, useMemo } from "react";
import { useDraggable } from "@dnd-kit/core";
import { DeliveryRoute } from "@/types/sales";
import { Truck, Package, DollarSign, X, CalendarOff } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/Button";
import { OrderItemsPopover } from "./OrderItemsPopover";
import { getRouteStatusColor, getOrderStatusIndicator } from "@/lib/route-status-helpers";
import { StatusDots } from "./StatusDots";

interface RouteCardCompactProps {
    route: DeliveryRoute;
    onClick?: () => void;
    onRemoveOrder?: (orderId: string, routeId: string) => void;
    onUnscheduleRoute?: (routeId: string) => void;
}

export const RouteCardCompact = memo(function RouteCardCompact({ route, onClick, onRemoveOrder, onUnscheduleRoute }: RouteCardCompactProps) {
    const [isHovered, setIsHovered] = useState(false);
    const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: `route-${route.id}`,
        data: { type: 'route', route },
    });

    const style = transform ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    } : undefined;

    const orderCount = route.orders?.length || 0;
    const totalValue = route.orders?.reduce((sum, ro) => sum + (ro.sales_order?.total_amount || 0), 0) || 0;

    // Route status color
    const routeStatusColor = useMemo(() => getRouteStatusColor(route), [route]);

    // Check if route is locked (em_rota or concluida - cannot be modified)
    const isRouteLocked = useMemo(() => {
        const status = route?.status;
        return status === 'em_rota' || status === 'in_progress' || status === 'concluida' || status === 'cancelada';
    }, [route]);

    // Order status dots
    const orderStatusDots = useMemo(() => {
        if (!route.orders || route.orders.length === 0) return [];

        return route.orders.map((ro) => ({
            key: ro.id,
            color: getOrderStatusIndicator(ro.sales_order, ro)
        }));
    }, [route.orders]);

    const handleMouseEnter = () => {
        if (closeTimeoutRef.current) {
            clearTimeout(closeTimeoutRef.current);
            closeTimeoutRef.current = null;
        }
        // Add 300ms delay before opening to avoid accidental opens
        closeTimeoutRef.current = setTimeout(() => {
            setIsHovered(true);
        }, 300);
    };

    const handleMouseLeave = () => {
        if (closeTimeoutRef.current) {
            clearTimeout(closeTimeoutRef.current);
            closeTimeoutRef.current = null;
        }
        closeTimeoutRef.current = setTimeout(() => {
            setIsHovered(false);
        }, 200);
    };

    return (
        <Popover open={isHovered} onOpenChange={setIsHovered}>
            <PopoverTrigger asChild>
                <div
                    ref={setNodeRef}
                    style={style}
                    className={cn(
                        "border rounded px-2 py-1 shadow-sm hover:shadow-md group",
                        "transition-all duration-200 ease-out",
                        // Route status colors
                        routeStatusColor === 'neutral' && "bg-white border-gray-200",
                        routeStatusColor === 'yellow' && "bg-amber-50 border-amber-300",
                        routeStatusColor === 'green' && "bg-green-50 border-green-300",
                        routeStatusColor === 'red' && "bg-red-50 border-red-300",
                        // Drag styles
                        !isRouteLocked && "cursor-grab active:cursor-grabbing",
                        isRouteLocked && "cursor-not-allowed opacity-75",
                        isDragging && "opacity-50 ring-2 ring-blue-400 shadow-lg scale-105"
                    )}
                    onClick={onClick}
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                    {...(!isRouteLocked ? listeners : {})}
                    {...(!isRouteLocked ? attributes : {})}
                >
                    {/* Single Line: Name */}
                    <div className="flex items-center gap-1">
                        <Truck className="w-3 h-3 text-blue-500 flex-shrink-0" />
                        <span className="text-[10px] font-medium text-gray-700 truncate flex-1">
                            {route.name}
                        </span>
                        <div className="flex items-center text-[9px] text-gray-400 flex-shrink-0 gap-1">
                            <span>({orderCount})</span>
                            {(() => {
                                const weight = route.orders?.reduce((sum, ro) => sum + (ro.sales_order?.total_weight_kg || 0), 0) || 0;
                                return (
                                    <span className="text-gray-500 font-medium">
                                        {new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(weight)}kg
                                    </span>
                                );
                            })()}
                        </div>
                    </div>
                    {/* Status Dots */}
                    {orderStatusDots.length > 0 && (
                        <div className="mt-0.5">
                            <StatusDots dots={orderStatusDots} maxVisible={5} size="sm" />
                        </div>
                    )}
                </div>
            </PopoverTrigger>

            <PopoverContent
                className="w-64 p-0"
                side="right"
                align="start"
                onOpenAutoFocus={(e) => e.preventDefault()}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
            >
                <div className="bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-blue-50 to-blue-100 px-3 py-2 border-b border-blue-200">
                        <div className="flex items-center justify-between gap-2 mb-1">
                            <div className="flex items-center gap-2">
                                <Truck className="w-4 h-4 text-blue-600" />
                                <span className="font-semibold text-sm text-gray-900">{route.name}</span>
                            </div>
                            {onUnscheduleRoute && route.scheduled_date && !isRouteLocked && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0 text-gray-500 hover:text-red-600 hover:bg-red-50"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setIsHovered(false);
                                        onUnscheduleRoute(route.id);
                                    }}
                                    title="Desagendar rota"
                                >
                                    <CalendarOff className="w-3.5 h-3.5" />
                                </Button>
                            )}
                        </div>
                        <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1 text-gray-600">
                                <Package className="w-3 h-3" />
                                <span>{orderCount} {orderCount === 1 ? 'pedido' : 'pedidos'}</span>
                                <span className="mx-1 text-gray-300">|</span>
                                {(() => {
                                    let hasUnknown = false;
                                    const weight = route.orders?.reduce((sum, ro) => {
                                        if (ro.sales_order?.total_weight_kg === undefined || ro.sales_order?.total_weight_kg === null) {
                                            hasUnknown = true;
                                            return sum;
                                        }
                                        return sum + ro.sales_order.total_weight_kg;
                                    }, 0) || 0;

                                    if (hasUnknown && weight === 0) return <span className="text-amber-600 font-medium">Peso desc.</span>;

                                    return (
                                        <span className={cn("font-medium", hasUnknown && "text-amber-600")}>
                                            {new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(weight)} kg
                                            {hasUnknown && "*"}
                                        </span>
                                    );
                                })()}
                            </div>
                            <div className="flex items-center gap-1 text-blue-800 font-semibold">
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
                    <div className="max-h-[200px] overflow-y-auto">
                        {route.orders && route.orders.length > 0 ? (
                            route.orders.map((ro) => {
                                const order = ro.sales_order;
                                if (!order) return null;

                                return (
                                    <OrderItemsPopover key={ro.id} orderId={order.id}>
                                        <div className="px-3 py-2 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0">
                                            <div className="flex items-start justify-between gap-2">
                                                {/* Status Dot */}
                                                <div className="flex-shrink-0 pt-1">
                                                    <div
                                                        className={cn(
                                                            "w-2 h-2 rounded-full",
                                                            getOrderStatusIndicator(order, ro) === 'green' && "bg-green-500",
                                                            getOrderStatusIndicator(order, ro) === 'yellow' && "bg-amber-400",
                                                            getOrderStatusIndicator(order, ro) === 'red' && "bg-red-500",
                                                            getOrderStatusIndicator(order, ro) === 'neutral' && "bg-gray-300"
                                                        )}
                                                    />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-xs font-medium text-gray-900 truncate">
                                                        {order.client?.trade_name || "Cliente Desconhecido"}
                                                    </div>
                                                    <div className="text-[10px] text-gray-500 mt-0.5">
                                                        Pedido #{order.document_number}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                                    <div className="flex flex-col items-end">
                                                        <div className="text-xs text-gray-700 font-medium">
                                                            {new Intl.NumberFormat('pt-BR', {
                                                                style: 'currency',
                                                                currency: 'BRL',
                                                            }).format(order.total_amount || 0)}
                                                        </div>
                                                        <div className="text-[10px] text-gray-400">
                                                            {new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(order.total_weight_kg || 0)} kg
                                                        </div>
                                                    </div>
                                                    {onRemoveOrder && !isRouteLocked && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-5 w-5 p-0 text-gray-400 hover:text-red-600 hover:bg-red-50"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setIsHovered(false);
                                                                onRemoveOrder(order.id, route.id);
                                                            }}
                                                            title="Remover pedido da rota"
                                                        >
                                                            <X className="w-3.5 h-3.5" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </OrderItemsPopover>
                                );
                            })
                        ) : (
                            <div className="px-3 py-4 text-center text-xs text-gray-400">
                                Nenhum pedido nesta rota
                            </div>
                        )}
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
});

