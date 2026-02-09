"use client";

import { format, startOfWeek, endOfWeek, eachDayOfInterval, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DeliveryRouteDTO } from "@/lib/types/expedition-dto";
import { cn } from "@/lib/utils";
import { useDroppable } from "@dnd-kit/core";

interface WeeklyCalendarProps {
    currentWeek: Date;
    scheduledRoutes: DeliveryRouteDTO[];
    onDayClick: (date: Date, routes: DeliveryRouteDTO[]) => void;
    renderRouteCard: (route: DeliveryRouteDTO) => React.ReactNode;
}

export function WeeklyCalendar({ currentWeek, scheduledRoutes, onDayClick, renderRouteCard }: WeeklyCalendarProps) {
    const weekStart = startOfWeek(currentWeek, { locale: ptBR });
    const weekEnd = endOfWeek(currentWeek, { locale: ptBR });
    const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

    // Group routes by scheduled_date
    const routesByDate = scheduledRoutes.reduce((acc, route) => {
        if (route.scheduled_date) {
            const dateKey = route.scheduled_date;
            if (!acc[dateKey]) acc[dateKey] = [];
            acc[dateKey].push(route);
        }
        return acc;
    }, {} as Record<string, DeliveryRouteDTO[]>);

    return (
        <div className="bg-white border-b border-gray-200">
            {/* Week Days Grid */}
            <div className="grid grid-cols-7 gap-px bg-gray-200 border-t">
                {days.map((day) => {
                    const dateKey = format(day, "yyyy-MM-dd");
                    const dayRoutes = routesByDate[dateKey] || [];
                    const isCurrentDay = isToday(day);

                    return (
                        <DayColumn
                            key={dateKey}
                            date={day}
                            dateKey={dateKey}
                            routes={dayRoutes}
                            isToday={isCurrentDay}
                            onDayClick={() => onDayClick(day, dayRoutes)}
                            renderRouteCard={renderRouteCard}
                        />
                    );
                })}
            </div>
        </div>
    );
}

interface DayColumnProps {
    date: Date;
    dateKey: string;
    routes: DeliveryRouteDTO[];
    isToday: boolean;
    onDayClick: () => void;
    renderRouteCard: (route: DeliveryRouteDTO) => React.ReactNode;
}

function DayColumn({ date, dateKey, routes, isToday, onDayClick, renderRouteCard }: DayColumnProps) {
    const { setNodeRef, isOver } = useDroppable({
        id: `day-${dateKey}`,
        data: { type: 'calendar-day', date: dateKey },
    });

    const isPast = dateKey < format(new Date(), "yyyy-MM-dd");

    return (
        <div
            ref={setNodeRef}
            className={cn(
                "bg-white flex flex-col transition-colors",
                isOver && !isPast && "bg-blue-50 ring-2 ring-blue-300 ring-inset",
                isOver && isPast && "bg-red-50 ring-2 ring-red-300 ring-inset"
            )}
        >
            {/* Day Header - 3 column layout */}
            <button
                onClick={onDayClick}
                className={cn(
                    "px-2 py-1.5 text-left border-b border-gray-100 hover:bg-gray-50 transition-colors flex-shrink-0",
                    isToday && "bg-blue-50"
                )}
            >
                <div className="flex items-center justify-between gap-1 w-full">
                    {/* Weekday on left */}
                    <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wide text-left flex-shrink-0 w-8">
                        {format(date, "EEE", { locale: ptBR })}
                    </div>

                    {/* Route count in center */}
                    <div className="text-[9px] text-gray-400 text-center flex items-center justify-center gap-x-1 leading-tight flex-1 whitespace-nowrap overflow-hidden">
                        <span>{routes.length > 0 ? `${routes.length} ${routes.length === 1 ? 'rota' : 'rotas'}` : ''}</span>
                        {routes.length > 0 && (() => {
                            const totalWeight = routes.reduce((acc, r) => {
                                const routeWeight = r.orders?.reduce((sum, o) => sum + (o.sales_order?.total_weight_kg || 0), 0) || 0;
                                return acc + routeWeight;
                            }, 0);


                            return (
                                <>
                                    <span className="text-gray-300">•</span>
                                    <span className="text-gray-500 font-medium">
                                        {new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(totalWeight)} kg
                                    </span>
                                </>
                            );
                        })()}
                    </div>

                    {/* Day number on right */}
                    <div className={cn(
                        "text-lg font-bold leading-none text-right flex-shrink-0 w-8",
                        isToday ? "text-blue-600" : "text-gray-900"
                    )}>
                        {format(date, "dd", { locale: ptBR })}
                    </div>
                </div>
            </button>

            {/* Routes Container - Fixed height for 3 cards, scroll for more */}
            <div className="p-1 space-y-0.5 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent hover:scrollbar-thumb-gray-400 h-24">
                {routes.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-center">
                        <div className="text-[10px] text-gray-300 px-1 leading-tight">
                            Arraste rotas
                        </div>
                    </div>
                ) : (
                    routes.map(route => (
                        <div key={route.id}>
                            {renderRouteCard(route)}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
