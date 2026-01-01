"use client"

import { useState, useEffect, useMemo } from "react"
import { createClient } from "@/lib/supabaseBrowser"
import { PageHeader } from "@/components/ui/PageHeader"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Badge } from "@/components/ui/Badge"
import { Plus, Edit2, AlertCircle } from "lucide-react"
import { Skeleton } from "@/components/ui/Skeleton"
import { SystemReasonSheet } from "@/components/settings/SystemReasonSheet"
import { SystemOccurrenceType, SystemOccurrenceReasonWithDefaults } from "@/types/system-preferences"
import { cn } from "@/lib/utils"

export default function SystemPreferencesPage() {
    const supabase = createClient()
    const [activeTab, setActiveTab] = useState("logistica")

    // Data State
    const [loading, setLoading] = useState(true)
    const [types, setTypes] = useState<SystemOccurrenceType[]>([])
    const [reasons, setReasons] = useState<SystemOccurrenceReasonWithDefaults[]>([])

    // Edit State
    const [isSheetOpen, setIsSheetOpen] = useState(false)
    const [editingReason, setEditingReason] = useState<SystemOccurrenceReasonWithDefaults | null>(null)
    const [targetTypeCode, setTargetTypeCode] = useState<string>("")

    const fetchData = async () => {
        setLoading(true)
        try {
            // Fetch Types
            const { data: typesData, error: typesError } = await supabase
                .from("system_occurrence_types")
                .select("*")
                .order("sort_order")

            if (typesError) throw typesError

            // Fetch Reasons with Defaults
            // Since we can't do deep nesting easily with standard join types without exact definition,
            // we'll fetch reasons and defaults separate or try join if relationship is clear.
            // Let's do separate for safety and merge, or simple inner join.
            // Using a simple query:
            const { data: reasonsData, error: reasonsError } = await supabase
                .from("system_occurrence_reasons")
                .select(`
                    *,
                    defaults:system_occurrence_reason_defaults(*)
                `)
                .order("sort_order")

            if (reasonsError) throw reasonsError

            // Map defaults to single object if array (it should be single or array depending on relation)
            // It is 1:1, so Supabase returns object or array of 1.
            const parsedReasons = (reasonsData || []).map((r: any) => ({
                ...r,
                defaults: Array.isArray(r.defaults) ? r.defaults[0] : r.defaults
            }))

            setTypes(typesData || [])
            setReasons(parsedReasons)

        } catch (error) {
            console.error("Error fetching system preferences:", error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchData()
    }, [])

    // Filter Logic
    const logisticsTypes = useMemo(() => {
        return types.filter(t => t.code.startsWith("EXPEDICAO") || t.code.startsWith("RETORNO"))
    }, [types])

    // Handlers
    const handleAddReason = (typeCode: string) => {
        setTargetTypeCode(typeCode)
        setEditingReason(null)
        setIsSheetOpen(true)
    }

    const handleEditReason = (reason: SystemOccurrenceReasonWithDefaults) => {
        setTargetTypeCode(reason.type_code)
        setEditingReason(reason)
        setIsSheetOpen(true)
    }

    const renderActionBadges = (defaults: any) => {
        if (!defaults) return null
        const active = []
        if (defaults.return_to_sandbox_pending) active.push("Volta p/ Sandbox")
        if (defaults.register_attempt_note) active.push("Log Tentativa")
        if (defaults.reverse_stock_and_finance) active.push("Estorno Estoque/Fin")
        if (defaults.create_devolution) active.push("Gera Devolução")
        if (defaults.create_new_order_for_pending) active.push("Novo Pedido")
        if (defaults.create_complement_order) active.push("Pedido Compl.")
        if (defaults.write_internal_notes) active.push("Notas Int.")

        if (active.length === 0) return <span className="text-gray-400 text-xs text-muted-foreground">-</span>

        return (
            <div className="flex flex-wrap gap-1">
                {active.map(a => (
                    <Badge key={a} variant="secondary" className="text-[10px] px-1.5 h-5 font-normal text-gray-600 bg-gray-100 hover:bg-gray-200 border-gray-200">
                        {a}
                    </Badge>
                ))}
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50/50">
            <PageHeader
                title="Preferências do Sistema"
                subtitle="Configurações globais do ERP (impacta todas as empresas)"
            />

            <div className="px-6 pb-20">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                    <TabsList className="bg-white/50 border border-gray-200 p-1 h-11">
                        <TabsTrigger value="comercial" disabled className="text-gray-400">Comercial</TabsTrigger>
                        <TabsTrigger value="logistica" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">Logística</TabsTrigger>
                        <TabsTrigger value="financeiro" disabled className="text-gray-400">Financeiro</TabsTrigger>
                        <TabsTrigger value="compras" disabled className="text-gray-400">Compras</TabsTrigger>
                        <TabsTrigger value="fiscal" disabled className="text-gray-400">Fiscal</TabsTrigger>
                    </TabsList>

                    <TabsContent value="logistica" className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                        {loading ? (
                            <div className="space-y-4">
                                <Skeleton className="h-40 w-full" />
                                <Skeleton className="h-40 w-full" />
                            </div>
                        ) : (
                            <>
                                {logisticsTypes.map((type) => {
                                    const typeReasons = reasons.filter(r => r.type_code === type.code)

                                    return (
                                        <Card key={type.id} className="border-gray-200 shadow-sm overflow-hidden">
                                            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/30">
                                                <div>
                                                    <h3 className="font-semibold text-gray-900">{type.label}</h3>
                                                    <p className="text-xs text-gray-500 font-mono mt-0.5">{type.code}</p>
                                                </div>
                                                <Button size="sm" onClick={() => handleAddReason(type.code)} className="h-8 shadow-none bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-gray-900">
                                                    <Plus className="w-3.5 h-3.5 mr-1.5" /> Nuevo Motivo
                                                </Button>
                                            </div>

                                            <div className="divide-y divide-gray-100">
                                                {typeReasons.length === 0 ? (
                                                    <div className="p-8 text-center text-gray-400 text-sm italic">
                                                        Nenhum motivo cadastrado para este tipo.
                                                    </div>
                                                ) : (
                                                    <div className="grid grid-cols-12 gap-4 px-6 py-2 bg-gray-50/50 text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-100/50">
                                                        <div className="col-span-4 pl-2">Motivo</div>
                                                        <div className="col-span-1 text-center">Ativo</div>
                                                        <div className="col-span-1 text-center">Obs</div>
                                                        <div className="col-span-5 pl-2">Regras Padrão</div>
                                                        <div className="col-span-1 text-right pr-2">Ação</div>
                                                    </div>
                                                )}

                                                {typeReasons.map(reason => (
                                                    <div key={reason.id} className="grid grid-cols-12 gap-4 px-6 py-3 items-center hover:bg-gray-50 transition-colors group">
                                                        <div className="col-span-4 font-medium text-gray-700 pl-2">
                                                            {reason.label}
                                                        </div>
                                                        <div className="col-span-1 flex justify-center">
                                                            <div className={cn("w-2 h-2 rounded-full", reason.active ? "bg-emerald-500" : "bg-gray-300")} />
                                                        </div>
                                                        <div className="col-span-1 flex justify-center">
                                                            {reason.defaults?.require_note && (
                                                                <AlertCircle className="w-4 h-4 text-amber-500" />
                                                            )}
                                                        </div>
                                                        <div className="col-span-5 pl-2">
                                                            {renderActionBadges(reason.defaults)}
                                                        </div>
                                                        <div className="col-span-1 flex justify-end pr-2">
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-all text-gray-400 hover:text-blue-600"
                                                                onClick={() => handleEditReason(reason)}
                                                            >
                                                                <Edit2 className="w-3.5 h-3.5" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </Card>
                                    )
                                })}
                            </>
                        )}
                    </TabsContent>
                </Tabs>
            </div>

            <SystemReasonSheet
                isOpen={isSheetOpen}
                onClose={() => setIsSheetOpen(false)}
                reason={editingReason}
                typeCode={targetTypeCode}
                onSaved={fetchData}
            />
        </div>
    )
}
