"use client";

import { useState, memo, useRef } from "react";
import { useDraggable } from "@dnd-kit/core";
import { DeliveryRoute } from "@/types/sales";
import { Truck, Package, DollarSign, X, CalendarOff } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/Button";
import { OrderItemsPopover } from "./OrderItemsPopover";

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
                        "bg-white border border-gray-200 rounded px-2 py-1 shadow-sm hover:shadow-md cursor-grab active:cursor-grabbing group",
                        "transition-all duration-200 ease-out",
                        isDragging && "opacity-50 ring-2 ring-blue-400 shadow-lg scale-105"
                    )}
                    onClick={onClick}
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                    {...listeners}
                    {...attributes}
                >
                    {/* Single Line: Name */}
                    <div className="flex items-center gap-1">
                        <Truck className="w-3 h-3 text-blue-500 flex-shrink-0" />
                        <span className="text-[10px] font-medium text-gray-700 truncate flex-1">
                            {route.name}
                        </span>
                        <span className="text-[9px] text-gray-400 flex-shrink-0">
                            {orderCount}
                        </span>
                    </div>
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
                            {onUnscheduleRoute && route.scheduled_date && (
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
                            </div>
                            <div className="flex items-center gap-1 text-blue-800 font-semibold">
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
                    <div className="max-h-[200px] overflow-y-auto">
                        {route.orders && route.orders.length > 0 ? (
                            route.orders.map((ro) => {
                                const order = ro.sales_order;
                                if (!order) return null;

                                return (
                                    <OrderItemsPopover key={ro.id} orderId={order.id}>
                                        <div className="px-3 py-2 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0">
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-xs font-medium text-gray-900 truncate">
                                                        {order.client?.trade_name || "Cliente Desconhecido"}
                                                    </div>
                                                    <div className="text-[10px] text-gray-500 mt-0.5">
                                                        Pedido #{order.document_number}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                                    <div className="text-xs text-gray-700 font-medium">
                                                        {new Intl.NumberFormat('pt-BR', {
                                                            style: 'currency',
                                                            currency: 'BRL',
                                                        }).format(order.total_amount || 0)}
                                                    </div>
                                                    {onRemoveOrder && (
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

