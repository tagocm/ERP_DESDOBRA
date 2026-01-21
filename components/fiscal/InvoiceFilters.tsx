'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent } from '@/components/ui/Card';
import { Search, X, Filter } from 'lucide-react';
import { DateRangeFilter } from '@/components/ui/date-range-filter';
import { DateRange } from 'react-day-picker';
import { parseISO, format } from 'date-fns';

interface Props {
    filters: {
        dateFrom?: string;
        dateTo?: string;
        clientSearch?: string;
    };
    onFilterChange: (filters: any) => void;
    companyId: string;
}

export function InvoiceFilters({ filters, onFilterChange, companyId }: Props) {
    const [localFilters, setLocalFilters] = useState(filters);
    const [isOpen, setIsOpen] = useState(true);

    const handleChange = (key: string, value: string | undefined) => {
        setLocalFilters(prev => ({ ...prev, [key]: value }));
    };

    const handleDateRangeChange = (range: DateRange | undefined) => {
        setLocalFilters(prev => ({
            ...prev,
            dateFrom: range?.from ? format(range.from, 'yyyy-MM-dd') : undefined,
            dateTo: range?.to ? format(range.to, 'yyyy-MM-dd') : undefined
        }));
    };

    const handleApply = () => {
        onFilterChange(localFilters);
    };

    const handleClear = () => {
        const empty = {};
        setLocalFilters(empty);
        onFilterChange(empty);
    };

    // Calculate current DateRange for the filter component
    const dateRange: DateRange | undefined = localFilters.dateFrom ? {
        from: parseISO(localFilters.dateFrom),
        to: localFilters.dateTo ? parseISO(localFilters.dateTo) : undefined
    } : undefined;

    if (!isOpen) {
        return (
            <Button variant="outline" onClick={() => setIsOpen(true)} className="mb-6">
                <Filter className="w-4 h-4 mr-2" />
                Filtros
            </Button>
        );
    }

    return (
        <Card className="mb-6">
            <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {/* Date Range - Spans 1 column */}
                    <div className="md:col-span-1 space-y-1">
                        <label className="text-sm font-medium text-gray-700">
                            Período
                        </label>
                        <div className="w-full">
                            <DateRangeFilter
                                date={dateRange}
                                onDateChange={handleDateRangeChange}
                                placeholder="Selecione o período..."
                                className="w-full"
                            />
                        </div>
                    </div>

                    {/* Client Search - Spans 3 columns to fill row */}
                    <div className="md:col-span-3 space-y-1">
                        <label className="text-sm font-medium text-gray-700">
                            Cliente
                        </label>
                        <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                            <Input
                                type="text"
                                placeholder="Nome ou CNPJ..."
                                value={localFilters.clientSearch || ''}
                                onChange={(e) => handleChange('clientSearch', e.target.value)}
                                className="pl-9 border-gray-200"
                            />
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-2 mt-4">
                    <Button onClick={handleClear} variant="ghost">
                        Limpar
                    </Button>
                    <Button onClick={handleApply}>
                        Aplicar Filtros
                    </Button>
                </div>
            </CardContent>
        </Card >
    );
}
