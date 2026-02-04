"use client";

import { OrderCard } from "./OrderCard";

import { useState, useRef, memo } from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { DeliveryRoute } from "@/types/sales";
import { Truck, Package, DollarSign, X, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/use-toast";
import { createClient } from "@/utils/supabase/client";
import { removeOrderFromRoute } from "@/lib/data/expedition";
import { OrderItemsPopover } from "./OrderItemsPopover";
import { deleteRoute } from "@/lib/data/expedition";
import { ConfirmDialogDesdobra } from "@/components/ui/ConfirmDialogDesdobra";
import { normalizeRouteStatus } from "@/lib/constants/status";
import { Card } from "@/components/ui/Card";

interface UnscheduledRouteCardProps {
    route: DeliveryRoute;
    onDelete: () => void;
    onRemoveOrder: (orderId: string, routeId: string) => void;
}

export const UnscheduledRouteCard = memo(function UnscheduledRouteCard({ route, onDelete, onRemoveOrder }: UnscheduledRouteCardProps) {
    const [isHovered, setIsHovered] = useState(false);
    const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: `route-${route.id}`,
        data: { type: 'route', route },
    });

    const style = transform ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    } : undefined;

    const { setNodeRef: setDropRef, isOver } = useDroppable({
        id: `unscheduled-route-${route.id}`,
        data: { type: 'unscheduled-route', routeId: route.id },
    });

    const supabase = createClient();
    const { toast } = useToast();
    const [isDeleting, setIsDeleting] = useState(false);

    const orderCount = route.orders?.length || 0;
    const totalValue = route.orders?.reduce((sum, ro) => sum + (ro.sales_order?.total_amount || 0), 0) || 0;

    const [showDeleteAlert, setShowDeleteAlert] = useState(false);

    // Check if route is locked (em_rota or concluida - cannot be modified)
    const normalizedStatus = normalizeRouteStatus(route.status) || route.status;
    const isRouteLocked = normalizedStatus === 'in_route' || normalizedStatus === 'in_progress' || normalizedStatus === 'completed';

    const handleDeleteClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isRouteLocked) return;
        setShowDeleteAlert(true);
    };

    const confirmDelete = async () => {
        setIsDeleting(true);
        try {
            await deleteRoute(supabase, route.id);
            toast({ title: "Rota excluída com sucesso" });
            onDelete();
        } catch (err) {
            console.error(err);
            toast({ title: "Erro ao excluir rota", variant: "destructive" });
        } finally {
            setIsDeleting(false);
            setShowDeleteAlert(false);
        }
    };

    const [isOrderDetailsOpen, setIsOrderDetailsOpen] = useState(false);

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
        <>
            <Popover open={isHovered && !isOrderDetailsOpen} onOpenChange={setIsHovered}>
                <PopoverTrigger asChild>
                    <div
                        ref={setDropRef}
                        className={cn(
                            "transition-colors rounded-lg",
                            isOver && !isRouteLocked && "ring-2 ring-blue-300 bg-blue-50"
                        )}
                        onMouseEnter={handleMouseEnter}
                        onMouseLeave={handleMouseLeave}
                    >
                        <Card
                            ref={setNodeRef}
                            style={style}
                            className={cn(
                                "bg-white border border-gray-200/70 overflow-hidden transition-all duration-200 ease-out",
                                !isRouteLocked && "hover:shadow-card",
                                isRouteLocked && "opacity-75 bg-gray-50/50",
                                isDragging && "opacity-50 ring-2 ring-blue-400 shadow-float scale-105",
                                isDeleting && "opacity-50 pointer-events-none"
                            )}
                        >
                            {/* Header - 1 line: drag handle + route name + delete button */}
                            <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 bg-white">
                                <div
                                    {...(!isRouteLocked ? listeners : {})}
                                    {...(!isRouteLocked ? attributes : {})}
                                    className={cn(
                                        "flex items-center gap-2 flex-1 truncate",
                                        !isRouteLocked && "cursor-grab active:cursor-grabbing",
                                        isRouteLocked && "cursor-default"
                                    )}
                                >
                                    {!isRouteLocked && <GripVertical className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />}
                                    <Truck className="w-4 h-4 text-blue-600 flex-shrink-0" />
                                    <span className="text-sm font-semibold text-gray-800 truncate flex-1">
                                        {route.name}
                                    </span>
                                    {/* Weight in header */}
                                    {(() => {
                                        let hasUnknown = false;
                                        const weight = route.orders?.reduce((sum, ro) => {
                                            if (ro.sales_order?.total_weight_kg === undefined || ro.sales_order?.total_weight_kg === null) {
                                                hasUnknown = true;
                                                return sum;
                                            }
                                            return sum + ro.sales_order.total_weight_kg;
                                        }, 0) || 0;

                                        return (
                                            <span className={cn("text-xs font-normal", hasUnknown ? "text-amber-600" : "text-gray-500")}>
                                                {new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(weight)} kg
                                                {hasUnknown && "*"}
                                            </span>
                                        );
                                    })()}
                                </div>
                                {!isRouteLocked && (
                                    <button
                                        onClick={handleDeleteClick}
                                        disabled={isDeleting}
                                        className="w-6 h-6 flex items-center justify-center rounded-sm hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors flex-shrink-0 disabled:opacity-50"
                                        title="Excluir rota"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>

                            {/* Order List */}
                            <div className="min-h-20 max-h-52 overflow-y-auto scrollbar-thin bg-gray-50/50 p-2">
                                {route.orders && route.orders.length > 0 ? (
                                    <div className="space-y-2">
                                        {route.orders.map((ro) => {
                                            const order = ro.sales_order;
                                            if (!order) return null;

                                            return (
                                                <OrderCard
                                                    key={ro.id}
                                                    order={order}
                                                    type="route"
                                                    routeId={route.id}
                                                    isLocked={isRouteLocked}
                                                />
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center text-center text-gray-400 gap-1 py-4 border-2 border-dashed border-gray-200/50 rounded-lg">
                                        <Package className="w-4 h-4 opacity-50" />
                                        <span className="text-[10px]">Arraste pedidos aqui</span>
                                    </div>
                                )}
                            </div>
                        </Card>
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
                    <Card className="bg-white shadow-float border border-gray-200/70 overflow-hidden">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-blue-50 to-blue-100 px-3 py-2 border-b border-blue-200">
                            <div className="flex items-center justify-between gap-2 mb-1">
                                <div className="flex items-center gap-2">
                                    <Truck className="w-4 h-4 text-blue-600" />
                                    <span className="font-semibold text-sm text-gray-900">{route.name}</span>
                                </div>
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
                        <div className="max-h-52 overflow-y-auto">
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
                                                        {!isRouteLocked && (
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
                    </Card>
                </PopoverContent>
            </Popover>

            <ConfirmDialogDesdobra
                open={showDeleteAlert}
                onOpenChange={setShowDeleteAlert}
                title="Excluir Rota"
                description={
                    <div>
                        <p>Deseja realmente excluir a rota <span className="font-semibold text-gray-900">"{route.name}"</span>?</p>
                        {route.orders && route.orders.length > 0 && (
                            <div className="mt-3 p-3 bg-red-50 border-l-4 border-red-500 rounded-r text-red-700 text-sm">
                                <p className="font-semibold">⚠️ Ação irreversível para a rota</p>
                                <p>Esta rota possui {route.orders.length} pedidos. Eles voltarão para o Sandbox.</p>
                            </div>
                        )}
                    </div>
                }
                confirmText="Excluir"
                cancelText="Cancelar"
                onConfirm={confirmDelete}
                variant="danger"
                isLoading={isDeleting}
            />
        </>
    );
});
