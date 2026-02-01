"use client";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select-shadcn";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Search, Filter, X, Calendar as CalendarIcon } from "lucide-react";
import { format, parseISO, startOfWeek, endOfWeek, startOfMonth, startOfYear, subWeeks, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/Card";
import { CardHeaderStandard } from "@/components/ui/CardHeaderStandard";
import { useState, useEffect } from "react";

export interface PurchasesFiltersType {
    search?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    supplierId?: string;
    showCancelled?: boolean;
    showArchived?: boolean;
}

interface PurchasesFiltersProps {
    filters: PurchasesFiltersType;
    onChange: (filters: PurchasesFiltersType) => void;
}

export function PurchasesFilters({ filters, onChange }: PurchasesFiltersProps) {
    const [localFilters, setLocalFilters] = useState<PurchasesFiltersType>(filters);
    const [isOpen, setIsOpen] = useState(true);
    const [quickDateFilter, setQuickDateFilter] = useState<string>('custom');

    useEffect(() => {
        setLocalFilters(filters);
    }, [filters]);

    useEffect(() => {
        if (quickDateFilter !== 'custom') {
            const timer = setTimeout(() => {
                setQuickDateFilter('custom');
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [localFilters.dateFrom, localFilters.dateTo]);

    const handleApply = () => {
        onChange(localFilters);
    };

    const handleQuickFilterChange = (value: string) => {
        setQuickDateFilter(value);

        if (value === 'custom') return;

        const today = new Date();
        let dateFrom: Date | undefined;
        let dateTo: Date | undefined = today;

        switch (value) {
            case 'today':
                dateFrom = today;
                break;
            case 'this_week':
                dateFrom = startOfWeek(today, { locale: ptBR });
                break;
            case 'last_week':
                const lastWeek = subWeeks(today, 1);
                dateFrom = startOfWeek(lastWeek, { locale: ptBR });
                dateTo = endOfWeek(lastWeek, { locale: ptBR });
                break;
            case 'this_month':
                dateFrom = startOfMonth(today);
                break;
            case 'last_3_months':
                dateFrom = startOfMonth(subMonths(today, 2));
                break;
            case 'this_year':
                dateFrom = startOfYear(today);
                break;
        }

        setLocalFilters({
            ...localFilters,
            dateFrom: dateFrom ? format(dateFrom, 'yyyy-MM-dd') : undefined,
            dateTo: dateTo ? format(dateTo, 'yyyy-MM-dd') : undefined
        });
    };

    const handleReset = () => {
        const reset: PurchasesFiltersType = {};
        setLocalFilters(reset);
        setQuickDateFilter('custom');
        onChange(reset);
    };

    if (!isOpen) {
        return (
            <div className="flex gap-2 mb-6">
                <Button variant="outline" onClick={() => setIsOpen(true)}>
                    <Filter className="w-4 h-4 mr-2" /> Filtros
                </Button>
                {filters.search && (
                    <div className="flex items-center gap-2 bg-gray-100 px-3 rounded text-sm">
                        Busca: {filters.search} <X className="w-3 h-3 cursor-pointer" onClick={() => {
                            const n = { ...localFilters, search: undefined };
                            setLocalFilters(n);
                            onChange(n);
                        }} />
                    </div>
                )}
            </div>
        );
    }

    return (
        <Card className="mb-6">
            <CardHeaderStandard
                icon={<Filter className="w-5 h-5" />}
                title="Filtros Avançados"
                actions={
                    <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)} className="h-8 w-8 p-0">
                        <X className="w-4 h-4 text-gray-500" />
                    </Button>
                }
            />

            <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-500">Busca Rápida</label>
                        <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                            <Input
                                placeholder="Fornecedor, notas..."
                                className="pl-9"
                                value={localFilters.search || ''}
                                onChange={e => setLocalFilters({ ...localFilters, search: e.target.value })}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleApply();
                                    }
                                }}
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-500">Status</label>
                        <Select
                            value={localFilters.status || 'all'}
                            onValueChange={val => setLocalFilters({ ...localFilters, status: val === 'all' ? undefined : val })}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Todos" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos</SelectItem>
                                <SelectItem value="draft">Rascunho</SelectItem>
                                <SelectItem value="sent">Enviado</SelectItem>
                                <SelectItem value="received">Recebido</SelectItem>
                                <SelectItem value="cancelled">Cancelado</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-500">Período (De)</label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant={"secondary"}
                                    className={cn(
                                        "w-full justify-start text-left font-normal rounded-2xl border-gray-200 bg-white h-10 shadow-sm",
                                        !localFilters.dateFrom && "text-muted-foreground"
                                    )}
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4 text-gray-400" />
                                    {localFilters.dateFrom ? format(parseISO(localFilters.dateFrom), "dd/MM/yyyy") : <span className="text-gray-400">dd/mm/aaaa</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                    mode="single"
                                    selected={localFilters.dateFrom ? parseISO(localFilters.dateFrom) : undefined}
                                    onSelect={(date) => setLocalFilters({
                                        ...localFilters,
                                        dateFrom: date ? format(date, "yyyy-MM-dd") : undefined
                                    })}
                                    initialFocus
                                />
                            </PopoverContent>
                        </Popover>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-500">Período (Até)</label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant={"secondary"}
                                    className={cn(
                                        "w-full justify-start text-left font-normal rounded-2xl border-gray-200 bg-white h-10 shadow-sm",
                                        !localFilters.dateTo && "text-muted-foreground"
                                    )}
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4 text-gray-400" />
                                    {localFilters.dateTo ? format(parseISO(localFilters.dateTo), "dd/MM/yyyy") : <span className="text-gray-400">dd/mm/aaaa</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                    mode="single"
                                    selected={localFilters.dateTo ? parseISO(localFilters.dateTo) : undefined}
                                    onSelect={(date) => setLocalFilters({
                                        ...localFilters,
                                        dateTo: date ? format(date, "yyyy-MM-dd") : undefined
                                    })}
                                    initialFocus
                                />
                            </PopoverContent>
                        </Popover>
                    </div>

                    <div className="space-y-1 flex items-end pb-2">
                        <div className="flex items-center space-x-2">
                            <input
                                type="checkbox"
                                id="showCancelled"
                                className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-600"
                                checked={localFilters.showCancelled || false}
                                onChange={(e) => setLocalFilters({ ...localFilters, showCancelled: e.target.checked })}
                            />
                            <label
                                htmlFor="showCancelled"
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-gray-700"
                            >
                                Mostrar Cancelados
                            </label>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-2 mt-4">
                    <Button variant="ghost" size="sm" onClick={handleReset}>
                        Limpar
                    </Button>
                    <Button size="sm" onClick={handleApply}>
                        Aplicar Filtros
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
