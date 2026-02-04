'use client'

import { useState, useEffect, useCallback } from "react"
import { PlanningCalendar } from "@/components/pcp/PlanningCalendar"
import { ProductionSchedule } from "@/components/pcp/ProductionSchedule"
import { PlanningDayDrawer } from "@/components/pcp/PlanningDayDrawer"
import { getPlanningDataAction } from "@/app/actions/pcp-planning"
import { ItemPlan, PlanningAlert } from "@/lib/pcp/planning-service"
import { Card } from "@/components/ui/Card"
import { Switch } from "@/components/ui/Switch"
import { Label } from "@/components/ui/Label"
import { Button } from "@/components/ui/Button"
import { useToast } from "@/components/ui/use-toast"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select"
import { Loader2, RefreshCw, ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react"

export default function PlanningPage() {
    const { toast } = useToast()
    const [weekStart, setWeekStart] = useState<Date>(() => {
        // Start on today? or Monday?
        // Let's start on "Today" for now to see immediate context
        const d = new Date()
        d.setHours(0, 0, 0, 0)
        return d
    })

    const [data, setData] = useState<ItemPlan[]>([])
    const [alerts, setAlerts] = useState<PlanningAlert[]>([])
    const [loading, setLoading] = useState(true)
    const [includePlannedOps, setIncludePlannedOps] = useState(true)
    const [demandSource, setDemandSource] = useState<'scheduled_routes' | 'confirmed_orders'>('scheduled_routes')

    // Drawer State
    const [drawerOpen, setDrawerOpen] = useState(false)
    const [selectedDate, setSelectedDate] = useState<string | null>(null)

    const fetchData = useCallback(async () => {
        try {
            setLoading(true)

            const startStr = weekStart.toISOString().split('T')[0]
            const end = new Date(weekStart)
            end.setDate(end.getDate() + 14) // Fetch 2 weeks
            const endStr = end.toISOString().split('T')[0]

            const { items, alerts } = await getPlanningDataAction(startStr, endStr, { includePlannedOps, demandSource })
            setData(items)
            setAlerts(alerts)
        } catch (error) {
            console.error(error)
            toast({
                title: "Erro",
                description: "Erro ao carregar dados de planejamento.",
                variant: "destructive"
            })
        } finally {
            setLoading(false)
        }
    }, [weekStart, includePlannedOps, demandSource])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    const handleDayClick = (dateStr: string) => {
        setSelectedDate(dateStr)
        setDrawerOpen(true)
    }

    const handleRefresh = () => {
        fetchData()
        toast({
            title: "Atualizado",
            description: "Dados atualizados."
        })
    }

    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 6)

    return (
        <div className="flex flex-col min-h-screen bg-white">
            <div className="flex-none px-6 py-3 border-b border-gray-200 bg-white">
                <div className="flex items-end justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-50 rounded-2xl">
                            <CalendarIcon className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900 tracking-tight">Planejamento Produção (PCP)</h1>
                            <p className="text-xs text-gray-500">Calendário Inteligente</p>
                        </div>
                    </div>

                    {/* Week Navigator & Controls */}
                    <div className="flex items-center gap-4">

                        {/* Settings Groups */}
                        <div className="hidden md:flex items-center gap-4 mr-4">
                            <div className="flex items-center space-x-2">
                                <Switch
                                    id="include-planned"
                                    checked={includePlannedOps}
                                    onCheckedChange={setIncludePlannedOps}
                                />
                                <Label htmlFor="include-planned" className="cursor-pointer text-xs font-medium text-gray-600">
                                    Considerar Planejadas
                                </Label>
                            </div>

                            <div className="flex items-center space-x-2">
                                <Label htmlFor="demand-source" className="cursor-pointer text-xs font-medium text-gray-600">
                                    Demanda:
                                </Label>
                                <Select
                                    value={demandSource}
                                    onValueChange={(value: 'scheduled_routes' | 'confirmed_orders') => setDemandSource(value)}
                                >
                                    <SelectTrigger id="demand-source" className="h-7 w-40 text-xs">
                                        <SelectValue placeholder="Selecione a fonte" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="scheduled_routes">Rotas Agendadas</SelectItem>
                                        <SelectItem value="confirmed_orders">Pedidos Confirmados</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={loading} className="h-8 w-8 p-0">
                                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : 'text-gray-500'}`} />
                            </Button>
                        </div>


                        <div className="flex items-center gap-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    const d = new Date()
                                    d.setHours(0, 0, 0, 0)
                                    setWeekStart(d)
                                }}
                                className="h-8 px-3 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                            >
                                <CalendarIcon className="w-3.5 h-3.5 mr-1.5" />
                                Hoje
                            </Button>

                            <div className="flex items-center border border-gray-200 rounded-2xl overflow-hidden">
                                <button
                                    onClick={() => {
                                        const d = new Date(weekStart)
                                        d.setDate(d.getDate() - 7)
                                        setWeekStart(d)
                                    }}
                                    className="px-2 py-1.5 hover:bg-gray-50 transition-colors border-r border-gray-200"
                                    title="Semana anterior"
                                >
                                    <ChevronLeft className="w-4 h-4 text-gray-600" />
                                </button>

                                <div className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-50/50 min-w-36 text-center">
                                    {weekStart.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} - {weekEnd.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                                </div>

                                <button
                                    onClick={() => {
                                        const d = new Date(weekStart)
                                        d.setDate(d.getDate() + 7)
                                        setWeekStart(d)
                                    }}
                                    className="px-2 py-1.5 hover:bg-gray-50 transition-colors border-l border-gray-200"
                                    title="Próxima semana"
                                >
                                    <ChevronRight className="w-4 h-4 text-gray-600" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex-1 bg-gray-50/30 overflow-y-auto">
                <PlanningCalendar
                    startDate={weekStart}
                    onDateChange={setWeekStart}
                    data={data}
                    alerts={alerts}
                    onDayClick={handleDayClick}
                />

                <ProductionSchedule
                    startDate={weekStart}
                    onRefreshRequest={fetchData}
                />

                <PlanningDayDrawer
                    isOpen={drawerOpen}
                    onOpenChange={setDrawerOpen}
                    date={selectedDate}
                    data={data}
                    alerts={alerts}
                    onSuccess={fetchData}
                />
            </div>
        </div>
    )
}
