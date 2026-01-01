import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Check, MapPin, FileText, Printer, AlertTriangle, X } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import { useRouter } from 'next/navigation';
import { updateOrderVolumes } from "@/lib/data/expedition";
import { generateVolumeLabelZPL, downloadZpl } from "@/lib/zpl-generator";
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PartialLoadModal } from './PartialLoadModal';
import { NotLoadedModal } from './NotLoadedModal';

interface LoadingChecklistProps {
    route: any;
    printer?: any; // Ideally typed from useQZPrinter return type
}

export function LoadingChecklist({ route, printer }: LoadingChecklistProps) {
    const { toast } = useToast();
    const router = useRouter();

    // Local state for optimistic updates
    const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});

    // We rely on route prop for state, assuming parent refreshes or we force refresh.
    const orders = route.orders || [];

    const supabase = createClient();

    const handleVolumeChange = async (routeId: string, routeOrder: any, newVolume: number) => {
        if (newVolume < 1) return;
        routeOrder.volumes = newVolume; // Optimistic
        try {
            await updateOrderVolumes(supabase, routeId, routeOrder.sales_document_id, newVolume);
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

    // --- Status Management ---

    const updateStatus = async (orderId: string, status: string, payload: any = null) => {
        const routeOrder = route.orders?.find((ro: any) => ro.sales_order?.id === orderId);
        if (!routeOrder) return;

        setLoadingStates(prev => ({ ...prev, [orderId]: true }));
        try {
            const { data: { session } } = await supabase.auth.getSession();

            // 1. Update Route Order (Staging Status)
            const updateData: any = { loading_status: status };
            if (payload !== null) {
                updateData.partial_payload = payload;
            }

            const { error: routeOrderError } = await supabase
                .from('delivery_route_orders')
                .update(updateData)
                .eq('id', routeOrder.id);

            if (routeOrderError) throw routeOrderError;

            // 2. Legacy Support: If marking loaded, we might want to sync with sales_order.loading_checked
            // However, the requirement says "Nenhuma alteração no pedido... deve ocorrer antes do clique em Iniciar Rota".
            // So we DO NOT call loading-check API anymore. We rely solely on delivery_route_orders.

            // Note: Optimistic update is tricky without local state copy or router refresh.
            // We'll rely on router.refresh() for now.
            toast({
                title: "Status atualizado",
                description: "Alteração salva no romaneio."
            });

            router.refresh();
        } catch (err: any) {
            console.error('Update Status Error:', JSON.stringify(err, Object.getOwnPropertyNames(err)));
            toast({
                title: "Erro",
                description: err.message || 'Erro ao atualizar status',
                variant: "destructive"
            });
        } finally {
            setLoadingStates(prev => ({ ...prev, [orderId]: false }));
        }
    };

    const handleSetLoaded = (orderId: string, currentStatus: string) => {
        // Toggle off if already loaded
        if (currentStatus === 'loaded') {
            updateStatus(orderId, 'pending', null);
        } else {
            updateStatus(orderId, 'loaded', null);
        }
    };

    // --- Modals ---

    const [partialModalOpen, setPartialModalOpen] = useState(false);
    const [notLoadedModalOpen, setNotLoadedModalOpen] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<any>(null);

    const openPartialModal = (order: any) => {
        setSelectedOrder(order);
        setPartialModalOpen(true);
    };

    const openNotLoadedModal = (order: any) => {
        setSelectedOrder(order);
        setNotLoadedModalOpen(true);
    };

    const handleConfirmPartial = async (loadedItems: { itemId: string; loadedQty: number }[], reasonLabel: string, details: any) => {
        if (!selectedOrder) return;

        try {
            const { data: { session } } = await supabase.auth.getSession();
            const payload = {
                ...details,
                loadedItems,
                reason: reasonLabel,
                userId: session?.user?.id,
                timestamp: new Date().toISOString()
            };
            await updateStatus(selectedOrder.id, 'partial', payload);
        } catch (error) {
            console.error(error);
        }
    };

    const handleConfirmNotLoaded = async (reasonLabel: string, notes?: string, actionFlags?: any) => {
        if (!selectedOrder) return;

        try {
            const { data: { session } } = await supabase.auth.getSession();
            const payload = {
                reason: reasonLabel,
                text_other: notes,
                actions: actionFlags,
                userId: session?.user?.id,
                timestamp: new Date().toISOString()
            };
            await updateStatus(selectedOrder.id, 'not_loaded', payload);
        } catch (error) {
            console.error(error);
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

                    // Derive Status
                    // Priority: loading_status from DB. Fallback to order.loading_checked (legacy) -> 'loaded'.
                    let status = routeOrder.loading_status || (order.loading_checked ? 'loaded' : 'pending');
                    // Check logic for 'not_loaded' support
                    if (!['pending', 'loaded', 'partial', 'not_loaded'].includes(status)) status = 'pending';

                    const isLoading = loadingStates[order.id];

                    return (
                        <div key={order.id} className={`p-4 hover:bg-gray-50 transition-colors ${status === 'partial' ? 'bg-amber-50/40' :
                            status === 'not_loaded' ? 'bg-red-50/40' :
                                ''
                            }`}>
                            <div className="flex items-start gap-4">
                                {/* 3 Vertical Checkboxes */}
                                <div className="flex flex-col gap-2 pt-1">
                                    {/* Green: Loaded */}
                                    <button
                                        onClick={() => handleSetLoaded(order.id, status)}
                                        disabled={isLoading}
                                        title="Carregado (Completo)"
                                        className={`w-6 h-6 rounded flex items-center justify-center border transition-all duration-200 ${status === 'loaded'
                                            ? 'bg-green-500 border-green-500 shadow-sm'
                                            : 'bg-white border-green-200 hover:border-green-400'
                                            }`}
                                    >
                                        {status === 'loaded' && <Check className="w-4 h-4 text-white" />}
                                    </button>

                                    {/* Yellow: Partial */}
                                    <button
                                        onClick={() => status === 'partial' ? updateStatus(order.id, 'pending', null) : openPartialModal(order)}
                                        disabled={isLoading}
                                        title="Carregado (Parcial)"
                                        className={`w-6 h-6 rounded flex items-center justify-center border transition-all duration-200 ${status === 'partial'
                                            ? 'bg-amber-400 border-amber-400 shadow-sm'
                                            : 'bg-white border-amber-200 hover:border-amber-400'
                                            }`}
                                    >
                                        {status === 'partial' && <span className="text-white text-xs font-bold leading-none">P</span>}
                                    </button>

                                    {/* Red: Not Loaded */}
                                    <button
                                        onClick={() => status === 'not_loaded' ? updateStatus(order.id, 'pending', null) : openNotLoadedModal(order)}
                                        disabled={isLoading}
                                        title="Não Carregado"
                                        className={`w-6 h-6 rounded flex items-center justify-center border transition-all duration-200 ${status === 'not_loaded'
                                            ? 'bg-red-500 border-red-500 shadow-sm'
                                            : 'bg-white border-red-200 hover:border-red-400'
                                            }`}
                                    >
                                        {status === 'not_loaded' && <X className="w-4 h-4 text-white" />}
                                    </button>
                                </div>

                                {/* Order Info */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className={`font-semibold transition-colors ${status === 'loaded' ? 'text-green-900' :
                                            status === 'partial' ? 'text-amber-800' :
                                                status === 'not_loaded' ? 'text-red-800 line-through decoration-red-400' :
                                                    'text-gray-900'
                                            }`}>
                                            {order.client?.trade_name || 'Cliente Desconhecido'}
                                        </span>
                                        <span className="text-xs text-gray-500">
                                            #{order.document_number}
                                        </span>
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

                                    {/* Status Feedback Text */}
                                    {status === 'partial' && (
                                        <div className="flex items-center gap-1.5 mb-2 px-2 py-1 bg-amber-100/50 rounded text-xs text-amber-800 border border-amber-100 w-fit">
                                            <AlertTriangle className="w-3 h-3" />
                                            <span>Parcial (itens ajustados)</span>
                                        </div>
                                    )}

                                    {status === 'not_loaded' && routeOrder.partial_payload?.reason && (
                                        <div className="flex items-center gap-1.5 mb-2 px-2 py-1 bg-red-100/50 rounded text-xs text-red-800 border border-red-100 w-fit">
                                            <X className="w-3 h-3" />
                                            <span>Não Carregado: {routeOrder.partial_payload.reason}</span>
                                        </div>
                                    )}

                                    {/* Volumes & Print */}
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="flex items-center gap-1">
                                            <label className="text-[10px] text-gray-500 uppercase font-bold">Vol:</label>
                                            <Input
                                                type="number"
                                                min={1}
                                                defaultValue={routeOrder.volumes || 1}
                                                className="w-16 h-7 text-xs px-1 text-center"
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

                                    {/* Items */}
                                    <div className="text-sm text-gray-600">
                                        {order.items && order.items.length > 0 ? (
                                            <ul className="space-y-1">
                                                {order.items.map((item: any) => (
                                                    <li key={item.id} className="flex justify-between">
                                                        <span>{item.product?.name || 'Produto'}</span>
                                                        <span className="font-medium">{item.quantity} un</span>
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

            {selectedOrder && (
                <>
                    <PartialLoadModal
                        isOpen={partialModalOpen}
                        onClose={() => setPartialModalOpen(false)}
                        onConfirm={handleConfirmPartial}
                        order={selectedOrder}
                    />
                    <NotLoadedModal
                        isOpen={notLoadedModalOpen}
                        onClose={() => setNotLoadedModalOpen(false)}
                        onConfirm={handleConfirmNotLoaded}
                        order={selectedOrder}
                    />
                </>
            )}
        </>
    );
}
