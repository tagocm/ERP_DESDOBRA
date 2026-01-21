
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/Dialog";
import { Badge } from "@/components/ui/Badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, MapPin } from "lucide-react";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface DeliveryDetailDrawerProps {
    deliveryId: string | null;
    open: boolean;
    onClose: () => void;
}

interface DeliveryDetail {
    id: string;
    number: number;
    status: string;
    created_at: string;
    items: {
        id: string;
        qty_planned: number;
        qty_loaded: number;
        qty_delivered: number;
        qty_returned: number;
        sales_item: {
            unit_price: number;
            product: {
                name: string;
                sku: string;
                uom: string;
            }
        }
    }[];
    route?: {
        name: string;
        route_date: string;
    };
    notes?: string;
}

const statusMap: Record<string, { label: string, className: string }> = {
    draft: { label: 'Rascunho', className: 'bg-gray-100 text-gray-700' },
    in_preparation: { label: 'Em Preparação', className: 'bg-yellow-100 text-yellow-800' },
    in_route: { label: 'Em Rota', className: 'bg-blue-100 text-blue-800' },
    delivered: { label: 'Entregue', className: 'bg-green-100 text-green-800' },
    returned: { label: 'Devolvido', className: 'bg-red-100 text-red-800' },
    cancelled: { label: 'Cancelado', className: 'bg-red-50 text-red-600' }
};

export function DeliveryDetailDrawer({ deliveryId, open, onClose }: DeliveryDetailDrawerProps) {
    const [data, setData] = useState<DeliveryDetail | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (open && deliveryId) {
            console.log('[DeliveryDetailDrawer] Opening with deliveryId:', deliveryId);
            setLoading(true);
            fetch(`/api/deliveries/${deliveryId}`)
                .then(res => {
                    console.log('[DeliveryDetailDrawer] Response status:', res.status);
                    return res.json();
                })
                .then(data => {
                    console.log('[DeliveryDetailDrawer] Received data:', data);
                    setData(data);
                    setLoading(false);
                })
                .catch(err => {
                    console.error('[DeliveryDetailDrawer] Error:', err);
                    setLoading(false);
                });
        } else if (!open) {
            setData(null);
        }
    }, [open, deliveryId]);

    const status = data ? statusMap[data.status] || { label: data.status, className: 'bg-gray-100' } : null;
    const title = data ? `Entrega #${data.number}` : "Detalhes da Entrega";

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <div className="flex items-center justify-between">
                        <DialogTitle>{title}</DialogTitle>
                        {status && (
                            <Badge variant="outline" className={cn("border-0", status.className)}>
                                {status.label}
                            </Badge>
                        )}
                    </div>
                    {data && (
                        <div className="text-sm text-gray-500 flex items-center gap-1.5 pt-1">
                            {data.route ? (
                                <>
                                    <MapPin className="w-3.5 h-3.5" />
                                    {data.route.name}
                                    {data.route.route_date && ` • ${format(new Date(data.route.route_date), 'dd/MM/yyyy')}`}
                                </>
                            ) : "Sem rota definida"}
                        </div>
                    )}
                </DialogHeader>

                {loading ? (
                    <div className="flex justify-center py-10">
                        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                    </div>
                ) : data ? (
                    <div className="space-y-6">
                        <div className="border border-gray-100 rounded-lg overflow-hidden">
                            <Table>
                                <TableHeader className="bg-gray-50/50">
                                    <TableRow>
                                        <TableHead>Produto</TableHead>
                                        <TableHead className="text-right">Carregado</TableHead>
                                        <TableHead className="text-right">Entregue</TableHead>
                                        <TableHead className="text-right">Vlr. Unit.</TableHead>
                                        <TableHead className="text-right">Total</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {data.items?.map(item => {
                                        const unitPrice = item.sales_item?.unit_price || 0;
                                        const itemTotal = (item.qty_delivered || 0) * unitPrice;

                                        return (
                                            <TableRow key={item.id}>
                                                <TableCell>
                                                    <div className="font-medium text-sm text-gray-900">
                                                        {item.sales_item?.product?.name || 'Item Desconhecido'}
                                                    </div>
                                                    <div className="text-xs text-gray-500">
                                                        {item.sales_item?.product?.sku} • {item.sales_item?.product?.uom || 'UN'}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right text-blue-600 font-medium">{item.qty_loaded}</TableCell>
                                                <TableCell className="text-right text-green-600 font-semibold">{item.qty_delivered}</TableCell>
                                                <TableCell className="text-right text-gray-600">
                                                    R$ {unitPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </TableCell>
                                                <TableCell className="text-right font-semibold text-gray-900">
                                                    R$ {itemTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                    {(!data.items || data.items.length === 0) && (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center text-gray-400 py-4">
                                                Nenhum item.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>

                        {/* Total Summary */}
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-medium text-gray-700">Total da Entrega</span>
                                <span className="text-lg font-bold text-gray-900">
                                    R$ {(data.items?.reduce((acc, item) => {
                                        const unitPrice = item.sales_item?.unit_price || 0;
                                        const qty = item.qty_delivered || 0;
                                        return acc + (qty * unitPrice);
                                    }, 0) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                            </div>
                        </div>

                        {data.notes && (
                            <div className="bg-gray-50 p-4 rounded-lg border border-gray-100 text-sm">
                                <h4 className="font-semibold text-gray-700 mb-1">Observações</h4>
                                <p className="text-gray-600 leading-relaxed">{data.notes}</p>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="py-10 text-center text-gray-500">Não foi possível carregar os detalhes.</div>
                )}
            </DialogContent>
        </Dialog>
    );
}
