
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Truck, RefreshCw, Eye, Package, ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useState } from "react";
import { DeliveryDetailDrawer } from "./DeliveryDetailDrawer";
import { cn } from "@/lib/utils";

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface DeliveriesListProps {
    salesDocumentId?: string;
    useDeliveriesModel: boolean;
}

export function DeliveriesList({ salesDocumentId, useDeliveriesModel }: DeliveriesListProps) {
    const [deliveries, setDeliveries] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [isExpanded, setIsExpanded] = useState(false);

    const fetchDeliveries = async () => {
        // Only fetch if we have a valid UUID (not empty, not 'novo', etc)
        if (!salesDocumentId || salesDocumentId === 'novo' || salesDocumentId.length < 10) {
            setDeliveries([]);
            return;
        }

        setLoading(true);
        try {
            const res = await fetch(`/api/sales-documents/${salesDocumentId}/deliveries`);
            if (!res.ok) {
                // Silently handle errors - likely just means no deliveries yet
                setDeliveries([]);
                return;
            }
            const data = await res.json();
            if (Array.isArray(data)) {
                setDeliveries(data);
                // Auto-expand if there are deliveries
                if (data.length > 0) {
                    setIsExpanded(true);
                }
            }
        } catch (error) {
            // Silently handle - likely just no deliveries table or empty results
            setDeliveries([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDeliveries();
    }, [salesDocumentId]);

    const statusMap: Record<string, { label: string, className: string }> = {
        draft: { label: 'Rascunho', className: 'bg-gray-100 text-gray-700' },
        in_preparation: { label: 'Em Prep.', className: 'bg-yellow-100 text-yellow-800' },
        in_route: { label: 'Em Rota', className: 'bg-blue-100 text-blue-800' },
        delivered: { label: 'Entregue', className: 'bg-green-100 text-green-800' },
        returned: { label: 'Devolvido', className: 'bg-red-100 text-red-800' },
        returned_partial: { label: 'Parcial', className: 'bg-orange-100 text-orange-800' },
        returned_total: { label: 'Devolvido Total', className: 'bg-red-100 text-red-800' },
        cancelled: { label: 'Cancelado', className: 'bg-red-50 text-red-600' }
    };

    if (!salesDocumentId) return null;

    return (
        <>
            <Card className="bg-white shadow-card border border-gray-100/70 mb-6">
                <CardHeader
                    className="bg-gray-50/50 border-b border-gray-100 py-3 flex flex-row items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => setIsExpanded(!isExpanded)}
                >
                    <div className="flex items-center gap-3">
                        <CardTitle className="text-sm font-semibold uppercase tracking-wider text-gray-700 flex items-center gap-2">
                            <Truck className="w-4 h-4" /> Entregas
                        </CardTitle>
                        <Badge
                            variant="outline"
                            className={cn(
                                "text-[10px] font-bold border-0",
                                useDeliveriesModel ? "bg-emerald-100 text-emerald-800" : "bg-purple-100 text-purple-800"
                            )}
                        >
                            {useDeliveriesModel ? "Modo: DELIVERIES" : "Modo: LEGADO"}
                        </Badge>
                        {deliveries.length > 0 && (
                            <Badge variant="secondary" className="bg-blue-100 text-blue-800 text-[10px] font-bold">
                                {deliveries.length}
                            </Badge>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 rounded-full px-3 text-xs font-medium text-gray-500 hover:text-brand-600 hover:bg-brand-50"
                            onClick={(e) => {
                                e.stopPropagation();
                                fetchDeliveries();
                            }}
                            disabled={loading}
                        >
                            <RefreshCw className={cn("w-3 h-3 mr-1.5", loading && "animate-spin")} />
                            Atualizar
                        </Button>
                        {isExpanded ? (
                            <ChevronUp className="w-5 h-5 text-gray-400" />
                        ) : (
                            <ChevronDown className="w-5 h-5 text-gray-400" />
                        )}
                    </div>
                </CardHeader>
                {isExpanded && (
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader className="bg-gray-50/30">
                                <TableRow className="border-b border-gray-100 hover:bg-transparent">
                                    <TableHead className="w-20 pl-6">Nº</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Rota</TableHead>
                                    <TableHead>Data</TableHead>
                                    <TableHead className="text-center">Itens</TableHead>
                                    <TableHead className="text-right">Carregado</TableHead>
                                    <TableHead className="text-right">Entregue</TableHead>
                                    <TableHead className="text-right">Valor Total</TableHead>
                                    <TableHead className="w-16"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {deliveries.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={9} className="text-center py-8 text-gray-400">
                                            <div className="flex flex-col items-center gap-2">
                                                <Package className="w-8 h-8 opacity-20" />
                                                <span>Nenhuma entrega registrada neste modelo.</span>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    deliveries.map(d => {
                                        const status = statusMap[d.status] || { label: d.status, className: 'bg-gray-100' };
                                        // Sum quantities from items
                                        const totalLoaded = d.items?.reduce((acc: any, i: any) => acc + (i.qty_loaded || 0), 0) || 0;
                                        const totalDelivered = d.items?.reduce((acc: any, i: any) => acc + (i.qty_delivered || 0), 0) || 0;
                                        // Calculate total delivered value (qty_delivered * unit_price)
                                        const totalValue = d.items?.reduce((acc: any, i: any) => {
                                            const qtyDelivered = i.qty_delivered || 0;
                                            const unitPrice = i.sales_item?.unit_price || 0;
                                            return acc + (qtyDelivered * unitPrice);
                                        }, 0) || 0;

                                        return (
                                            <TableRow key={d.id} className="hover:bg-gray-50/50 transition-colors border-b border-gray-50 last:border-0">
                                                <TableCell className="pl-6 font-medium text-gray-900">
                                                    #{d.number}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="secondary" className={cn("font-medium", status.className)}>
                                                        {status.label}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-sm text-gray-600">
                                                    {d.route?.name || '-'}
                                                </TableCell>
                                                <TableCell className="text-sm text-gray-600">
                                                    {d.route?.route_date
                                                        ? format(new Date(d.route.route_date), "dd/MM/yyyy", { locale: ptBR })
                                                        : '-'
                                                    }
                                                </TableCell>
                                                <TableCell className="text-center text-gray-600">
                                                    {d.items?.length || 0}
                                                </TableCell>
                                                <TableCell className="text-right text-gray-600 font-medium">
                                                    {totalLoaded}
                                                </TableCell>
                                                <TableCell className="text-right text-gray-600">
                                                    {totalDelivered}
                                                </TableCell>
                                                <TableCell className="text-right font-semibold text-gray-900">
                                                    R$ {totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </TableCell>
                                                <TableCell>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-gray-400 hover:text-brand-600"
                                                        onClick={() => {
                                                            console.log('[DeliveriesList] Clicking delivery:', d);
                                                            console.log('[DeliveriesList] Setting selectedId to:', d.id);
                                                            setSelectedId(d.id);
                                                        }}
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>

                        {/* Summary Footer */}
                        {deliveries.length > 0 && (
                            <div className="bg-gray-50 border-t border-gray-100 p-4 flex justify-end items-center gap-4">
                                <div className="flex flex-col items-end">
                                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Entregue</span>
                                    <span className="text-xl font-bold text-gray-900">
                                        R$ {(deliveries.reduce((acc, d) => {
                                            const deliveryTotal = d.items?.reduce((dAcc: any, i: any) => {
                                                const qtyDelivered = i.qty_delivered || 0;
                                                const unitPrice = i.sales_item?.unit_price || 0;
                                                return dAcc + (qtyDelivered * unitPrice);
                                            }, 0) || 0;
                                            return acc + deliveryTotal;
                                        }, 0) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                </div>
                            </div>
                        )}
                    </CardContent>
                )}
            </Card>

            <DeliveryDetailDrawer
                deliveryId={selectedId}
                open={!!selectedId}
                onClose={() => setSelectedId(null)}
            />
        </>
    );
}
