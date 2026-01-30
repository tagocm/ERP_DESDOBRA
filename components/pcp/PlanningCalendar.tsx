import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Package, AlertTriangle, Utensils } from "lucide-react"
import { DailyPlan, ItemPlan, PlanningAlert } from "@/lib/pcp/planning-service"
import { cn } from "@/lib/utils"
import { format, isToday, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import { PendingSkuCard } from "./PendingSkuCard"

interface PlanningCalendarProps {
    startDate: Date
    onDateChange: (date: Date) => void
    data: ItemPlan[]
    alerts?: PlanningAlert[]
    onDayClick: (date: string) => void
}

export function PlanningCalendar({ startDate, onDateChange, data, alerts = [], onDayClick }: PlanningCalendarProps) {

    // Pivot data: Date -> List of Items with activity
    const calendarData = useMemo(() => {
        const map = new Map<string, { item: ItemPlan, day: DailyPlan }[]>()
        const alertMap = new Map<string, PlanningAlert[]>()

        // Initialize days
        const daysKeys: string[] = []
        const curr = new Date(startDate)
        for (let i = 0; i < 7; i++) {
            const d = curr.toISOString().split('T')[0]
            daysKeys.push(d)
            map.set(d, [])
            alertMap.set(d, [])
            curr.setDate(curr.getDate() + 1)
        }

        data.forEach(item => {
            item.days.forEach(day => {
                // Determine if this item should appear on the calendar card
                // Show if: Shortage (Problem) OR Production (Planned Work) OR Demand (Need)
                // This ensures "Pendências" covers "Things happening today"
                if (day.shortage > 0 || day.production > 0) {
                    const list = map.get(day.date)
                    if (list) list.push({ item, day })
                }
            })
        })

        alerts.forEach(alert => {
            // Only if date is in range
            if (alertMap.has(alert.date)) {
                alertMap.get(alert.date)!.push(alert)
            }
        })

        return { map, alertMap, daysKeys }
    }, [data, alerts, startDate])

    return (
        <div className="bg-white border-b border-gray-200">
            {/* Week Days Grid */}
            <div className="grid grid-cols-7 gap-px bg-gray-200 border-t">
                {calendarData.daysKeys.map((dateKey) => {
                    const dateObj = new Date(dateKey + 'T00:00:00') // Fix timezone offset
                    const items = calendarData.map.get(dateKey) || []
                    const currentAlerts = calendarData.alertMap.get(dateKey) || []
                    const isCurrentDay = isToday(dateObj)

                    const totalShortageSkus = items.length
                    const totalAlerts = currentAlerts.length

                    return (
                        <div
                            key={dateKey}
                            className={cn(
                                "bg-white flex flex-col transition-colors min-h-[220px]",
                            )}
                        >
                            {/* Day Header */}
                            <button
                                onClick={() => onDayClick(dateKey)}
                                className={cn(
                                    "px-2 py-2 text-left border-b border-gray-100 hover:bg-gray-50 transition-colors flex-shrink-0 group",
                                    isCurrentDay && "bg-blue-50"
                                )}
                            >
                                <div className="flex items-center justify-between gap-1 w-full">
                                    {/* Weekday */}
                                    <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wide flex-shrink-0 w-8">
                                        {format(dateObj, "EEE", { locale: ptBR })}
                                    </div>

                                    {/* Stats */}
                                    <div className="text-[9px] text-gray-400 text-center flex flex-col items-center justify-center leading-tight flex-1 gap-1">
                                        {totalShortageSkus > 0 ? (
                                            <span className="text-red-600 font-semibold bg-red-50 px-1.5 py-0.5 rounded-full">
                                                {totalShortageSkus} {totalShortageSkus === 1 ? 'pendente' : 'pendentes'}
                                            </span>
                                        ) : (
                                            <span className="opacity-0 group-hover:opacity-50 transition-opacity">Ver detalhes</span>
                                        )}

                                        {totalAlerts > 0 && (
                                            <span className="text-amber-600 font-medium bg-amber-50 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                                                <AlertTriangle className="w-2.5 h-2.5" />
                                                {totalAlerts} {totalAlerts === 1 ? 'alerta' : 'alertas'}
                                            </span>
                                        )}
                                    </div>

                                    {/* Day Number */}
                                    <div className={cn(
                                        "text-lg font-bold leading-none text-right flex-shrink-0 w-8",
                                        isCurrentDay ? "text-blue-600" : "text-gray-900"
                                    )}>
                                        {format(dateObj, "dd", { locale: ptBR })}
                                    </div>
                                </div>
                            </button>

                            {/* Body: Scrollable Cards */}
                            <div className="p-1 space-y-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200 hover:scrollbar-thumb-gray-300 h-[190px]">
                                {items.length === 0 && totalAlerts === 0 ? (
                                    <div className="h-full flex items-center justify-center text-center">
                                        <div className="text-[10px] text-gray-300 px-1 italic">
                                            Sem pendências
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        {/* Show Pending Items */}
                                        {items.map((entry, idx) => (
                                            <PendingSkuCard
                                                key={`${dateKey}-${entry.item.item_id}`}
                                                name={entry.item.item_name}
                                                shortage={entry.day.shortage}
                                                recipes={entry.day.recipes_needed}
                                                uom={entry.item.uom}
                                                onClick={() => onDayClick(dateKey)}
                                            />
                                        ))}

                                        {/* Show Alert items summary if needed? Or just rely on the count header.
                                            Let's show a small footer card if there are alerts but no pending items, 
                                            so the day doesn't look empty when it has alerts. 
                                        */}
                                        {items.length === 0 && totalAlerts > 0 && (
                                            <div className="text-[10px] text-amber-600 bg-amber-50 p-2 rounded text-center cursor-pointer hover:bg-amber-100" onClick={() => onDayClick(dateKey)}>
                                                Há {totalAlerts} itens com alerta.
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
