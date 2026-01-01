'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Calendar, PackageCheck, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select-shadcn';
import { PageHeader } from '@/components/ui/PageHeader';
import { RouteDetails } from '@/components/retorno/RouteDetails';
import { useToast } from "@/components/ui/use-toast";
import { useRouter } from 'next/navigation';
import { ConfirmDialogDesdobra } from '@/components/ui/ConfirmDialogDesdobra';
import { ReturnStaging } from '@/components/retorno/ReturnChecklist';
import { updateReturnStaging } from '@/lib/data/expedition';
import { createClient } from '@/utils/supabase/client';

interface RetornoClientProps {
    initialRoutes: any[];
}

export function RetornoClient({ initialRoutes }: RetornoClientProps) {
    const router = useRouter();
    const { toast } = useToast();
    const [routes, setRoutes] = useState(initialRoutes);
    const [selectedRoute, setSelectedRoute] = useState<any>(null);
    const [quickFilter, setQuickFilter] = useState('today');
    const [finishing, setFinishing] = useState(false);
    const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);

    // Staging state: stores return outcomes for each order
    const [staging, setStaging] = useState<Record<string, ReturnStaging>>({});

    // Sync state with props when router refreshes
    useEffect(() => {
        setRoutes(initialRoutes);
        if (selectedRoute) {
            const updated = initialRoutes.find(r => r.id === selectedRoute.id);
            if (updated) {
                setSelectedRoute(updated);
            }
        }
    }, [initialRoutes]);

    // Reset staging when route changes
    useEffect(() => {
        setStaging({});
    }, [selectedRoute?.id]);

    // Supabase client for staging updates
    const supabase = createClient();

    // Map DB enum to UI enum
    const mapDbToUi = (dbValue: string): 'ENTREGUE' | 'NAO_ENTREGUE' | 'DEVOLVIDO_PARCIAL' | undefined => {
        if (dbValue === 'delivered') return 'ENTREGUE';
        if (dbValue === 'partial') return 'DEVOLVIDO_PARCIAL';
        if (dbValue === 'not_delivered') return 'NAO_ENTREGUE';
        return undefined;
    };

    // Initialize staging from route data whenever selectedRoute changes
    useEffect(() => {
        if (selectedRoute) {
            const initialStaging: Record<string, ReturnStaging> = {};
            selectedRoute.orders?.forEach((ro: any) => {
                const outcomeType = mapDbToUi(ro.return_outcome_type);
                if (outcomeType && ro.sales_order) {
                    initialStaging[ro.sales_order.id] = {
                        orderId: ro.sales_order.id,
                        outcomeType,
                        reason: ro.return_payload?.reason,
                        payload: ro.return_payload
                    };
                }
            });
            setStaging(initialStaging);
        } else {
            setStaging({});
        }
    }, [selectedRoute]);

    const handleUpdateStaging = async (orderId: string, data: ReturnStaging) => {
        // 1. Optimistic Update Local Staging
        setStaging(prev => ({
            ...prev,
            [orderId]: data
        }));

        // 2. Persist to DB
        const routeOrder = selectedRoute?.orders?.find((ro: any) => ro.sales_order?.id === orderId);
        if (routeOrder) {
            let dbOutcome = '';
            if (data.outcomeType === 'ENTREGUE') dbOutcome = 'delivered';
            if (data.outcomeType === 'DEVOLVIDO_PARCIAL') dbOutcome = 'partial';
            if (data.outcomeType === 'NAO_ENTREGUE') dbOutcome = 'not_delivered';

            // Ensure payload has reason if it's top level in data
            const finalPayload = {
                ...data.payload,
                reason: data.reason || data.payload?.reason
            };

            try {
                // Update DB via lib
                await updateReturnStaging(supabase, routeOrder.id, dbOutcome, finalPayload);

                // Update Local Route State to reflect persistence (so switching tabs works)
                setRoutes(prev => prev.map(r => {
                    if (r.id === selectedRoute.id) {
                        const newOrders = r.orders.map((o: any) =>
                            o.id === routeOrder.id
                                ? { ...o, return_outcome_type: dbOutcome, return_payload: finalPayload }
                                : o
                        );
                        // Update selected route reference too
                        if (selectedRoute.id === r.id) {
                            setSelectedRoute({ ...r, orders: newOrders });
                        }
                        return { ...r, orders: newOrders };
                    }
                    return r;
                }));

            } catch (e) {
                console.error("Failed to persist staging", e);
                toast({ title: "Erro ao salvar", description: "Não foi possível salvar a alteração.", variant: "destructive" });
            }
        }
    };

    const validateReturnCompletion = () => {
        if (!selectedRoute) return { valid: false, message: 'Selecione uma rota primeiro' };

        const orders = selectedRoute.orders || [];
        if (orders.length === 0) return { valid: false, message: 'Nenhum pedido nesta rota' };

        // Check if all orders have an outcome
        const pendingOrders = orders.filter((ro: any) => {
            const order = ro.sales_order;
            if (!order) return false;
            return !staging[order.id];
        });

        if (pendingOrders.length > 0) {
            return {
                valid: false,
                message: `${pendingOrders.length} ${pendingOrders.length === 1 ? 'pedido não possui' : 'pedidos não possuem'} resultado definido. Marque todos os pedidos antes de finalizar.`
            };
        }

        // Check if all non-delivered/returned orders have a reason
        const missingReason = orders.filter((ro: any) => {
            const order = ro.sales_order;
            if (!order) return false;
            const stg = staging[order.id];
            if (!stg) return false;
            return (stg.outcomeType !== 'ENTREGUE' && !stg.reason);
        });

        if (missingReason.length > 0) {
            return {
                valid: false,
                message: 'Todos os pedidos não entregues ou devolvidos devem ter um motivo informado.'
            };
        }

        return { valid: true };
    };

    const handleFinishRoute = () => {
        const validation = validateReturnCompletion();
        if (!validation.valid) {
            toast({
                title: "Atenção",
                description: validation.message,
                variant: "destructive"
            });
            return;
        }

        setConfirmDialogOpen(true);
    };

    const confirmFinishRoute = async () => {
        setFinishing(true);
        try {
            if (!selectedRoute) return;

            // No need to send outcomes payload since DB has it, but consistent API usage is fine.
            // Our API Refactor reads from DB. So we just send routeId.

            const response = await fetch('/api/expedition/finish-return', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    routeId: selectedRoute.id
                }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Erro ao finalizar rota');
            }

            toast({
                title: "Sucesso",
                description: "Retorno finalizado. Rota movida para o histórico.",
                variant: 'default'
            });

            // Update local state immediately
            setRoutes(prev => prev.filter(r => r.id !== selectedRoute.id));
            setSelectedRoute(null);
            setConfirmDialogOpen(false);
            setStaging({});

            // Refresh server data
            router.refresh();

        } catch (error: any) {
            console.error(error);
            toast({
                title: "Erro",
                description: error.message || "Erro ao finalizar retorno",
                variant: "destructive"
            });
        } finally {
            setFinishing(false);
        }
    };

    // Calculate summary for confirmation dialog
    const getSummary = () => {
        if (!selectedRoute) return { entregues: 0, naoEntregues: 0, parciais: 0 };

        const summary = { entregues: 0, naoEntregues: 0, parciais: 0 };

        selectedRoute.orders?.forEach((ro: any) => {
            const order = ro.sales_order;
            if (!order) return;
            const stg = staging[order.id];
            if (!stg) return;

            switch (stg.outcomeType) {
                case 'ENTREGUE':
                    summary.entregues++;
                    break;
                case 'NAO_ENTREGUE':
                    summary.naoEntregues++;
                    break;
                case 'DEVOLVIDO_PARCIAL':
                    summary.parciais++;
                    break;
            }
        });

        return summary;
    };

    // Filter logic
    const filteredRoutes = routes.filter(route => {
        const routeDate = new Date(route.scheduled_date + 'T12:00:00'); // Normalize time
        const today = new Date();

        if (quickFilter === 'today') {
            return format(routeDate, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd');
        }
        if (quickFilter === 'week') {
            const weekFromNow = new Date(today);
            weekFromNow.setDate(weekFromNow.getDate() + 7);
            return routeDate >= today && routeDate <= weekFromNow;
        }
        return true;
    });

    const summary = getSummary();
    const validation = validateReturnCompletion();

    return (
        <div className="flex flex-col">
            <PageHeader
                title="Retorno"
                description="Conferência de entregas e processamento de ocorrências"
                actions={
                    <div className="flex gap-2">
                        <Button
                            onClick={handleFinishRoute}
                            disabled={!selectedRoute || finishing}
                            variant="primary"
                        >
                            <CheckCircle2 className="w-4 h-4 mr-2" />
                            {finishing ? 'Finalizando...' : 'Finalizar Retorno'}
                        </Button>
                    </div>
                }
            />

            <div className="px-6 pb-6 space-y-6">
                <div className="grid grid-cols-12 gap-6">
                    {/* Routes List */}
                    <div className="col-span-4">
                        <div className="bg-white border border-gray-200 rounded-lg">
                            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                                <div>
                                    <h3 className="font-semibold text-gray-900">Rotas em Rota</h3>
                                    <p className="text-sm text-gray-600 mt-1">
                                        {filteredRoutes.length} {filteredRoutes.length === 1 ? 'rota' : 'rotas'}
                                    </p>
                                </div>
                                <Select value={quickFilter} onValueChange={setQuickFilter}>
                                    <SelectTrigger className="w-32 h-8 text-xs">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="today">Hoje</SelectItem>
                                        <SelectItem value="week">Esta semana</SelectItem>
                                        <SelectItem value="all">Todas</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
                                {filteredRoutes.length > 0 ? (
                                    filteredRoutes.map((route: any) => {
                                        const isSelected = selectedRoute?.id === route.id;
                                        const totalOrders = route.orders?.length || 0;

                                        return (
                                            <button
                                                key={route.id}
                                                onClick={() => {
                                                    // Close any open flyouts
                                                    window.dispatchEvent(new CustomEvent('closeFlyouts'));
                                                    setSelectedRoute(route);
                                                }}
                                                className={`w-full text-left p-4 hover:bg-gray-50 transition-colors ${isSelected ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                                                    }`}
                                            >
                                                <div className="flex items-start justify-between">
                                                    <div className="flex-1">
                                                        <h4 className="font-semibold text-gray-900">{route.name}</h4>
                                                        <div className="flex items-center gap-2 mt-1 text-sm text-gray-600">
                                                            <Calendar className="w-3 h-3" />
                                                            {format(new Date(route.scheduled_date), 'dd/MM/yyyy')}
                                                        </div>
                                                        <div className="flex items-center gap-2 mt-1 text-sm">
                                                            <PackageCheck className="w-3 h-3" />
                                                            <span className="text-gray-600">
                                                                {totalOrders} {totalOrders === 1 ? 'pedido' : 'pedidos'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </button>
                                        );
                                    })
                                ) : (
                                    <div className="h-[104px] flex flex-col items-center justify-center text-gray-500">
                                        <Calendar className="w-8 h-8 mb-2 opacity-20" />
                                        <p className="text-sm">Nenhuma rota em andamento</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Route Details */}
                    <div className="col-span-8">
                        <RouteDetails
                            route={selectedRoute}
                            onClose={() => setSelectedRoute(null)}
                            onFinishRoute={handleFinishRoute}
                            staging={staging}
                            onUpdateStaging={handleUpdateStaging}
                        />
                    </div>
                </div>
            </div>

            {/* Confirmation Dialog */}
            <ConfirmDialogDesdobra
                open={confirmDialogOpen}
                onOpenChange={setConfirmDialogOpen}
                title="Finalizar Retorno"
                description={
                    <div className="space-y-3">
                        <p>Você deseja finalizar o retorno da rota <strong>{selectedRoute?.name}</strong>?</p>
                        <div className="bg-gray-50 rounded-lg p-3 space-y-2 text-sm">
                            <p><strong>Resumo das ações:</strong></p>
                            <ul className="space-y-1 ml-4 list-disc">
                                {summary.entregues > 0 && (
                                    <li className="text-green-700">
                                        <strong>{summary.entregues}</strong> {summary.entregues === 1 ? 'pedido será marcado' : 'pedidos serão marcados'} como ENTREGUE
                                    </li>
                                )}
                                {summary.naoEntregues > 0 && (
                                    <li className="text-red-700">
                                        <strong>{summary.naoEntregues}</strong> {summary.naoEntregues === 1 ? 'pedido voltará' : 'pedidos voltarão'} para SANDBOX (não entregue)
                                    </li>
                                )}
                                {summary.parciais > 0 && (
                                    <li className="text-amber-700">
                                        <strong>{summary.parciais}</strong> {summary.parciais === 1 ? 'pedido gerará um complementar' : 'pedidos gerarão complementares'} (devolução parcial)
                                    </li>
                                )}
                            </ul>
                        </div>
                        <p className="text-xs text-gray-500">Esta ação não pode ser desfeita.</p>
                    </div>
                }
                confirmText="Confirmar e Finalizar"
                cancelText="Cancelar"
                onConfirm={confirmFinishRoute}
                variant="success"
                isLoading={finishing}
            />
        </div>
    );
}
