"use client";

import { format, startOfWeek, endOfWeek, eachDayOfInterval, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DeliveryRoute } from "@/types/sales";
import { cn } from "@/lib/utils";
import { useDroppable } from "@dnd-kit/core";

interface WeeklyCalendarProps {
    currentWeek: Date;
    scheduledRoutes: DeliveryRoute[];
    onDayClick: (date: Date, routes: DeliveryRoute[]) => void;
    renderRouteCard: (route: DeliveryRoute) => React.ReactNode;
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
    }, {} as Record<string, DeliveryRoute[]>);

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
    routes: DeliveryRoute[];
    isToday: boolean;
    onDayClick: () => void;
    renderRouteCard: (route: DeliveryRoute) => React.ReactNode;
}

function DayColumn({ date, dateKey, routes, isToday, onDayClick, renderRouteCard }: DayColumnProps) {
    const { setNodeRef, isOver } = useDroppable({
        id: `day-${dateKey}`,
        data: { type: 'calendar-day', date: dateKey },
    });

    return (
        <div
            ref={setNodeRef}
            className={cn(
                "bg-white flex flex-col transition-colors",
                isOver && "bg-blue-50 ring-2 ring-blue-300 ring-inset"
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
                <div className="grid grid-cols-3 items-center gap-1">
                    {/* Weekday on left */}
                    <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wide text-left">
                        {format(date, "EEE", { locale: ptBR })}
                    </div>

                    {/* Route count in center */}
                    <div className="text-[9px] text-gray-400 text-center">
                        {routes.length > 0 ? `${routes.length} ${routes.length === 1 ? 'rota' : 'rotas'}` : ''}
                    </div>

                    {/* Day number on right */}
                    <div className={cn(
                        "text-lg font-bold leading-none text-right",
                        isToday ? "text-blue-600" : "text-gray-900"
                    )}>
                        {format(date, "dd", { locale: ptBR })}
                    </div>
                </div>
            </button>

            {/* Routes Container - Fixed height for 3 cards, scroll for more */}
            <div className="p-1 space-y-0.5 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent hover:scrollbar-thumb-gray-400 max-h-[89px]">
                {routes.length === 0 ? (
                    <div className="h-[79px] flex items-center justify-center text-center">
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
