"use client";

import { useState, useRef, useEffect } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Package, Hash } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

interface OrderItem {
    id: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    product?: {
        id: string;
        name: string;
        sku: string;
    };
}

interface OrderItemsPopoverProps {
    orderId: string;
    children: React.ReactNode;
}

export function OrderItemsPopover({ orderId, children }: OrderItemsPopoverProps) {
    const [isHovered, setIsHovered] = useState(false);
    const [items, setItems] = useState<OrderItem[]>([]);
    const [loading, setLoading] = useState(false);
    const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Calculate order total
    const orderTotal = items.reduce((sum, item) => sum + ((item.unit_price || 0) * (item.quantity || 1)), 0);

    const supabase = createClient();

    // Fetch items when popover opens
    useEffect(() => {
        if (isHovered && items.length === 0 && !loading) {
            fetchOrderItems();
        }
    }, [isHovered]);

    const fetchOrderItems = async () => {
        setLoading(true);
        try {
            console.log('Fetching items for order:', orderId);
            const { data, error } = await supabase
                .from('sales_document_items')
                .select(`
                    *,
                    product:items(id, name, sku)
                `)
                .eq('document_id', orderId)
                .order('created_at', { ascending: true });

            if (error) {
                console.error('Supabase error:', error);
                throw error;
            }
            console.log('Fetched items:', data);
            setItems((data as unknown) as OrderItem[]);
        } catch (err) {
            console.error('Error fetching order items:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleMouseEnter = () => {
        // Clear any pending close timeout
        if (closeTimeoutRef.current) {
            clearTimeout(closeTimeoutRef.current);
            closeTimeoutRef.current = null;
        }

        // Set 1 second delay before opening
        hoverTimeoutRef.current = setTimeout(() => {
            setIsHovered(true);
        }, 1000);
    };

    const handleMouseLeave = () => {
        // Clear opening timeout if mouse leaves before 1 second
        if (hoverTimeoutRef.current) {
            clearTimeout(hoverTimeoutRef.current);
            hoverTimeoutRef.current = null;
        }

        // Set delay before closing
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
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                    className="cursor-pointer"
                >
                    {children}
                </div>
            </PopoverTrigger>

            <PopoverContent
                className="w-80 p-0"
                side="right"
                align="start"
                onOpenAutoFocus={(e) => e.preventDefault()}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
            >
                <div className="bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
                    {/* Header - Green theme */}
                    <div className="bg-gradient-to-r from-green-50 to-green-100 px-3 py-2 border-b border-green-200">
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <Package className="w-4 h-4 text-green-600" />
                                <span className="font-semibold text-sm text-gray-900">Itens do Pedido</span>
                            </div>
                            {!loading && items.length > 0 && (
                                <div className="text-sm font-bold text-green-700">
                                    {new Intl.NumberFormat('pt-BR', {
                                        style: 'currency',
                                        currency: 'BRL',
                                    }).format(orderTotal)}
                                </div>
                            )}
                        </div>
                        {!loading && items.length > 0 && (
                            <div className="text-xs text-green-800 mt-1">
                                {items.length} {items.length === 1 ? 'item' : 'itens'}
                            </div>
                        )}
                    </div>

                    {/* Items List */}
                    <div className="max-h-[300px] overflow-y-auto">
                        {loading ? (
                            <div className="px-3 py-4 text-center text-xs text-gray-400">
                                Carregando itens...
                            </div>
                        ) : items.length > 0 ? (
                            items.map((item) => (
                                <div
                                    key={item.id}
                                    className="px-3 py-2 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0"
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex-1 min-w-0">
                                            <div className="text-xs font-medium text-gray-900 truncate">
                                                {item.product?.name || "Produto"}
                                            </div>
                                        </div>
                                        <div className="text-sm font-semibold text-green-700 flex-shrink-0">
                                            {item.quantity} un
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="px-3 py-4 text-center text-xs text-gray-400">
                                Nenhum item neste pedido
                            </div>
                        )}
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}
