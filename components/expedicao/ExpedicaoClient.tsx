'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Calendar, PackageCheck, Play, Printer, Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select-shadcn';
import { PageHeader } from '@/components/ui/PageHeader';
import { ConfirmDialogDesdobra } from '@/components/ui/ConfirmDialogDesdobra';
import { RouteDetails } from './RouteDetails';
import { useToast } from "@/components/ui/use-toast";
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabaseBrowser';
import { resetAndUnscheduleRouteAction } from '@/app/actions/expedition/route-actions';
import { normalizeLoadingStatus, normalizeLogisticsStatus, normalizeRouteStatus } from '@/lib/constants/status';

interface ExpedicaoClientProps {
    initialRoutes: any[];
}

export function ExpedicaoClient({ initialRoutes = [] }: ExpedicaoClientProps) {
    const router = useRouter();
    const { toast } = useToast();
    const [routes, setRoutes] = useState(initialRoutes || []);
    const [selectedRoute, setSelectedRoute] = useState<any>(null);
    const [quickFilter, setQuickFilter] = useState('today');
    // const [showInRoute, setShowInRoute] = useState(false); // Removed functionality
    const [starting, setStarting] = useState(false);

    // Sync state with props when router refreshes
    useEffect(() => {
        setRoutes(initialRoutes || []);
        if (selectedRoute) {
            const updated = (initialRoutes || []).find(r => r.id === selectedRoute.id);
            if (updated) {
                if ((normalizeRouteStatus(updated.status) || updated.status) === 'cancelled') {
                    setSelectedRoute(null);
                } else {
                    setSelectedRoute(updated);
                }
            } else {
                setSelectedRoute(null);
            }
        }
    }, [initialRoutes]);

    const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
    const [dialogConfig, setDialogConfig] = useState({ countFull: 0, countPartial: 0, countNotLoaded: 0, totalCount: 0 });

    const handleStartRoute = () => {
        if (!selectedRoute) {
            toast({ title: "Erro", description: 'Selecione uma rota primeiro', variant: "destructive" });
            return;
        }

        const countFull = selectedRoute.orders?.filter((o: any) => normalizeLoadingStatus(o.loading_status) === 'loaded').length || 0;
        const countPartial = selectedRoute.orders?.filter((o: any) => normalizeLoadingStatus(o.loading_status) === 'partial' || o.sales_order?.occurrences?.some((occ: any) => occ.occurrence_type === 'PARTIAL_LOADED')).length || 0;
        const countNotLoaded = selectedRoute.orders?.filter((o: any) => normalizeLoadingStatus(o.loading_status) === 'not_loaded' || o.sales_order?.occurrences?.some((occ: any) => occ.occurrence_type === 'NOT_LOADED_TOTAL')).length || 0;
        const totalCount = selectedRoute.orders?.length || 0;

        // Ensure we don't double count if statuses overlap with occurrences
        // Actually, pure occurrence count is safer if we assume occ overrides status.
        // But for "countProcessed" we just need to know if "decision made".

        const countProcessed = selectedRoute.orders?.filter((o: any) => {
            const hasStatus = ['loaded', 'partial', 'not_loaded'].includes(normalizeLoadingStatus(o.loading_status) || o.loading_status);
            const hasOccurrence = o.sales_order?.occurrences?.length > 0;
            return hasStatus || hasOccurrence;
        }).length || 0;

        const hasPendingItems = countProcessed < totalCount;

        if (hasPendingItems) {
            toast({
                title: "Pendências de carregamento",
                description: "Defina o status de carregamento de todos os pedidos (Completo/Parcial/Não carregado).",
                variant: "destructive"
            });
            return;
        }

        setDialogConfig({ countFull, countPartial, countNotLoaded, totalCount });
        setConfirmDialogOpen(true);
    };

    const confirmStartRoute = async () => {
        if (!selectedRoute) return;

        setStarting(true);
        try {
            if (allOrdersNotLoaded) {
                // const supabase = createClient(); // Not needed for action
                await resetAndUnscheduleRouteAction(selectedRoute.id);
                toast({ title: "Rota Cancelada", description: 'A rota voltou para "Rotas Não Agendadas" e está editável.' });
            } else {
                // 1. Process Occurrences (Deferral)
                const procResponse = await fetch(`/api/logistics/routes/${selectedRoute.id}/process-return`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });

                if (!procResponse.ok) {
                    const err = await procResponse.json();
                    throw new Error(err.error || "Falha ao processar ocorrências.");
                }

                // 2. Start Route (Logic for remaining orders)
                const response = await fetch('/api/expedition/start-route', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ routeId: selectedRoute.id })
                });

                if (!response.ok) {
                    const data = await response.json();
                    throw new Error(data.error || 'Erro ao iniciar rota');
                }

                toast({ title: "Sucesso", description: 'Rota iniciada com sucesso!' });
            }

            setConfirmDialogOpen(false);
            router.refresh();
        } catch (err: any) {
            console.error("Cancel Route Error:", err);
            toast({ title: "Erro", description: err?.message || JSON.stringify(err) || 'Erro ao processar rota', variant: "destructive" });
        } finally {
            setStarting(false);
        }
    };

    const hasInRouteOrders = selectedRoute?.orders?.some((o: any) => (normalizeLogisticsStatus(o.sales_order?.status_logistic) || o.sales_order?.status_logistic) === 'in_route');

    // Check if ALL orders are marked as Not Loaded
    const allOrdersNotLoaded = selectedRoute?.orders?.length > 0 &&
        selectedRoute.orders.every((o: any) => normalizeLoadingStatus(o.loading_status) === 'not_loaded');

    // Filter logic
    const filteredRoutes = routes.filter(route => {
        const routeDate = new Date(route.scheduled_date + 'T12:00:00'); // Normalize time
        const today = new Date();

        if (quickFilter === 'today') {
            return format(routeDate, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd');
        }
        if (quickFilter === 'tomorrow') {
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            return format(routeDate, 'yyyy-MM-dd') === format(tomorrow, 'yyyy-MM-dd');
        }
        if (quickFilter === 'this_week') {
            // Check if same week
            const start = format(new Date(), 'ww-yyyy');
            const target = format(routeDate, 'ww-yyyy');
            return start === target && (normalizeRouteStatus(route.status) || route.status) !== 'cancelled';
        }
        return (normalizeRouteStatus(route.status) || route.status) !== 'cancelled';
    });

    return (
        <div className="flex flex-col">
            <PageHeader
                title="Expedição"
                description="Separação e carregamento das rotas agendadas"
                actions={
                    <div className="flex gap-2">
                        <Button variant="secondary" disabled>
                            <Printer className="w-4 h-4 mr-2" />
                            Imprimir Romaneio
                        </Button>
                        <Button
                            onClick={handleStartRoute}
                            disabled={!selectedRoute || starting || hasInRouteOrders}
                            variant={allOrdersNotLoaded ? "danger" : "primary"}
                        >
                            <Play className="w-4 h-4 mr-2" />
                            {starting ? (allOrdersNotLoaded ? 'Cancelando...' : 'Iniciando...') : (allOrdersNotLoaded ? 'Cancelar Rota' : 'Iniciar Rota')}
                        </Button>
                    </div>
                }
            />

            <div className="px-6 pb-6 space-y-6">
                {/* Confirm Dialog */}
                <ConfirmDialogDesdobra
                    open={confirmDialogOpen}
                    onOpenChange={setConfirmDialogOpen}
                    title={allOrdersNotLoaded ? "Cancelar Rota" : "Iniciar rota"}
                    description={
                        allOrdersNotLoaded ? (
                            <div className="space-y-3">
                                <div className="p-3 bg-red-50 border-l-4 border-red-500 rounded-2xl text-red-800 text-sm">
                                    <p className="font-semibold">⚠️ Cancelamento de Rota</p>
                                    <p>Todos os {dialogConfig.totalCount} pedidos foram marcados como <strong>NÃO CARREGADO</strong>.</p>
                                </div>
                                <p>
                                    Deseja cancelar a rota <span className="font-semibold text-gray-900">"{selectedRoute?.name}"</span>?
                                </p>
                                <p className="text-sm text-gray-500">
                                    A rota ficará vermelha no calendário e todos os pedidos voltarão para a Sandbox como <strong>Pendentes</strong>.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {(dialogConfig.countPartial > 0 || dialogConfig.countNotLoaded > 0) ? (
                                    <div className="p-3 bg-amber-50 border-l-4 border-amber-500 rounded-2xl text-amber-800 text-sm">
                                        <p className="font-semibold">⚠️ Atenção para exceções</p>
                                        <ul className="list-disc ml-4 mt-1">
                                            {dialogConfig.countPartial > 0 && (
                                                <li>
                                                    <strong>{dialogConfig.countPartial} Parciais:</strong> Serão gerados pedidos complementares.
                                                </li>
                                            )}
                                            {dialogConfig.countNotLoaded > 0 && (
                                                <li>
                                                    <strong>{dialogConfig.countNotLoaded} Não Carregados:</strong> voltarão para a Sandbox como PENDENTE (com observação).
                                                </li>
                                            )}
                                        </ul>
                                    </div>
                                ) : (
                                    <div className="p-3 bg-green-50 border-l-4 border-green-500 rounded-2xl text-green-800 text-sm">
                                        <p className="font-semibold">✓ Tudo conferido</p>
                                        <p>Todos os {dialogConfig.totalCount} pedidos estão completos.</p>
                                    </div>
                                )}

                                <p>
                                    Deseja iniciar a rota <span className="font-semibold text-gray-900">"{selectedRoute?.name}"</span>?
                                </p>
                                <p className="text-sm text-gray-500">
                                    Ao iniciar, a rota e os pedidos carregados serão marcados como <span className="font-medium text-gray-700">Em rota</span>.
                                    <br />
                                    Pedidos não carregados voltarão para a Sandbox como Pendente.
                                </p>
                            </div>
                        )
                    }
                    confirmText={allOrdersNotLoaded ? "Confirmar Cancelamento" : "Iniciar rota"}
                    cancelText="Cancelar"
                    onConfirm={confirmStartRoute}
                    variant={allOrdersNotLoaded ? "danger" : "success"}
                    isLoading={starting}
                />

                {/* Content */}
                <div className="grid grid-cols-12 gap-6">
                    {/* Routes List */}
                    <div className="col-span-4">
                        <Card>
                            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                                <div>
                                    <h3 className="font-semibold text-gray-900">Rotas Agendadas</h3>
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
                                        <SelectItem value="tomorrow">Amanhã</SelectItem>
                                        <SelectItem value="this_week">Esta semana</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
                                {filteredRoutes.length > 0 ? (
                                    filteredRoutes.map((route: any) => {
                                        const isSelected = selectedRoute?.id === route.id;
                                        const orders = route.orders || [];
                                        const totalOrders = orders.length;

                                        // Calculate statuses for dots and completion
                                        const processedOrders = orders.map((o: any) => {
                                            let status = normalizeLoadingStatus(o.loading_status) || 'pending';
                                            if (!['pending', 'loaded', 'partial', 'not_loaded'].includes(status)) status = 'pending';
                                            return { ...o, effectiveStatus: status };
                                        });

                                        const countPending = processedOrders.filter((o: any) => o.effectiveStatus === 'pending').length;
                                        const isFullyChecked = countPending === 0 && totalOrders > 0;
                                        const processedCount = totalOrders - countPending;

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

                                                        {/* Status Dots */}
                                                        <div className="flex flex-wrap gap-1.5 mt-2">
                                                            {processedOrders.map((o: any, idx: number) => {
                                                                let dotColor = 'bg-gray-200 border-gray-300'; // pending
                                                                if (o.effectiveStatus === 'loaded') dotColor = 'bg-green-500 border-green-600';
                                                                else if (o.effectiveStatus === 'partial') dotColor = 'bg-amber-400 border-amber-500';
                                                                else if (o.effectiveStatus === 'not_loaded') dotColor = 'bg-red-500 border-red-600';

                                                                return (
                                                                    <div
                                                                        key={idx}
                                                                        className={`w-2.5 h-2.5 rounded-2xl border ${dotColor}`}
                                                                        title={`Pedido #${o.sales_order?.document_number}: ${o.effectiveStatus}`}
                                                                    />
                                                                );
                                                            })}
                                                        </div>

                                                        <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                                                            <PackageCheck className="w-3 h-3" />
                                                            <span>{processedCount}/{totalOrders}</span>
                                                        </div>
                                                    </div>

                                                    {/* Completion Check */}
                                                    {isFullyChecked && (
                                                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-2xl bg-green-100 text-green-700 ml-2">
                                                            <Check className="w-4 h-4" />
                                                        </span>
                                                    )}
                                                </div>
                                            </button>
                                        );
                                    })
                                ) : (
                                    <div className="h-24 flex flex-col items-center justify-center text-gray-500">
                                        <Calendar className="w-8 h-8 mb-2 opacity-20" />
                                        <p className="text-sm">Nenhuma rota agendada</p>
                                    </div>
                                )}
                            </div>
                        </Card>
                    </div>

                    {/* Route Details */}
                    <div className="col-span-8">
                        <RouteDetails
                            route={selectedRoute}
                            onClose={() => setSelectedRoute(null)}
                            onStartRoute={handleStartRoute}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
