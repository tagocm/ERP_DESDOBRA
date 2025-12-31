"use client";

import { useEffect, useState, useMemo, useCallback, memo } from "react";
import { createClient } from "@/utils/supabase/client";
import {
    getScheduledRoutes,
    getUnscheduledRoutes,
    getSandboxOrders,
    addOrderToRoute,
    removeOrderFromRoute,
    createRoute,
    updateRouteSchedule,
    deleteRoute,
    checkAndCleanupExpiredRoutes,
} from "@/lib/data/expedition";
import { DeliveryRoute, SalesOrder } from "@/types/sales";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/Dialog";
import { Plus, GripVertical, Package, Calendar, DollarSign, Check, Truck, X } from "lucide-react";
import { format, startOfWeek, endOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/components/ui/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DndContext, DragOverlay, useDraggable, useDroppable, useSensor, useSensors, PointerSensor, KeyboardSensor } from "@dnd-kit/core";
import { WeeklyCalendar } from "./WeeklyCalendar";
import { RouteCardCompact } from "./RouteCardCompact";
import { UnscheduledRouteCard } from "./UnscheduledRouteCard";
import { AddToRouteModal } from "./AddToRouteModal";
import { DayDetailsPopover } from "./DayDetailsPopover";
import { OrderItemsPopover } from "./OrderItemsPopover";
import { cn } from "@/lib/utils";
import { OrderCard } from "./OrderCard";

type DragItem = {
    id: string; // Order ID or Route ID
    type: 'order' | 'route';
    sourceRouteId?: string;
    order?: any;
    route?: DeliveryRoute;
};

interface ExpeditionKanbanProps {
    currentWeek?: Date;
    setCurrentWeek?: (date: Date) => void;
    companyId?: string;
}

