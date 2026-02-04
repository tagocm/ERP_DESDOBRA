'use client'

import { useState, useMemo } from "react"
import Link from "next/link"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/Dialog"
import { Button, buttonVariants } from "@/components/ui/Button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table"
import { Badge } from "@/components/ui/Badge"
import { Input } from "@/components/ui/Input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ItemPlan, PlanningAlert, DailyPlan } from "@/lib/pcp/planning-service"
import { generateWorkOrdersAction } from "@/app/actions/pcp-planning"
import { useToast } from "@/components/ui/use-toast"
import { Loader2, CheckCircle2, AlertTriangle, FileWarning, ExternalLink, Plus } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs"
import { cn } from "@/lib/utils"

interface PlanningDayDrawerProps {
    isOpen: boolean
    onOpenChange: (open: boolean) => void
    date: string | null
    data: ItemPlan[]
    alerts?: PlanningAlert[]
    onSuccess: () => void
}

export function PlanningDayDrawer({ isOpen, onOpenChange, date, data, alerts = [], onSuccess }: PlanningDayDrawerProps) {
    const { toast } = useToast()
    const [isSubmitting, setIsSubmitting] = useState(false)

    // Filter items that have shortage OR demand OR production on this day
    const dayItems = useMemo(() => {
        if (!date) return []
        return data.map(item => {
            const day = item.days.find(d => d.date === date)
            return {
                ...item,
                day
            }
        }).filter(item => {
            if (!item.day) return false
            // Show if shortage > 0 OR demand > 0 OR production > 0
            return (item.day.demand > 0 || item.day.production > 0 || item.day.shortage > 0)
        })
    }, [data, date])

    const dayAlerts = useMemo(() => {
        if (!date) return []
        return alerts.filter(a => a.date === date)
    }, [alerts, date])

    const itemsToProduce = useMemo(() => {
        return dayItems.filter(i => i.day && i.day.shortage > 0 && i.has_bom)
    }, [dayItems])

    const totalShortageQty = useMemo(() => {
        return itemsToProduce.reduce((acc, item) => acc + (item.day?.shortage || 0), 0)
    }, [itemsToProduce])

    const handleGenerateAll = async () => {
        if (!date) return
        if (itemsToProduce.length === 0) {
            toast({
                title: "Nenhuma falta",
                description: "Nenhuma falta com ficha técnica para produzir."
            })
            return
        }

        try {
            setIsSubmitting(true)
            const payload = itemsToProduce.map(item => ({
                item_id: item.item_id,
                qty: item.day!.shortage, // Default to shortage
                bom_id: item.day!.bom_id
            }))

            await generateWorkOrdersAction({ date, items: payload })

            toast({
                title: "Sucesso",
                description: "Ordens de produção geradas/atualizadas com sucesso!",
                variant: "default"
            })
            onSuccess()
            onOpenChange(false)
        } catch (error) {
            console.error(error)
            toast({
                title: "Erro",
                description: "Erro ao gerar ordens.",
                variant: "destructive"
            })
        } finally {
            setIsSubmitting(false)
        }
    }

    if (!date) return null

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="w-full max-w-screen-2xl h-dvh p-0 gap-0 overflow-hidden rounded-2xl border-none shadow-float bg-white/95 backdrop-blur-xl ring-1 ring-black/5 flex flex-col">
                {/* Header */}
                <div className="flex flex-col space-y-1.5 p-6 border-b bg-gradient-to-b from-white to-gray-50/50 flex-none">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-3">
                            <span className="bg-amber-100/50 p-2 rounded-full text-amber-700">
                                🗓️
                            </span>
                            Planejamento do Dia: <span className="text-amber-600 ml-1">{new Date(date).toLocaleDateString('pt-BR')}</span>
                        </DialogTitle>
                        <DialogDescription className="text-base text-gray-500 ml-12">
                            Gerencie faltas, visualize estoque real e planeje a produção.
                        </DialogDescription>
                    </DialogHeader>
                </div>

                {/* Content with Tabs */}
                <div className="flex-1 overflow-hidden bg-white/50 flex flex-col">
                    <Tabs defaultValue="production" className="flex-1 flex flex-col">
                        <div className="px-6 pt-4 flex-none border-b bg-gray-50/30">
                            <TabsList className="bg-gray-100/50 p-1">
                                <TabsTrigger value="production" className="data-[state=active]:bg-white data-[state=active]:ring-1 data-[state=active]:ring-black/5 px-4">
                                    Produção / Faltas
                                    {itemsToProduce.length > 0 && <Badge className="ml-2 h-5 px-1.5 bg-amber-600 hover:bg-amber-700 text-white">{itemsToProduce.length}</Badge>}
                                </TabsTrigger>
                                <TabsTrigger value="alerts" className="data-[state=active]:bg-white data-[state=active]:ring-1 data-[state=active]:ring-black/5 px-4">
                                    Alertas / Não Conformes
                                    {dayAlerts.length > 0 && <Badge variant="secondary" className="ml-2 h-5 px-1.5 bg-red-100 text-red-700 hover:bg-red-200">{dayAlerts.length}</Badge>}
                                </TabsTrigger>
                            </TabsList>
                        </div>

                        <TabsContent value="production" className="flex-1 overflow-hidden p-0 m-0 data-[state=inactive]:hidden flex flex-col">
                            <ScrollArea className="flex-1 h-full">
                                <Table>
                                    <TableHeader className="bg-gray-50/80 sticky top-0 z-10 backdrop-blur-sm ring-1 ring-gray-100">
                                        <TableRow className="hover:bg-transparent border-gray-100 divide-x divide-gray-100">
                                            <TableHead className="w-1/5 pl-8 py-3 font-semibold text-gray-700">Produto</TableHead>
                                            <TableHead className="w-1/12 text-right py-3 font-semibold text-gray-700 bg-blue-50/30">Necessário</TableHead>
                                            <TableHead className="w-1/12 text-right py-3 font-semibold text-gray-700 bg-gray-50/50">Estoque Atual</TableHead>
                                            <TableHead className="w-1/12 text-right py-3 font-semibold text-gray-700 bg-green-50/30">Prod. Planejada</TableHead>
                                            <TableHead className="w-1/12 text-right py-3 font-semibold text-gray-700 bg-purple-50/30">Estoque Projetado</TableHead>
                                            <TableHead className="w-1/12 text-right py-3 font-semibold text-gray-700">Falta</TableHead>
                                            <TableHead className="w-1/12 text-center py-3 font-semibold text-gray-700">FT / Lotes</TableHead>
                                            <TableHead className="w-1/6 text-right pr-8 py-3 font-semibold text-gray-700">Ação</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody className="divide-y divide-gray-50">
                                        {dayItems.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={8} className="text-center py-20 text-muted-foreground flex flex-col items-center justify-center gap-2">
                                                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center text-3xl mb-2">🎉</div>
                                                    <span className="text-lg font-medium text-gray-900">Tudo em ordem!</span>
                                                    <span>Nenhuma item crítico para este dia.</span>
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            dayItems.map((item) => {
                                                const demand = item.day?.demand || 0
                                                const currentStock = item.current_stock || 0
                                                const plannedProduction = item.day?.accumulated_production || 0
                                                const projectedStock = currentStock + plannedProduction - demand
                                                const shortage = item.day!.shortage

                                                return (
                                                    <TableRow key={item.item_id} className="hover:bg-amber-50/30 transition-colors border-gray-100 group">
                                                        <TableCell className="pl-8 py-3 align-top">
                                                            <div className="font-semibold text-gray-900 text-sm">{item.item_name}</div>
                                                            <div className="text-xs text-gray-400 font-mono mt-0.5">{item.item_sku}</div>
                                                        </TableCell>

                                                        {/* Necessário */}
                                                        <TableCell className="text-right py-3 align-top bg-blue-50/10 font-medium text-gray-700">
                                                            {new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(item.day?.demand || 0)}
                                                            <span className="text-[10px] text-gray-400 ml-1">{item.uom}</span>
                                                        </TableCell>

                                                        {/* Estoque Atual */}
                                                        <TableCell className="text-right py-3 align-top bg-gray-50/20">
                                                            <div className="flex flex-col items-end">
                                                                <span className={cn(
                                                                    "font-medium",
                                                                    item.current_stock < 0 ? "text-red-500" : "text-gray-600"
                                                                )}>
                                                                    {new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(item.current_stock)} <span className="text-[10px] text-gray-400">{item.uom}</span>
                                                                </span>
                                                                {item.current_stock < 0 && (
                                                                    <Badge variant="outline" className="text-[9px] h-4 px-1 mt-1 border-red-200 text-red-600 bg-red-50">
                                                                        Inconsistente
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                        </TableCell>

                                                        {/* Produção Planejada */}
                                                        <TableCell className="text-right py-3 align-top bg-green-50/10">
                                                            <span className="text-green-700 font-medium">
                                                                +{new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(plannedProduction)}
                                                                <span className="text-[10px] text-green-600/70 ml-1">{item.uom}</span>
                                                            </span>
                                                        </TableCell>

                                                        {/* Estoque Projetado */}
                                                        <TableCell className="text-right py-3 align-top bg-purple-50/10">
                                                            <span className={cn(
                                                                "font-medium",
                                                                projectedStock < 0 ? "text-red-600" : "text-purple-700"
                                                            )}>
                                                                {new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(projectedStock)}
                                                                <span className="text-[10px] text-purple-600/70 ml-1">{item.uom}</span>
                                                            </span>
                                                        </TableCell>

                                                        {/* Falta */}
                                                        <TableCell className="text-right py-3 align-top">
                                                            {shortage > 0 ? (
                                                                <span className="text-red-600 font-bold bg-red-50 px-2 py-0.5 rounded-full">
                                                                    -{new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(shortage)}
                                                                    <span className="text-[10px] text-red-400 font-normal ml-1">{item.uom}</span>
                                                                </span>
                                                            ) : (
                                                                <span className="text-gray-300">-</span>
                                                            )}
                                                        </TableCell>

                                                        {/* FT / Lotes */}
                                                        <TableCell className="text-center py-3 align-top">
                                                            <div className="flex flex-col items-center gap-1">
                                                                {/* Recipes Count */}
                                                                {shortage > 0 && item.has_bom ? (
                                                                    <div className="flex flex-row items-center gap-1 justify-center">
                                                                        <span className="font-bold text-amber-700 text-sm">
                                                                            {item.day?.recipes_needed}
                                                                        </span>
                                                                        <span className="text-[9px] text-gray-400">Lt</span>
                                                                    </div>
                                                                ) : (
                                                                    <span className="font-medium text-transparent select-none text-xs">-</span>
                                                                )}

                                                                {/* FT Status Badge */}
                                                                {item.has_bom ? (
                                                                    <Badge variant="outline" className="text-[9px] h-4 px-1 border-green-200 text-green-700 bg-green-50/50">
                                                                        FT Ativa
                                                                    </Badge>
                                                                ) : (
                                                                    <Badge variant="outline" className="text-[9px] h-4 px-1 border-gray-200 text-gray-400">
                                                                        Sem FT
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                        </TableCell>

                                                        {/* Ação */}
                                                        <TableCell className="text-right pr-8 py-3 align-top">
                                                            <SmartActionCell
                                                                item={item}
                                                                shortage={shortage}
                                                                date={date}
                                                                onSuccess={onSuccess}
                                                            />
                                                        </TableCell>
                                                    </TableRow>
                                                )
                                            })
                                        )}
                                    </TableBody>
                                </Table>
                            </ScrollArea>

                            {/* Footer */}
                            <div className="flex-none p-6 border-t bg-gray-50/80 backdrop-blur-sm flex items-center justify-between mt-auto">
                                <div className="flex items-center gap-6">
                                    <div className="flex items-center gap-2">
                                        <div className="h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 font-bold border border-amber-200">
                                            {itemsToProduce.length}
                                        </div>
                                        <span className="text-sm font-medium text-gray-600">
                                            Itens com falta
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 px-4 py-1.5 bg-red-50 rounded-2xl border border-red-100">
                                        <span className="text-xs text-red-600 uppercase font-semibold">Total a produzir</span>
                                        <span className="text-lg font-bold text-red-700">{new Intl.NumberFormat('pt-BR').format(totalShortageQty)}</span>
                                    </div>
                                </div>

                                <div className="flex gap-3">
                                    <Button
                                        variant="outline"
                                        onClick={() => onOpenChange(false)}
                                        className="border-gray-200 hover:bg-white hover:text-gray-900"
                                    >
                                        Cancelar
                                    </Button>
                                    <Button
                                        onClick={handleGenerateAll}
                                        disabled={isSubmitting || itemsToProduce.length === 0}
                                        className="bg-amber-600 hover:bg-amber-700 text-white px-6 font-semibold"
                                    >
                                        {isSubmitting ? (
                                            <>
                                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                Processando...
                                            </>
                                        ) : (
                                            "Gerar OPs do Dia"
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </TabsContent>

                        <TabsContent value="alerts" className="flex-1 overflow-hidden p-0 m-0 data-[state=inactive]:hidden">
                            <ScrollArea className="h-full">
                                <Table>
                                    <TableHeader className="bg-red-50/80 sticky top-0 z-10 backdrop-blur-sm ring-1 ring-red-100">
                                        <TableRow className="hover:bg-transparent border-red-100">
                                            <TableHead className="w-2/5 pl-8 py-4 font-semibold text-red-800">Produto / SKU</TableHead>
                                            <TableHead className="text-center py-4 font-semibold text-red-800">Demanda (Qtd)</TableHead>
                                            <TableHead className="text-left py-4 font-semibold text-red-800">Motivo do Alerta</TableHead>
                                            <TableHead className="text-right pr-8 py-4 font-semibold text-red-800">Ação Recomendada</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {dayAlerts.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={4} className="text-center py-20 text-muted-foreground">
                                                    Nenhum alerta para hoje.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            dayAlerts.map((alert, idx) => (
                                                <TableRow key={`${alert.item_id}-${idx}`} className="hover:bg-red-50/30 transition-colors border-red-100">
                                                    <TableCell className="pl-8 py-4">
                                                        <div className="font-semibold text-gray-900">{alert.item_name}</div>
                                                        <div className="text-xs text-gray-500 font-mono mt-0.5">{alert.item_sku}</div>
                                                    </TableCell>
                                                    <TableCell className="text-center py-4 font-medium text-gray-700">
                                                        {alert.quantity} <span className="text-xs text-gray-400">{alert.uom}</span>
                                                    </TableCell>
                                                    <TableCell className="text-left py-4">
                                                        {alert.type === 'no_bom' ? (
                                                            <div className="flex items-center gap-2 text-red-600 bg-red-50 w-fit px-2 py-1 rounded-full border border-red-100">
                                                                <FileWarning className="w-4 h-4" />
                                                                <span className="text-xs font-medium">Sem Receita (BOM ativa não encontrada)</span>
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center gap-2 text-amber-600 bg-amber-50 w-fit px-2 py-1 rounded-full border border-amber-100">
                                                                <AlertTriangle className="w-4 h-4" />
                                                                <span className="text-xs font-medium">Fora do PCP (não é produto acabado)</span>
                                                            </div>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right pr-8 py-4 text-sm">
                                                        <Link
                                                            href={`/app/cadastros/itens/${alert.item_id}`}
                                                            target="_blank"
                                                            className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "text-blue-600 px-0 h-auto hover:text-blue-700 hover:bg-transparent")}
                                                        >
                                                            <ExternalLink className="w-3 h-3 mr-1" /> Abrir Item
                                                        </Link>
                                                        {alert.type === 'no_bom' && (
                                                            <Button variant="outline" size="sm" className="ml-2 h-7 text-xs border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100">
                                                                Criar Ficha
                                                            </Button>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </ScrollArea>
                        </TabsContent>
                    </Tabs>
                </div>
            </DialogContent>
        </Dialog>
    )
}

function SmartActionCell({ item, shortage, date, onSuccess }: { item: ItemPlan & { day?: DailyPlan }, shortage: number, date: string, onSuccess: () => void }) {
    const [open, setOpen] = useState(false)
    const [qty, setQty] = useState(shortage > 0 ? shortage.toString() : "0")
    const [loading, setLoading] = useState(false)
    const { toast } = useToast()

    const handleConfirm = async () => {
        const val = parseFloat(qty)
        if (isNaN(val) || val <= 0) {
            toast({ title: "Valor inválido", description: "Informe uma quantidade maior que zero.", variant: "destructive" })
            return
        }

        try {
            setLoading(true)
            await generateWorkOrdersAction({
                date,
                items: [{
                    item_id: item.item_id,
                    qty: val,
                    bom_id: item.day?.bom_id
                }]
            })
            toast({ title: "Sucesso", description: "Ordem de produção gerada/atualizada." })
            setOpen(false)
            onSuccess()
        } catch (error) {
            console.error(error)
            toast({ title: "Erro", description: "Falha ao gerar ordem.", variant: "destructive" })
        } finally {
            setLoading(false)
        }
    }

    if (shortage <= 0) {
        return (
            <div className="flex items-center justify-end gap-1 text-green-600 font-medium text-sm">
                <CheckCircle2 className="w-4 h-4" /> Coberto
            </div>
        )
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                    <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 text-xs border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-700 font-medium transition-all"
                    >
                        <Plus className="w-3 h-3 mr-1" /> Gerar OP
                    </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-3" align="end">
                <div className="space-y-3">
                    <div className="space-y-1">
                        <h4 className="font-medium text-sm text-gray-900">Gerar/Completar OP</h4>
                        <p className="text-[10px] text-gray-500">Adicionar à produção do dia.</p>
                    </div>
                    <div className="flex gap-2">
                        <Input
                            type="number"
                            value={qty}
                            onChange={e => setQty(e.target.value)}
                            className="h-8 text-sm"
                            autoFocus
                        />
                        <Button size="sm" onClick={handleConfirm} disabled={loading} className="h-8 bg-amber-600 hover:bg-amber-700 text-white">
                            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : "OK"}
                        </Button>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    )
}
