"use client"

import * as React from "react"
import { format, addDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addMonths, addWeeks, isSameDay } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Calendar as CalendarIcon, X } from "lucide-react"
import { DateRange } from "react-day-picker"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/Button"
import { Calendar } from "@/components/ui/calendar"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator";

interface DateRangeFilterProps {
    date: DateRange | undefined
    onDateChange: (date: DateRange | undefined) => void
    placeholder?: string
    className?: string
}

export function DateRangeFilter({
    date,
    onDateChange,
    placeholder = "Período",
    className,
}: DateRangeFilterProps) {
    const [open, setOpen] = React.useState(false)
    const [tempDate, setTempDate] = React.useState<DateRange | undefined>(date)
    const [activePreset, setActivePreset] = React.useState<string | null>(null)

    // Sync tempDate with external date when opening
    React.useEffect(() => {
        if (open) {
            setTempDate(date)
            setActivePreset(null) // Reset preset highlight logic could be smarter, but simplistic for now
        }
    }, [open, date])

    const applyPreset = (preset: string) => {
        const today = new Date()
        let range: DateRange | undefined

        switch (preset) {
            case "hoje":
                range = { from: today, to: today }
                break
            case "amanha":
                const tmr = addDays(today, 1)
                range = { from: tmr, to: tmr }
                break
            case "esta-semana":
                range = {
                    from: startOfWeek(today, { weekStartsOn: 1 }), // Monday
                    to: endOfWeek(today, { weekStartsOn: 1 }),
                }
                break
            case "semana-que-vem":
                const nextWeek = addWeeks(today, 1)
                range = {
                    from: startOfWeek(nextWeek, { weekStartsOn: 1 }),
                    to: endOfWeek(nextWeek, { weekStartsOn: 1 }),
                }
                break
            case "este-mes":
                range = {
                    from: startOfMonth(today),
                    to: endOfMonth(today),
                }
                break
            case "proximo-mes":
                const nextMonth = addMonths(today, 1)
                range = {
                    from: startOfMonth(nextMonth),
                    to: endOfMonth(nextMonth),
                }
                break
        }

        setTempDate(range)
        setActivePreset(preset)
        onDateChange(range) // Apply immediately
        setOpen(false)      // Close
    }

    const handleApply = () => {
        onDateChange(tempDate)
        setOpen(false)
    }

    const handleClear = () => {
        onDateChange(undefined)
        setTempDate(undefined)
        setOpen(false)
    }

    const handleCancel = () => {
        setOpen(false)
    }

    // Formatting the trigger button text
    const getButtonText = () => {
        if (!date?.from) return placeholder

        if (date.to) {
            if (isSameDay(date.from, date.to)) {
                return format(date.from, "dd/MM/yyyy")
            }
            return `${format(date.from, "dd/MM/yyyy")} - ${format(date.to, "dd/MM/yyyy")}`
        }

        return format(date.from, "dd/MM/yyyy")
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant={"outline"}
                    className={cn(
                        "justify-start text-left font-normal w-[240px] bg-white h-10 active:scale-100",
                        !date && "text-muted-foreground",
                        className
                    )}
                >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    <span className="truncate">{getButtonText()}</span>
                    {date && (
                        <div
                            role="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onDateChange(undefined);
                            }}
                            className="ml-auto hover:bg-gray-200 rounded-full p-0.5"
                        >
                            <X className="h-3 w-3 text-gray-500" />
                        </div>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
                <div className="flex">
                    {/* Presets Column */}
                    <div className="flex flex-col gap-1 p-2 border-r w-[140px]">
                        <Button variant={activePreset === "hoje" ? "primary" : "ghost"} size="sm" className="justify-start text-xs" onClick={() => applyPreset("hoje")}>Hoje</Button>
                        <Button variant={activePreset === "amanha" ? "primary" : "ghost"} size="sm" className="justify-start text-xs" onClick={() => applyPreset("amanha")}>Amanhã</Button>
                        <Button variant={activePreset === "esta-semana" ? "primary" : "ghost"} size="sm" className="justify-start text-xs" onClick={() => applyPreset("esta-semana")}>Esta semana</Button>
                        <Button variant={activePreset === "semana-que-vem" ? "primary" : "ghost"} size="sm" className="justify-start text-xs" onClick={() => applyPreset("semana-que-vem")}>Semana que vem</Button>
                        <Button variant={activePreset === "este-mes" ? "primary" : "ghost"} size="sm" className="justify-start text-xs" onClick={() => applyPreset("este-mes")}>Este mês</Button>
                        <Button variant={activePreset === "proximo-mes" ? "primary" : "ghost"} size="sm" className="justify-start text-xs" onClick={() => applyPreset("proximo-mes")}>Próximo mês</Button>

                        <Separator className="my-1" />

                        <Button
                            variant={!activePreset && tempDate?.from ? "secondary" : "ghost"}
                            size="sm"
                            className="justify-start text-xs"
                            onClick={() => setActivePreset(null)}
                        >
                            Entre datas...
                        </Button>
                    </div>

                    {/* Calendar Column */}
                    <div className="p-2">
                        <Calendar
                            mode="range"
                            selected={tempDate}
                            onSelect={setTempDate}
                            initialFocus
                            numberOfMonths={1}
                            locale={ptBR}
                        />
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="flex items-center justify-between p-3 border-t bg-gray-50/50">
                    {date ? (
                        <Button variant="ghost" size="sm" onClick={handleClear} className="text-red-600 hover:text-red-700 h-8 text-xs">
                            Limpar período
                        </Button>
                    ) : <div></div>}

                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={handleCancel} className="h-8 text-xs">
                            Cancelar
                        </Button>
                        <Button size="sm" onClick={handleApply} className="h-8 text-xs">
                            Aplicar
                        </Button>
                    </div>
                </div>

            </PopoverContent>
        </Popover>
    )
}
