"use client";

import { useDraggable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { memo } from "react";
import { OrderItemsPopover } from "./OrderItemsPopover";

export const OrderCard = memo(function OrderCard({ order, type, routeId, isSelected, onToggleSelection, isDragOverlay, isLocked }: any) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: `order-${order.id}`,
        data: { type: 'order', id: order.id, sourceRouteId: routeId, order },
        disabled: isLocked
    });

    const style = transform ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    } : undefined;

    return (
        <OrderItemsPopover orderId={order.id}>
            <div
                ref={setNodeRef}
                style={style}
                {...listeners}
                {...attributes}
                className={cn(
                    "p-2 bg-white rounded-lg shadow-sm border border-gray-200 transition-all",
                    !isLocked && "cursor-grab active:cursor-grabbing hover:shadow-md",
                    isLocked && "cursor-not-allowed opacity-80 bg-gray-50/50",
                    (isDragging || isDragOverlay) && "opacity-50 ring-2 ring-primary"
                )}
            >
                {/* Line 1: Checkbox, Client Name (left), Date (right) */}
                <div className="flex items-center gap-2 mb-1">
                    {type === 'sandbox' && (
                        <input
                            type="checkbox"
                            className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer flex-shrink-0"
                            checked={isSelected}
                            onChange={(e) => {
                                e.stopPropagation();
                                onToggleSelection?.();
                            }}
                            onClick={(e) => e.stopPropagation()}
                        />
                    )}

                    <span className="text-xs text-gray-900 truncate flex-1">
                        {order.client?.trade_name || "Cliente Desconhecido"}
                    </span>

                    <span className="text-[10px] text-gray-400 flex-shrink-0">
                        {format(new Date(order.date_issued), "dd/MM")}
                    </span>
                </div>

                {/* Line 2: Order Number (left), Value (right) */}
                <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">
                        Pedido #{order.document_number?.toString().padStart(4, '0') || '...'}
                    </span>

                    <div className="flex flex-col items-end">
                        <span className="text-sm text-green-700 font-medium">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.total_amount || 0)}
                        </span>
                        {/* Weight Display */}
                        {order.total_weight_kg !== undefined && order.total_weight_kg !== null ? (
                            <span className="text-[10px] text-gray-500">
                                {new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(order.total_weight_kg)} kg
                            </span>
                        ) : (
                            <span className="text-[10px] text-amber-600 font-medium bg-amber-50 px-1 rounded" title="Peso não calculado">
                                kg ?
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </OrderItemsPopover>
    );
});
