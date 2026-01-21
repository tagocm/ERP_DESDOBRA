"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AlertTriangle, ShoppingCart, Loader2, Package } from "lucide-react";
import { getItemsBelowMinAction } from "@/app/actions/purchases";
import { Skeleton } from "@/components/ui/Skeleton";
import { useRouter } from "next/navigation";

interface ItemBelowMin {
    id: string;
    name: string;
    sku: string | null;
    type: string;
    uom: string;
    min_stock: number;
    current_stock: number;
}

export function ItemsBelowMinCard() {
    const [items, setItems] = useState<ItemBelowMin[]>([]);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const data = await getItemsBelowMinAction();
            setItems(data as ItemBelowMin[]);
        } catch (error) {
            console.error("Failed to load items below min:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateOrder = (item: ItemBelowMin) => {
        // Navigate to new PO with item pre-selected (via URL params or similar)
        // For now, just go to new PO page. Ideally we'd pass query params?
        // Or open a modal? The prompt says "open drawer/modal ... already filled".
        // Let's assume we can pass params to the /novo page or trigger the modal if it was on this page.
        // Given the instructions say "Dashboard... 3 cards", and "New PO" is a separate route or reused form, 
        // let's navigate to /novo with `?itemId=...`
        router.push(`/app/compras/pedidos/novo?itemId=${item.id}`);
    };

    if (loading) {
        return (
            <Card className="bg-white shadow-sm border-gray-100">
                <CardHeader className="pb-2">
                    <Skeleton className="h-6 w-48 mb-1" />
                    <Skeleton className="h-4 w-32" />
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (items.length === 0) {
        return (
            <Card className="bg-white shadow-sm border-gray-100 border-l-4 border-l-green-500">
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-green-50 rounded-full">
                            <Package className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                            <CardTitle className="text-lg font-bold text-gray-900">Estoque Saudável</CardTitle>
                            <CardDescription>Nenhum item abaixo do estoque mínimo.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
            </Card>
        );
    }

    return (
        <Card className="bg-white shadow-sm border-gray-100 border-l-4 border-l-amber-500">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-amber-50 rounded-full">
                            <AlertTriangle className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                            <CardTitle className="text-lg font-bold text-gray-900">
                                Reposição Necessária
                                <Badge variant="secondary" className="ml-2 bg-amber-100 text-amber-700 hover:bg-amber-100">
                                    {items.length} itens
                                </Badge>
                            </CardTitle>
                            <CardDescription>Itens com saldo abaixo do mínimo definido.</CardDescription>
                        </div>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="space-y-1">
                    {/* Header Row */}
                    <div className="grid grid-cols-12 gap-4 px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        <div className="col-span-5">Item</div>
                        <div className="col-span-2 text-right">Saldo</div>
                        <div className="col-span-2 text-right">Mínimo</div>
                        <div className="col-span-3 text-right">Ação</div>
                    </div>

                    {/* List Items (Max 5 shown?) - User said "lista curta e acionável" */}
                    {items.slice(0, 5).map((item) => (
                        <div
                            key={item.id}
                            className="grid grid-cols-12 gap-4 items-center px-3 py-3 hover:bg-gray-50 rounded-lg transition-colors border border-transparent hover:border-gray-100 group"
                        >
                            <div className="col-span-5">
                                <div className="font-semibold text-gray-900 text-sm truncate" title={item.name}>
                                    {item.name}
                                </div>
                                <div className="text-xs text-gray-400 font-mono">
                                    {item.sku || 'S/ SKU'} • {item.type === 'raw_material' ? 'Matéria-prima' : item.type === 'packaging' ? 'Embalagem' : 'Outro'}
                                </div>
                            </div>
                            <div className="col-span-2 text-right">
                                <span className="font-bold text-red-600 text-sm">
                                    {item.current_stock.toLocaleString('pt-BR')}
                                </span>
                                <span className="text-xs text-gray-400 ml-1">{item.uom}</span>
                            </div>
                            <div className="col-span-2 text-right text-gray-600 text-sm">
                                {item.min_stock.toLocaleString('pt-BR')}
                            </div>
                            <div className="col-span-3 text-right">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs border-brand-200 text-brand-700 hover:bg-brand-50 hover:text-brand-800"
                                    onClick={() => handleCreateOrder(item)}
                                >
                                    <ShoppingCart className="w-3 h-3 mr-1.5" />
                                    Comprar
                                </Button>
                            </div>
                        </div>
                    ))}

                    {items.length > 5 && (
                        <div className="pt-2 text-center">
                            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground w-full h-8">
                                Ver mais {items.length - 5} itens...
                            </Button>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