export function ExpeditionKanban({ currentWeek: propCurrentWeek, setCurrentWeek: propSetCurrentWeek, companyId }: ExpeditionKanbanProps) {
    const { toast } = useToast();
    const [sandbox, setSandbox] = useState<any[]>([]);
    const [scheduledRoutes, setScheduledRoutes] = useState<DeliveryRoute[]>([]);
    const [unscheduledRoutes, setUnscheduledRoutes] = useState<DeliveryRoute[]>([]);
    const [loading, setLoading] = useState(true);

    // Internal state for when props are not provided
    const [currentWeekState, setCurrentWeekState] = useState(new Date());
    const currentWeek = propCurrentWeek || currentWeekState;
    const setCurrentWeek = propSetCurrentWeek || setCurrentWeekState;

    // Drag state
    const [activeItem, setActiveItem] = useState<DragItem | null>(null);

    // Selection state
    const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
    const [batchRouteOpen, setBatchRouteOpen] = useState(false);

    // Modal states
    const [newRouteOpen, setNewRouteOpen] = useState(false);
    const [newRouteName, setNewRouteName] = useState("");
    const [addToRouteModalOpen, setAddToRouteModalOpen] = useState(false);
    const [addToRouteDate, setAddToRouteDate] = useState<string | null>(null);
    const [addToRouteOrderId, setAddToRouteOrderId] = useState<string | null>(null);
    const [dayDetailsOpen, setDayDetailsOpen] = useState(false);
    const [selectedDayDate, setSelectedDayDate] = useState<Date | null>(null);
    const [selectedDayRoutes, setSelectedDayRoutes] = useState<DeliveryRoute[]>([]);

    // User context cache
    const [userContext, setUserContext] = useState<{ userId: string; companyId: string } | null>(null);

    const supabase = createClient();

    // DnD Sensors
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(KeyboardSensor)
    );

    // Initial Load: Get user context and data
    useEffect(() => {
        initUserContext();
    }, []);

    useEffect(() => {
        if (userContext) {
            fetchData();
        }
    }, [currentWeek, userContext]);

    const initUserContext = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: profile } = await supabase.from('company_members').select('company_id').eq('auth_user_id', user.id).single();
            if (profile?.company_id) {
                setUserContext({ userId: user.id, companyId: profile.company_id });
            }
        } catch (e) {
            console.error("User context error:", e);
        }
    };

    // Helper to get company ID safely
    const getCompanyId = useCallback(() => {
        return userContext?.companyId || companyId;
    }, [userContext, companyId]);

    const fetchData = useCallback(async () => {
        const cId = getCompanyId();
        if (!cId) return;

        setLoading(true);
        try {
            const weekStart = format(startOfWeek(currentWeek, { locale: ptBR }), 'yyyy-MM-dd');
            const weekEnd = format(endOfWeek(currentWeek, { locale: ptBR }), 'yyyy-MM-dd');

            // Cleanup expired routes (past date and unprocessed)
            await checkAndCleanupExpiredRoutes(supabase, cId);

            const [unscheduledData, scheduledData, sandboxData] = await Promise.all([
                getUnscheduledRoutes(supabase, cId),
                getScheduledRoutes(supabase, cId, weekStart, weekEnd),
                getSandboxOrders(supabase, cId)
            ]);

            setUnscheduledRoutes(unscheduledData);
            setScheduledRoutes(scheduledData);
            setSandbox(sandboxData);
        } catch (error) {
            console.error('Error fetching data:', error);
            toast({ title: "Erro ao carregar dados", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    }, [currentWeek, supabase, toast, getCompanyId]);

    // === DRAG HANDLERS ===

    const handleDragStart = useCallback((event: any) => {
        const { active } = event;
        setActiveItem(active.data.current);
    }, []);

    const handleDragEnd = async (event: any) => {
        const { active, over } = event;
        setActiveItem(null);

        if (!over) return;

        const dragData: DragItem = active.data.current;
        const dropData = over.data.current;

        console.log("Drag:", dragData, "Drop:", dropData);

        // CHECK PAST DATE
        if (dropData?.type === 'calendar-day') {
            // dropData.date is "yyyy-MM-dd" string
            // Compare with current date
            // We can use string comparison for ISO dates "yyyy-MM-dd"
            const today = format(new Date(), 'yyyy-MM-dd');
            if (dropData.date < today) {
                toast({
                    title: "Data inválida",
                    description: "Não é possível agendar para uma data passada.",
                    variant: "destructive"
                });
                return;
            }
        }

        // Handle different drop scenarios
        if (dragData.type === 'order' && dropData?.type === 'sandbox') {
            // Order back to Sandbox
            // Check if source route is locked
            if (dragData.sourceRouteId) {
                const sourceRoute = scheduledRoutes.find(r => r.id === dragData.sourceRouteId);
                if (sourceRoute && (sourceRoute.status === 'em_rota' || sourceRoute.status === 'in_progress' || sourceRoute.status === 'concluida' || sourceRoute.status === 'cancelada')) {
                    toast({ title: "Rota bloqueada", description: "Não é possível remover pedidos de rotas em andamento ou concluídas.", variant: "destructive" });
                    return;
                }
            }
            await handleOrderToSandbox(dragData.id, dragData.sourceRouteId);
        } else if (dragData.type === 'order' && (dropData?.type === 'unscheduled-route' || dropData?.type === 'route')) {
            // Order to Route (Unscheduled or Scheduled)
            const targetRouteId = dropData.routeId || dropData.id;

            // Check if target route is locked
            const targetRoute = [...scheduledRoutes, ...unscheduledRoutes].find(r => r.id === targetRouteId);
            if (targetRoute && (targetRoute.status === 'em_rota' || targetRoute.status === 'in_progress' || targetRoute.status === 'concluida' || targetRoute.status === 'cancelada')) {
                toast({ title: "Rota bloqueada", description: "Não é possível adicionar pedidos a rotas em andamento ou concluídas.", variant: "destructive" });
                return;
            }

            // Check if source route is locked
            if (dragData.sourceRouteId) {
                const sourceRoute = scheduledRoutes.find(r => r.id === dragData.sourceRouteId);
                if (sourceRoute && (sourceRoute.status === 'em_rota' || sourceRoute.status === 'in_progress' || sourceRoute.status === 'concluida' || sourceRoute.status === 'cancelada')) {
                    toast({ title: "Rota bloqueada", description: "Não é possível mover pedidos de rotas iniciadas.", variant: "destructive" });
                    return;
                }
            }

            await handleOrderToRoute(dragData.id, targetRouteId, dragData.sourceRouteId);
        } else if (dragData.type === 'order' && dropData?.type === 'calendar-day') {
            // Order to Calendar Day -> Open Modal
            setAddToRouteDate(dropData.date);
            setAddToRouteOrderId(dragData.id);
            setAddToRouteModalOpen(true);
        } else if (dragData.type === 'route' && dropData?.type === 'calendar-day') {
            // Route to Calendar Day (schedule/reschedule)
            if (dragData.route && (dragData.route.status === 'em_rota' || dragData.route.status === 'in_progress' || dragData.route.status === 'concluida' || dragData.route.status === 'cancelada')) {
                toast({ title: "Rota bloqueada", description: "Não é possível reagendar rotas em andamento ou concluídas.", variant: "destructive" });
                return;
            }
            await handleScheduleRoute(dragData.route!.id, dropData.date);
        } else if (dragData.type === 'route' && dropData?.type === 'unscheduled-column') {
            // Scheduled Route back to Unscheduled
            if (dragData.route && (dragData.route.status === 'em_rota' || dragData.route.status === 'in_progress' || dragData.route.status === 'concluida' || dragData.route.status === 'cancelada')) {
                toast({ title: "Rota bloqueada", description: "Não é possível reagendar rotas em andamento ou concluídas.", variant: "destructive" });
                return;
            }
            await handleUnscheduleRoute(dragData.route!.id);
        }
    };

    const handleOrderToSandbox = useCallback(async (orderId: string, sourceRouteId: string = '') => {
        try {
            await removeOrderFromRoute(supabase, sourceRouteId, orderId);
            toast({ title: "Pedido removido da rota" });
            fetchData();
        } catch (err) {
            console.error(err);
            toast({ title: "Erro ao remover pedido", variant: "destructive" });
        }
    }, [supabase, toast, fetchData]);

    const handleOrderToRoute = useCallback(async (orderId: string, targetRouteId: string, sourceRouteId?: string) => {
        if (!userContext) return;

        try {
            if (sourceRouteId) {
                await removeOrderFromRoute(supabase, sourceRouteId, orderId);
            }

            const cId = getCompanyId();
            if (!cId) {
                toast({ title: "Erro", description: "Empresa não identificada", variant: "destructive" });
                return;
            }

            await addOrderToRoute(supabase, targetRouteId, orderId, 999, cId);
            toast({ title: "Pedido adicionado à rota" });
            fetchData();
        } catch (err: any) {
            console.error("Erro ao mover pedido:", JSON.stringify(err, null, 2));
            toast({
                title: "Erro ao mover pedido",
                description: err.message || "Ocorreu um erro desconhecido",
                variant: "destructive"
            });
        }
    }, [userContext, supabase, toast, fetchData]);

    const handleScheduleRoute = useCallback(async (routeId: string, scheduledDate: string) => {
        try {
            await updateRouteSchedule(supabase, routeId, scheduledDate);
            toast({ title: "Rota agendada" });
            fetchData();
        } catch (err) {
            console.error(err);
            toast({ title: "Erro ao agendar rota", variant: "destructive" });
        }
    }, [supabase, toast, fetchData]);

    const handleUnscheduleRoute = useCallback(async (routeId: string) => {
        try {
            await updateRouteSchedule(supabase, routeId, null);
            toast({ title: "Rota desagendada" });
            fetchData();
        } catch (err) {
            console.error(err);
            toast({ title: "Erro ao desagendar rota", variant: "destructive" });
        }
    }, [supabase, toast, fetchData]);

    const handleCreateRoute = useCallback(async () => {
        if (!newRouteName || !userContext) return;
        try {
            const cId = getCompanyId();
            if (!cId) return;

            await createRoute(supabase, {
                company_id: cId,
                name: newRouteName,
                route_date: format(new Date(), 'yyyy-MM-dd'),
                status: 'planned'
            });

            toast({ title: "Rota criada!" });
            setNewRouteOpen(false);
            setNewRouteName("");

            // Refresh only unscheduled routes
            const unscheduledData = await getUnscheduledRoutes(supabase, cId);
            setUnscheduledRoutes(unscheduledData);
        } catch (e) {
            toast({ title: "Erro ao criar rota", variant: "destructive" });
        }
    }, [newRouteName, userContext, supabase, toast]);

    const handleAddToRouteModalSelectRoute = useCallback(async (routeId: string) => {
        if (!addToRouteOrderId) return;
        await handleOrderToRoute(addToRouteOrderId, routeId);
        setAddToRouteModalOpen(false);
        setAddToRouteOrderId(null);
        setAddToRouteDate(null);
    }, [addToRouteOrderId, handleOrderToRoute]);

    const handleAddToRouteModalCreateRoute = useCallback(async (routeName: string) => {
        if (!addToRouteOrderId || !addToRouteDate || !userContext || !userContext.companyId) return;

        try {
            const cId = getCompanyId();
            if (!cId) return;

            const newRoute = await createRoute(supabase, {
                company_id: cId,
                name: routeName,
                route_date: addToRouteDate, // Already in yyyy-MM-dd format
                scheduled_date: addToRouteDate, // Already in yyyy-MM-dd format
                status: 'planned'
            });

            await addOrderToRoute(supabase, newRoute.id, addToRouteOrderId, 1, cId);

            toast({ title: "Rota criada e pedido adicionado!" });
            setAddToRouteModalOpen(false);
            setAddToRouteOrderId(null);
            setAddToRouteDate(null);

            // Refresh scheduled routes for the current week
            const weekStart = format(startOfWeek(currentWeek, { locale: ptBR }), 'yyyy-MM-dd');
            const weekEnd = format(endOfWeek(currentWeek, { locale: ptBR }), 'yyyy-MM-dd');
            const scheduledData = await getScheduledRoutes(supabase, cId, weekStart, weekEnd);
            setScheduledRoutes(scheduledData);

            // Refresh sandbox
            const sandboxData = await getSandboxOrders(supabase, cId);
            setSandbox(sandboxData);
        } catch (e) {
            console.error(e);
            toast({ title: "Erro ao criar rota", variant: "destructive" });
        }
    }, [addToRouteOrderId, addToRouteDate, userContext, currentWeek, supabase, toast]);

    const handleDayClick = useCallback((date: Date, routes: DeliveryRoute[]) => {
        setSelectedDayDate(date);
        setSelectedDayRoutes(routes);
        setDayDetailsOpen(true);
    }, []);

    const toggleSelection = useCallback((id: string) => {
        const newSet = new Set(selectedOrders);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedOrders(newSet);
    }, [selectedOrders]);

    const handleBatchAssign = useCallback(async (targetRouteId: string) => {
        if (selectedOrders.size === 0 || !userContext) return;

        const ordersToMove = sandbox.filter(o => selectedOrders.has(o.id));
        if (ordersToMove.length === 0) return;

        try {
            const cId = getCompanyId();
            if (!cId) return;

            await Promise.all(ordersToMove.map((o, idx) =>
                addOrderToRoute(supabase, targetRouteId, o.id, 999 + idx, cId)
            ));

            setSelectedOrders(new Set());
            setBatchRouteOpen(false);
            toast({ title: `${ordersToMove.length} pedidos adicionados à rota.` });
            fetchData();
        } catch (e) {
            console.error(e);
            toast({ title: "Erro na atribuição em massa", variant: "destructive" });
        }
    }, [selectedOrders, sandbox, userContext, supabase, toast, fetchData]);

    // Get routes for the selected day (for AddToRouteModal)
    const routesForSelectedDay = useMemo(() => {
        if (!addToRouteDate) return [];
        return scheduledRoutes.filter(r =>
            r.scheduled_date === addToRouteDate &&
            r.status !== 'em_rota' &&
            r.status !== 'in_progress' &&
            r.status !== 'concluida'
        );
    }, [addToRouteDate, scheduledRoutes]);

    if (loading && scheduledRoutes.length === 0 && unscheduledRoutes.length === 0) {
        return <div className="p-8 text-center text-gray-500">Carregando expedição...</div>;
    }

    return (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="flex flex-col w-full">
                {/* CALENDAR AT TOP */}
                <WeeklyCalendar
                    currentWeek={currentWeek}
                    scheduledRoutes={scheduledRoutes}
                    onDayClick={handleDayClick}
                    renderRouteCard={(route) => <RouteCardCompact route={route} onRemoveOrder={handleOrderToSandbox} onUnscheduleRoute={handleUnscheduleRoute} />}
                />

                {/* TWO-COLUMN LAYOUT BELOW */}
                <div className="flex gap-6 px-6 pt-6 min-h-[500px]">
                    {/* COLUMN A: SANDBOX - 25% width */}
                    <div className="w-1/4">
                        <SandboxColumn
                            sandbox={sandbox}
                            selectedOrders={selectedOrders}
                            toggleSelection={toggleSelection}
                            batchRouteOpen={batchRouteOpen}
                            setBatchRouteOpen={setBatchRouteOpen}
                            unscheduledRoutes={unscheduledRoutes}
                            handleBatchAssign={handleBatchAssign}
                        />
                    </div>

                    {/* COLUMN B: UNSCHEDULED ROUTES - 75% width */}
                    <div className="flex-1">
                        <UnscheduledRoutesColumn
                            routes={unscheduledRoutes}
                            onCreateRoute={() => setNewRouteOpen(true)}
                            onRefresh={fetchData}
                            onRemoveOrder={handleOrderToSandbox}
                        />
                    </div>
                </div>
            </div>

            {/* MODALS */}
            <Dialog open={newRouteOpen} onOpenChange={setNewRouteOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Nova Rota de Entrega</DialogTitle>
                        <DialogDescription>Crie uma rota para agrupar pedidos.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Nome da Rota</label>
                            <Input placeholder="Ex: Zona Sul, Entrega Rápida..." value={newRouteName} onChange={e => setNewRouteName(e.target.value)} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setNewRouteOpen(false)}>Cancelar</Button>
                        <Button onClick={handleCreateRoute}>Criar Rota</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AddToRouteModal
                open={addToRouteModalOpen}
                onOpenChange={setAddToRouteModalOpen}
                date={addToRouteDate || format(new Date(), 'yyyy-MM-dd')}
                availableRoutes={routesForSelectedDay}
                onSelectRoute={handleAddToRouteModalSelectRoute}
                onCreateRoute={handleAddToRouteModalCreateRoute}
            />

            <DayDetailsPopover
                open={dayDetailsOpen}
                onOpenChange={setDayDetailsOpen}
                date={selectedDayDate || new Date()}
                routes={selectedDayRoutes}
                onUnscheduleRoute={handleUnscheduleRoute}
                onRemoveOrderFromRoute={(orderId: string, routeId: string) => { handleOrderToSandbox(orderId, routeId); }}
            />

            {/* DRAG OVERLAY */}
            <DragOverlay>
                {activeItem && activeItem.type === 'order' && activeItem.order && (
                    <OrderCard order={activeItem.order} type="sandbox" isDragOverlay />
                )}
                {activeItem && activeItem.type === 'route' && activeItem.route && (
                    <RouteCardCompact route={activeItem.route} />
                )}
            </DragOverlay>
        </DndContext>
    );
}

// === SUB-COMPONENTS ===

const SandboxColumn = memo(function SandboxColumn({ sandbox, selectedOrders, toggleSelection, batchRouteOpen, setBatchRouteOpen, unscheduledRoutes, handleBatchAssign }: any) {
    const { setNodeRef, isOver } = useDroppable({
        id: 'sandbox',
        data: { type: 'sandbox' },
    });

    return (
        <div
            ref={setNodeRef}
            className={cn(
                "flex-1 flex flex-col bg-gray-50/50 border border-gray-200 rounded-xl overflow-hidden transition-colors",
                isOver && "bg-blue-50 ring-2 ring-blue-300"
            )}
        >
            <div className="px-4 py-3 border-b border-gray-100 bg-white">
                <div className="flex items-center justify-between">
                    {selectedOrders.size > 0 ? (
                        <div className="flex items-center justify-between w-full bg-blue-50 p-2 rounded-lg border border-blue-100">
                            <span className="text-sm font-medium text-blue-700">{selectedOrders.size} selecionados</span>
                            <Popover open={batchRouteOpen} onOpenChange={setBatchRouteOpen}>
                                <PopoverTrigger asChild>
                                    <Button size="sm" className="h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white border-0">
                                        Adicionar à rota...
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-56 p-2" align="start">
                                    <div className="space-y-1">
                                        <h4 className="text-xs font-semibold text-gray-500 px-2 py-1">Escolher Rota</h4>
                                        {unscheduledRoutes.map((r: DeliveryRoute) => (
                                            <button
                                                key={r.id}
                                                className="w-full text-left px-2 py-1.5 text-sm hover:bg-gray-100 rounded flex items-center justify-between group"
                                                onClick={() => handleBatchAssign(r.id)}
                                            >
                                                <span className="truncate">{r.name}</span>
                                            </button>
                                        ))}
                                        {unscheduledRoutes.length === 0 && <div className="p-2 text-xs text-center text-gray-400">Nenhuma rota disponível.</div>}
                                    </div>
                                </PopoverContent>
                            </Popover>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            <Package className="w-4 h-4 text-gray-400" />
                            <h3 className="text-sm font-semibold text-gray-700">Sandbox</h3>
                            <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full font-medium">{sandbox.length}</span>
                        </div>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {sandbox.map((order: any) => (
                    <OrderCard
                        key={order.id}
                        order={order}
                        type="sandbox"
                        isSelected={selectedOrders.has(order.id)}
                        onToggleSelection={() => toggleSelection(order.id)}
                    />
                ))}
                {sandbox.length === 0 && (
                    <div className="text-center py-10 text-gray-400 text-sm border-2 border-dashed border-gray-100 rounded-lg">
                        Nenhum pedido no sandbox
                    </div>
                )}
            </div>
        </div>
    );
});

const UnscheduledRoutesColumn = memo(function UnscheduledRoutesColumn({ routes, onCreateRoute, onRefresh, onRemoveOrder }: { routes: DeliveryRoute[], onCreateRoute: () => void, onRefresh: () => void, onRemoveOrder: (orderId: string, routeId: string) => void }) {
    const { setNodeRef, isOver } = useDroppable({
        id: 'unscheduled-column',
        data: { type: 'unscheduled-column' },
    });

    return (
        <div
            ref={setNodeRef}
            className={cn(
                "flex flex-col bg-gray-50/50 border border-gray-200 rounded-xl overflow-hidden transition-colors h-full",
                isOver && "bg-green-50 ring-2 ring-green-300"
            )}
        >
            <div className="px-4 py-3 border-b border-gray-100 bg-white flex-shrink-0">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <h3 className="text-sm font-semibold text-gray-700">Rotas Não Agendadas</h3>
                        <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full font-medium">{routes.length}</span>
                    </div>
                    <Button size="sm" variant="outline" onClick={onCreateRoute} className="h-7 text-xs gap-1">
                        <Plus className="w-3 h-3" />
                        Nova Rota
                    </Button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
                {routes.length === 0 ? (
                    <div className="text-center py-10 text-gray-400 text-sm border-2 border-dashed border-gray-100 rounded-lg">
                        Nenhuma rota não agendada
                    </div>
                ) : (
                    <div className="grid grid-cols-3 gap-3">
                        {routes.map((route: DeliveryRoute) => (
                            <UnscheduledRouteCard
                                key={route.id}
                                route={route}
                                onDelete={onRefresh}
                                onRemoveOrder={onRemoveOrder}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
});



