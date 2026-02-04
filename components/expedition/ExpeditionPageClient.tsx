"use client";

import { useState } from "react";
import { ExpeditionKanban } from "@/components/expedition/ExpeditionKanban";
import { Truck, ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { format, addWeeks, startOfWeek, endOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/Button";

interface ExpeditionPageClientProps {
    companyId: string;
}

export function ExpeditionPageClient({ companyId }: ExpeditionPageClientProps) {
    const [currentWeek, setCurrentWeek] = useState(new Date());

    const goToPreviousWeek = () => setCurrentWeek(addWeeks(currentWeek, -1));
    const goToNextWeek = () => setCurrentWeek(addWeeks(currentWeek, 1));
    const goToToday = () => setCurrentWeek(new Date());

    const weekStart = startOfWeek(currentWeek, { locale: ptBR });
    const weekEnd = endOfWeek(currentWeek, { locale: ptBR });

    return (
        <div className="flex flex-col min-h-screen bg-white">
            <div className="flex-none px-6 py-3 border-b border-gray-200 bg-white">
                <div className="flex items-end justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-50 rounded-2xl">
                            <Truck className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900 tracking-tight">Roteirização</h1>
                            <p className="text-xs text-gray-500">Gestão de rotas e separação de pedidos</p>
                        </div>
                    </div>

                    {/* Week Navigator */}
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={goToToday}
                            className="h-8 px-3 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                        >
                            <Calendar className="w-3.5 h-3.5 mr-1.5" />
                            Hoje
                        </Button>

                        <div className="flex items-center border border-gray-200 rounded-2xl overflow-hidden">
                            <button
                                onClick={goToPreviousWeek}
                                className="px-2 py-1.5 hover:bg-gray-50 transition-colors border-r border-gray-200"
                                title="Semana anterior"
                            >
                                <ChevronLeft className="w-4 h-4 text-gray-600" />
                            </button>

                            <div className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-50/50 min-w-36 text-center">
                                {format(weekStart, "dd MMM", { locale: ptBR })} - {format(weekEnd, "dd MMM", { locale: ptBR })}
                            </div>

                            <button
                                onClick={goToNextWeek}
                                className="px-2 py-1.5 hover:bg-gray-50 transition-colors border-l border-gray-200"
                                title="Próxima semana"
                            >
                                <ChevronRight className="w-4 h-4 text-gray-600" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex-1 bg-gray-50/30">
                <ExpeditionKanban
                    currentWeek={currentWeek}
                    setCurrentWeek={setCurrentWeek}
                    companyId={companyId}
                />
            </div>
        </div>
    );
}
