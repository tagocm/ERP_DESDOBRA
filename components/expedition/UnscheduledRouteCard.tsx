"use client";

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

    const handleDeleteClick = (e: React.MouseEvent) => {
        e.stopPropagation();
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
            <Popover open={isHovered} onOpenChange={setIsHovered}>
                <PopoverTrigger asChild>
                    <div
                        ref={setDropRef}
                        className={cn(
                            "transition-colors rounded-lg",
                            isOver && "ring-2 ring-blue-300 bg-blue-50"
                        )}
                        onMouseEnter={handleMouseEnter}
                        onMouseLeave={handleMouseLeave}
                    >
                        <div
                            ref={setNodeRef}
                            style={style}
                            className={cn(
                                "bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-md",
                                "transition-all duration-200 ease-out",
                                isDragging && "opacity-50 ring-2 ring-blue-400 shadow-lg scale-105",
                                isDeleting && "opacity-50 pointer-events-none"
                            )}
                        >
                            {/* Header - 1 line: drag handle + route name + delete button */}
                            <div className="flex items-center gap-2 px-2 py-1.5 border-b border-gray-100 bg-gray-50">
                                <div {...listeners} {...attributes} className="flex items-center gap-1 flex-1 cursor-grab active:cursor-grabbing">
                                    <GripVertical className="w-3 h-3 text-gray-400 flex-shrink-0" />
                                    <Truck className="w-3 h-3 text-blue-500 flex-shrink-0" />
                                    <span className="text-xs font-semibold text-gray-700 truncate">
                                        {route.name}
                                    </span>
                                </div>
                                <button
                                    onClick={handleDeleteClick}
                                    disabled={isDeleting}
                                    className="w-5 h-5 flex items-center justify-center rounded hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors flex-shrink-0 disabled:opacity-50"
                                    title="Excluir rota"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            </div>

                            {/* Order List */}
                            <div className="max-h-[120px] overflow-y-auto scrollbar-thin">
                                {route.orders && route.orders.length > 0 ? (
                                    route.orders.map((ro) => {
                                        const order = ro.sales_order;
                                        if (!order) return null;

                                        const handleRemoveOrder = async (e: React.MouseEvent) => {
                                            e.stopPropagation();
                                            try {
                                                await removeOrderFromRoute(supabase, route.id, order.id);
                                                toast({
                                                    title: "Pedido removido da rota",
                                                });
                                                onDelete();
                                            } catch (err) {
                                                console.error(err);
                                                toast({
                                                    title: "Erro ao remover pedido",
                                                    variant: "destructive",
                                                });
                                            }
                                        };

                                        return (
                                            <OrderItemsPopover key={ro.id} orderId={order.id}>
                                                <div className="px-2 py-1.5 flex items-center justify-between gap-2 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-xs font-medium text-gray-900 truncate">
                                                            {order.client?.trade_name || "Cliente Desconhecido"}
                                                        </div>
                                                        <div className="text-[10px] text-gray-500">
                                                            Pedido #{order.document_number}
                                                        </div>
                                                    </div>
                                                    <div className="text-xs text-gray-700 font-medium flex-shrink-0">
                                                        {new Intl.NumberFormat('pt-BR', {
                                                            style: 'currency',
                                                            currency: 'BRL',
                                                        }).format(order.total_amount || 0)}
                                                    </div>
                                                    <button
                                                        onClick={handleRemoveOrder}
                                                        className="w-4 h-4 flex items-center justify-center rounded hover:bg-red-50 text-gray-300 hover:text-red-600 transition-colors flex-shrink-0"
                                                        title="Remover pedido da rota"
                                                    >
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            </OrderItemsPopover>
                                        );
                                    })
                                ) : (
                                    <div className="px-2 py-3 text-center text-[10px] text-gray-400">
                                        Nenhum pedido
                                    </div>
                                )}
                            </div>
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
