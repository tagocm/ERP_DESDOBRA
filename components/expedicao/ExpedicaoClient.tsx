'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Calendar, PackageCheck, Play, Printer } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select-shadcn';
import { PageHeader } from '@/components/ui/PageHeader';
import { ConfirmDialogDesdobra } from '@/components/ui/ConfirmDialogDesdobra';
import { RouteDetails } from './RouteDetails';
import { useToast } from "@/components/ui/use-toast";
import { useRouter } from 'next/navigation';

interface ExpedicaoClientProps {
    initialRoutes: any[];
}

export function ExpedicaoClient({ initialRoutes }: ExpedicaoClientProps) {
    const router = useRouter();
    const { toast } = useToast();
    const [routes, setRoutes] = useState(initialRoutes);
    const [selectedRoute, setSelectedRoute] = useState<any>(null);
    const [quickFilter, setQuickFilter] = useState('today');
    // const [showInRoute, setShowInRoute] = useState(false); // Removed functionality
    const [starting, setStarting] = useState(false);

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

    const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
    const [dialogConfig, setDialogConfig] = useState({ loadedCount: 0, totalCount: 0, hasPendingItems: false });

    const handleStartRoute = () => {
        if (!selectedRoute) {
            toast({ title: "Erro", description: 'Selecione uma rota primeiro', variant: "destructive" });
            return;
        }

        const loadedCount = selectedRoute.orders?.filter((o: any) => o.sales_order?.loading_checked).length || 0;
        const totalCount = selectedRoute.orders?.length || 0;
        const hasPendingItems = loadedCount < totalCount;

        setDialogConfig({ loadedCount, totalCount, hasPendingItems });
        setConfirmDialogOpen(true);
    };

    const confirmStartRoute = async () => {
        if (!selectedRoute) return;

        setStarting(true);
        try {
            const response = await fetch('/api/expedition/start-route', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ routeId: selectedRoute.id })
            });

            if (!response.ok) throw new Error('Erro ao iniciar rota');

            toast({ title: "Sucesso", description: 'Rota iniciada com sucesso!' });
            setConfirmDialogOpen(false);
            router.refresh();
        } catch (err) {
            console.error(err);
            toast({ title: "Erro", description: 'Erro ao iniciar rota', variant: "destructive" });
        } finally {
            setStarting(false);
        }
    };

    const hasInRouteOrders = selectedRoute?.orders?.some((o: any) => o.sales_order?.status_logistic === 'em_rota');

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
            return start === target;
        }
        return true;
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
                        >
                            <Play className="w-4 h-4 mr-2" />
                            {starting ? 'Iniciando...' : 'Iniciar Rota'}
                        </Button>
                    </div>
                }
            />

            <div className="px-6 pb-6 space-y-6">


                {/* Confirm Dialog */}
                <ConfirmDialogDesdobra
                    open={confirmDialogOpen}
                    onOpenChange={setConfirmDialogOpen}
                    title="Iniciar rota"
                    description={
                        <div className="space-y-3">
                            {dialogConfig.hasPendingItems && (
                                <div className="p-3 bg-amber-50 border-l-4 border-amber-500 rounded-r text-amber-800 text-sm">
                                    <p className="font-semibold">⚠️ Pendências de carregamento</p>
                                    <p>Apenas {dialogConfig.loadedCount} de {dialogConfig.totalCount} pedidos foram conferidos.</p>
                                </div>
                            )}
                            <p>
                                Deseja iniciar a rota <span className="font-semibold text-gray-900">"{selectedRoute?.name}"</span>?
                            </p>
                            <p className="text-sm text-gray-500">
                                Ao iniciar, a rota e todos os pedidos vinculados serão marcados como <span className="font-medium text-gray-700">Em rota</span>.
                                <br />
                                Você pode desfazer movendo pedidos de volta ao Sandbox.
                            </p>
                        </div>
                    }
                    confirmText="Iniciar rota"
                    cancelText="Cancelar"
                    onConfirm={confirmStartRoute}
                    variant="success"
                    isLoading={starting}
                />

                {/* Content */}
                <div className="grid grid-cols-12 gap-6">
                    {/* Routes List */}
                    <div className="col-span-4">
                        <div className="bg-white border border-gray-200 rounded-lg">
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
                            <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
                                {filteredRoutes.length > 0 ? (
                                    filteredRoutes.map((route: any) => {
                                        const isSelected = selectedRoute?.id === route.id;
                                        const totalOrders = route.orders?.length || 0;
                                        const loadedOrders = route.orders?.filter((o: any) => o.sales_order?.loading_checked).length || 0;
                                        const isComplete = loadedOrders === totalOrders && totalOrders > 0;

                                        return (
                                            <button
                                                key={route.id}
                                                onClick={() => setSelectedRoute(route)}
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
                                                            <span className={isComplete ? 'text-green-600 font-medium' : 'text-gray-600'}>
                                                                {loadedOrders}/{totalOrders}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    {isComplete && (
                                                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-500 text-white">
                                                            <PackageCheck className="w-4 h-4" />
                                                        </span>
                                                    )}
                                                </div>
                                            </button>
                                        );
                                    })
                                ) : (
                                    <div className="h-[104px] flex flex-col items-center justify-center text-gray-500">
                                        <Calendar className="w-8 h-8 mb-2 opacity-20" />
                                        <p className="text-sm">Nenhuma rota agendada</p>
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
                            onStartRoute={handleStartRoute}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
