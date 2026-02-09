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
import { VehicleType, vehicleTypeLabels } from "@/lib/types/fleet";

interface FleetToolbarProps {
    search: string;
    onSearchChange: (value: string) => void;
    status: string;
    onStatusChange: (value: string) => void;
    type: string;
    onTypeChange: (value: string) => void;
}

export function FleetToolbar({
    search,
    onSearchChange,
    status,
    onStatusChange,
    type,
    onTypeChange,
}: FleetToolbarProps) {
    const hasFilters = search || status !== 'all' || type !== 'all';

    const clearFilters = () => {
        onSearchChange('');
        onStatusChange('all');
        onTypeChange('all');
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[300px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                        placeholder="Buscar por nome, modelo ou placa..."
                        value={search}
                        onChange={(e) => onSearchChange(e.target.value)}
                        className="pl-10 bg-gray-50/50 border-gray-100 focus:bg-white transition-all h-11 rounded-xl"
                    />
                </div>

                <Select value={status} onValueChange={onStatusChange}>
                    <SelectTrigger className="w-[180px] bg-gray-50/50 border-gray-100 h-11 rounded-xl">
                        <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todos os Status</SelectItem>
                        <SelectItem value="active">Ativos</SelectItem>
                        <SelectItem value="inactive">Inativos</SelectItem>
                    </SelectContent>
                </Select>

                <Select value={type} onValueChange={onTypeChange}>
                    <SelectTrigger className="w-[180px] bg-gray-50/50 border-gray-100 h-11 rounded-xl">
                        <SelectValue placeholder="Tipo" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todos os Tipos</SelectItem>
                        {Object.entries(vehicleTypeLabels).map(([val, label]) => (
                            <SelectItem key={val} value={val}>{label}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {hasFilters && (
                <div className="flex items-center gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
                    <span className="text-[10px] uppercase tracking-wider font-bold text-gray-400 mr-1 flex items-center gap-1">
                        <Filter className="w-3 h-3" /> Filtros:
                    </span>
                    <div className="flex flex-wrap gap-2">
                        {search && (
                            <Badge variant="secondary" className="bg-brand-50 text-brand-700 hover:bg-brand-100 border-none pl-2 pr-1 h-6 rounded-lg font-medium text-[11px]">
                                Busca: {search}
                                <button onClick={() => onSearchChange('')} className="ml-1 p-0.5 hover:bg-brand-200 rounded-md transition-colors">
                                    <X className="w-3 h-3" />
                                </button>
                            </Badge>
                        )}
                        {status !== 'all' && (
                            <Badge variant="secondary" className="bg-brand-50 text-brand-700 hover:bg-brand-100 border-none pl-2 pr-1 h-6 rounded-lg font-medium text-[11px]">
                                Status: {status === 'active' ? 'Ativos' : 'Inativos'}
                                <button onClick={() => onStatusChange('all')} className="ml-1 p-0.5 hover:bg-brand-200 rounded-md transition-colors">
                                    <X className="w-3 h-3" />
                                </button>
                            </Badge>
                        )}
                        {type !== 'all' && (
                            <Badge variant="secondary" className="bg-brand-50 text-brand-700 hover:bg-brand-100 border-none pl-2 pr-1 h-6 rounded-lg font-medium text-[11px]">
                                Tipo: {vehicleTypeLabels[type as VehicleType]}
                                <button onClick={() => onTypeChange('all')} className="ml-1 p-0.5 hover:bg-brand-200 rounded-md transition-colors">
                                    <X className="w-3 h-3" />
                                </button>
                            </Badge>
                        )}
                        <Button variant="ghost" size="sm" onClick={clearFilters} className="h-6 px-2 text-[10px] text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg uppercase tracking-tight font-bold">
                            Limpar Tudo
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
