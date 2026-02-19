import { useState, useEffect } from 'react';
import { Check, MapPin, FileText, Printer, AlertTriangle, X, PackageMinus } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import { useRouter } from 'next/navigation';
import { updateOrderVolumesAction } from "@/app/actions/expedition/volume-actions";
import { updateRouteOrderStatusAction } from "@/app/actions/expedition/order-actions";
import { generateVolumeLabelZPL, downloadZpl } from "@/lib/zpl-generator";
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PartialLoadingModal } from '@/components/logistics/PartialLoadingModal';
import { useCompany } from '@/contexts/CompanyContext';
import { normalizeLoadingStatus } from '@/lib/constants/status';

interface LoadingChecklistProps {
    route: any;
    printer?: any;
    readOnly?: boolean;
}

export function LoadingChecklist({ route, printer, readOnly = false }: LoadingChecklistProps) {
    const { toast } = useToast();
    const router = useRouter();
    const { selectedCompany } = useCompany();

    const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});
    const [partialModalOpen, setPartialModalOpen] = useState(false);
    const [selectedOrderForPartial, setSelectedOrderForPartial] = useState<any>(null);

    const orders = route.orders || [];

    const handleVolumeChange = async (routeId: string, routeOrder: any, newVolume: number) => {
        if (readOnly) {
            toast({ title: "Rota iniciada", description: "Edição de carregamento bloqueada.", variant: "destructive" });
            return;
        }
        if (newVolume < 1) return;
        routeOrder.volumes = newVolume; // Optimistic
        try {
            await updateOrderVolumesAction(routeId, routeOrder.sales_document_id, newVolume);
            toast({ title: "Volumes atualizados" });
        } catch (e) {
            console.error(e);
            toast({ title: "Erro ao atualizar volumes", variant: "destructive" });
        }
    };

    const handlePrintOrder = async (route: any, ro: any) => {
        let zpl = '';
        const vols = ro.volumes || 1;
        const order = ro.sales_order!;
        for (let i = 1; i <= vols; i++) {
            zpl += generateVolumeLabelZPL(order, route, i, vols);
        }

        if (printer) {
            await printer.print(zpl);
        } else {
            downloadZpl(zpl, `etiquetas-pedido-${order.document_number}.zpl`);
        }
    };

    const updateStatus = async (orderId: string, status: string, payload: any = null) => {
        if (readOnly) {
            toast({ title: "Rota iniciada", description: "Edição de carregamento bloqueada.", variant: "destructive" });
            return;
        }
        const routeOrder = route.orders?.find((ro: any) => ro.sales_order?.id === orderId);
        if (!routeOrder) return;

        setLoadingStates(prev => ({ ...prev, [orderId]: true }));
        try {
            try {
                await updateRouteOrderStatusAction(routeOrder.id, status, payload);

                toast({ title: "Status atualizado", description: "Alteração salva no romaneio." });
                router.refresh();
            } catch (err: any) {
                console.error('Update Status Error:', err);
                toast({ title: "Erro", description: err.message || 'Erro ao atualizar status', variant: "destructive" });
            } finally {
                setLoadingStates(prev => ({ ...prev, [orderId]: false }));
            }
        } catch (err: any) {
            console.error('Update Status Error:', err);
            toast({ title: "Erro", description: err.message || 'Erro ao atualizar status', variant: "destructive" });
        } finally {
            setLoadingStates(prev => ({ ...prev, [orderId]: false }));
        }
    };

    const handleSetLoaded = (orderId: string, currentStatus: string) => {
        if (currentStatus === 'loaded') {
            updateStatus(orderId, 'pending', null);
        } else {
            updateStatus(orderId, 'loaded', null);
        }
    };

    const handleSetNotLoaded = (orderId: string, currentStatus: string) => {
        if (currentStatus === 'not_loaded') {
            updateStatus(orderId, 'pending', null);
        } else {
            updateStatus(orderId, 'not_loaded', { reason: 'Não Carregado', reasonId: 'MANUAL_NOT_LOADED' });
        }
    };

    const handleSetPartial = (orderId: string, currentStatus: string) => {
        if (readOnly) {
            toast({ title: "Rota iniciada", description: "Edição de carregamento bloqueada.", variant: "destructive" });
            return;
        }
        const routeOrder = route.orders?.find((ro: any) => ro.sales_order?.id === orderId);
        if (routeOrder?.sales_order) {
            handleOpenPartial(routeOrder.sales_order);
        }
    };

    const handleOpenPartial = (order: any) => {
        setSelectedOrderForPartial(order);
        setPartialModalOpen(true);
    };

    const handlePartialSuccess = (payload: any) => {
        if (selectedOrderForPartial) {
            updateStatus(selectedOrderForPartial.id, 'partial', payload);
        }
    };

    if (orders.length === 0) {
        return (
            <div className="p-12 text-center text-gray-500">
                <FileText className="w-12 h-12 mx-auto mb-4 opacity-20" />
                <p>Nenhum pedido nesta rota</p>
            </div>
        );
    }

    return (
        <>
            <div className="divide-y divide-gray-100">
                {orders.map((routeOrder: any) => {
                    const order = routeOrder.sales_order;
                    if (!order) return null;

                    let status = normalizeLoadingStatus(routeOrder.loading_status) || 'pending';
                    const occurrences = order.occurrences || [];

                    if (occurrences.some((o: any) => o?.event_type === 'NOT_LOADED_TOTAL' || o?.occurrence_type === 'NOT_LOADED_TOTAL')) {
                        status = 'not_loaded';
                    } else if (status === 'loaded') {
                        // Keep explicit status
                    }

                    if (!['pending', 'loaded', 'not_loaded', 'partial'].includes(status)) status = 'pending';

                    const isLoading = loadingStates[order.id];

                    return (
                        <div key={routeOrder.id} className={`p-4 transition-colors ${readOnly ? 'opacity-80' : 'hover:bg-gray-50'} ${status === 'not_loaded' ? 'bg-red-50/40' :
                            status === 'partial' ? 'bg-orange-50/40' : ''
                            }`}>
                            <div className="flex items-start gap-4">
                                <div className="flex flex-col gap-2 pt-1">
                                    {/* Green: Loaded */}
                                    <button
                                        onClick={() => handleSetLoaded(order.id, status)}
                                        disabled={isLoading || readOnly}
                                        title="Carregado (Completo)"
                                        className={`w-6 h-6 rounded flex items-center justify-center border transition-all duration-200 ${status === 'loaded'
                                            ? 'bg-green-500 border-green-500 shadow-card'
                                            : 'bg-white border-green-200 hover:border-green-400'
                                            }`}
                                    >
                                        {status === 'loaded' && <Check className="w-4 h-4 text-white" />}
                                    </button>

                                    {/* Yellow: Partial (New) */}
                                    <button
                                        onClick={() => handleSetPartial(order.id, status)}
                                        disabled={isLoading || readOnly}
                                        title="Carregamento Parcial"
                                        className={`w-6 h-6 rounded flex items-center justify-center border transition-all duration-200 ${status === 'partial'
                                            ? 'bg-amber-400 border-amber-400 shadow-card' // Using amber/yellow
                                            : 'bg-white border-amber-200 hover:border-amber-400'
                                            }`}
                                    >
                                        {status === 'partial' && <PackageMinus className="w-4 h-4 text-white" />}
                                    </button>

                                    {/* Red: Not Loaded */}
                                    <button
                                        onClick={() => handleSetNotLoaded(order.id, status)}
                                        disabled={isLoading || readOnly}
                                        title="Não Carregado"
                                        className={`w-6 h-6 rounded flex items-center justify-center border transition-all duration-200 ${status === 'not_loaded'
                                            ? 'bg-red-500 border-red-500 shadow-card'
                                            : 'bg-white border-red-200 hover:border-red-400'
                                            }`}
                                    >
                                        {status === 'not_loaded' && <X className="w-4 h-4 text-white" />}
                                    </button>
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className={`font-semibold transition-colors ${status === 'loaded' ? 'text-green-900' :
                                            status === 'not_loaded' ? 'text-red-800 line-through decoration-red-400' :
                                                status === 'partial' ? 'text-orange-900' :
                                                    'text-gray-900'
                                            }`}>
                                            {order.client?.trade_name || 'Cliente Desconhecido'}
                                        </span>
                                        <span className="text-xs text-gray-500">#{order.document_number}</span>
                                        <span className="text-gray-300">|</span>
                                        <span className="text-xs font-medium text-gray-600">
                                            {new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(order.total_weight_kg || 0)} kg
                                        </span>
                                    </div>

                                    {order.client?.addresses?.[0]?.city && (
                                        <div className="flex items-center gap-1 text-sm text-gray-600 mb-2">
                                            <MapPin className="w-3 h-3" />
                                            {order.client.addresses[0].city}
                                        </div>
                                    )}

                                    {status === 'not_loaded' && (
                                        <div className="flex items-center gap-1.5 mb-2 px-2 py-1 bg-red-100/50 rounded text-xs text-red-800 border border-red-100 w-fit">
                                            <X className="w-3 h-3" />
                                            <span>Não Carregado</span>
                                        </div>
                                    )}

                                    {status === 'partial' && (
                                        <div className="flex items-center gap-1.5 mb-2 px-2 py-1 bg-orange-100/50 rounded text-xs text-orange-800 border border-orange-100 w-fit">
                                            <PackageMinus className="w-3 h-3" />
                                            <span>Carregamento Parcial</span>
                                        </div>
                                    )}

                                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                                        <div className="flex items-center gap-1">
                                            <label className="text-[10px] text-gray-500 uppercase font-bold">Vol:</label>
                                            <Input
                                                type="number"
                                                min={1}
                                                defaultValue={routeOrder.volumes || 1}
                                                className="w-16 h-7 text-xs px-1 text-center"
                                                disabled={readOnly}
                                                onBlur={(e) => handleVolumeChange(route.id, routeOrder, parseInt(e.target.value))}
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 px-2 text-xs gap-1 text-gray-500"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handlePrintOrder(route, routeOrder);
                                            }}
                                            title="Imprimir etiquetas"
                                        >
                                            <Printer className="w-3 h-3" />
                                            Etiquetas
                                        </Button>
                                    </div>

                                    <div className="text-sm text-gray-600">
                                        {order.items && order.items.length > 0 ? (
                                            <ul className="space-y-1">
                                                {order.items.map((item: any) => (
                                                    <li key={item.id} className="flex justify-between">
                                                        <span>{item.product?.name || 'Produto'}</span>
                                                        <span className="font-medium">
                                                            {item.balance !== undefined ? item.balance : item.quantity} {item.packaging?.label || 'un'}
                                                        </span>
                                                    </li>
                                                ))}
                                            </ul>
                                        ) : (
                                            <span className="text-gray-400">Sem itens</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {selectedCompany && (
                <PartialLoadingModal
                    isOpen={partialModalOpen}
                    onClose={() => setPartialModalOpen(false)}
                    order={selectedOrderForPartial}
                    companyId={selectedCompany.id}
                    onSuccess={handlePartialSuccess}
                />
            )}
        </>
    );
}
