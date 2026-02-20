"use client";

import { Input } from "@/components/ui/Input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/Select";
import { Search, X, Filter } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

interface TrafficFinesToolbarProps {
    search: string;
    onSearchChange: (value: string) => void;
    deductedStatus: string;
    onDeductedStatusChange: (value: string) => void;
    startDate: string;
    onStartDateChange: (value: string) => void;
    endDate: string;
    onEndDateChange: (value: string) => void;
}

export function TrafficFinesToolbar({
    search,
    onSearchChange,
    deductedStatus,
    onDeductedStatusChange,
    startDate,
    onStartDateChange,
    endDate,
    onEndDateChange,
}: TrafficFinesToolbarProps) {
    const hasFilters = search || deductedStatus !== 'all' || startDate || endDate;

    const clearFilters = () => {
        onSearchChange('');
        onDeductedStatusChange('all');
        onStartDateChange('');
        onEndDateChange('');
    };

    const deductedStatusLabels = {
        all: 'Todos',
        deducted: 'Descontado',
        not_deducted: 'Não Descontado'
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                        placeholder="Buscar cidade, motivo ou motorista..."
                        value={search}
                        onChange={(e) => onSearchChange(e.target.value)}
                        className="pl-10 bg-gray-50/50 border-gray-100 focus:bg-white transition-all h-11 rounded-2xl"
                    />
                </div>

                <Select value={deductedStatus} onValueChange={onDeductedStatusChange}>
                    <SelectTrigger className="w-44 bg-gray-50/50 border-gray-100 h-11 rounded-2xl">
                        <SelectValue placeholder="Status Desconto" />
                    </SelectTrigger>
                    <SelectContent>
                        {Object.entries(deductedStatusLabels).map(([val, label]) => (
                            <SelectItem key={val} value={val}>{label}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => onStartDateChange(e.target.value)}
                    className="w-40 bg-gray-50/50 border-gray-100 h-11 rounded-2xl"
                    placeholder="Data início"
                />

                <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => onEndDateChange(e.target.value)}
                    className="w-40 bg-gray-50/50 border-gray-100 h-11 rounded-2xl"
                    placeholder="Data fim"
                />
            </div>

            {hasFilters && (
                <div className="flex items-center gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
                    <span className="text-[10px] uppercase tracking-wider font-bold text-gray-400 mr-1 flex items-center gap-1">
                        <Filter className="w-3 h-3" /> Filtros:
                    </span>
                    <div className="flex flex-wrap gap-2">
                        {search && (
                            <Badge variant="secondary" className="bg-brand-50 text-brand-700 hover:bg-brand-100 border-none pl-2 pr-1 h-6 rounded-2xl font-medium text-[11px]">
                                Busca: {search}
                                <button onClick={() => onSearchChange('')} className="ml-1 p-0.5 hover:bg-brand-200 rounded-full transition-colors">
                                    <X className="w-3 h-3" />
                                </button>
                            </Badge>
                        )}
                        {deductedStatus !== 'all' && (
                            <Badge variant="secondary" className="bg-brand-50 text-brand-700 hover:bg-brand-100 border-none pl-2 pr-1 h-6 rounded-2xl font-medium text-[11px]">
                                Status: {deductedStatusLabels[deductedStatus as keyof typeof deductedStatusLabels]}
                                <button onClick={() => onDeductedStatusChange('all')} className="ml-1 p-0.5 hover:bg-brand-200 rounded-full transition-colors">
                                    <X className="w-3 h-3" />
                                </button>
                            </Badge>
                        )}
                        {startDate && (
                            <Badge variant="secondary" className="bg-brand-50 text-brand-700 hover:bg-brand-100 border-none pl-2 pr-1 h-6 rounded-2xl font-medium text-[11px]">
                                De: {new Date(startDate).toLocaleDateString('pt-BR')}
                                <button onClick={() => onStartDateChange('')} className="ml-1 p-0.5 hover:bg-brand-200 rounded-full transition-colors">
                                    <X className="w-3 h-3" />
                                </button>
                            </Badge>
                        )}
                        {endDate && (
                            <Badge variant="secondary" className="bg-brand-50 text-brand-700 hover:bg-brand-100 border-none pl-2 pr-1 h-6 rounded-2xl font-medium text-[11px]">
                                Até: {new Date(endDate).toLocaleDateString('pt-BR')}
                                <button onClick={() => onEndDateChange('')} className="ml-1 p-0.5 hover:bg-brand-200 rounded-full transition-colors">
                                    <X className="w-3 h-3" />
                                </button>
                            </Badge>
                        )}
                        <Button variant="ghost" size="sm" onClick={clearFilters} className="h-6 px-2 text-[10px] text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-2xl uppercase tracking-tight font-bold">
                            Limpar Tudo
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
