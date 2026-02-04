"use client";

import { Input } from "@/components/ui/Input";
import { Card, CardContent } from "@/components/ui/Card";
import { Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select-shadcn';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';

export function RouteHistoryFilters() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [search, setSearch] = useState(searchParams?.get("search") || "");
    const [period, setPeriod] = useState("all");

    // Sync period state with URL on mount if needed, but 'all' default is fine for now unless we parse URL back to period name
    // (Parsing back is complex because dates vary, so we just keep internal state 'all' or simple logic)

    useEffect(() => {
        const timer = setTimeout(() => {
            const currentSearch = searchParams?.get("search") || "";
            if (search === currentSearch) return;

            const params = new URLSearchParams(searchParams ? searchParams.toString() : "");
            if (search) {
                params.set("search", search);
            } else {
                params.delete("search");
            }
            router.push(`?${params.toString()}`);
        }, 500);
        return () => clearTimeout(timer);
    }, [search, router, searchParams]);

    const handlePeriodChange = (val: string) => {
        setPeriod(val);
        const params = new URLSearchParams(searchParams ? searchParams.toString() : "");
        const now = new Date();

        if (val === 'all') {
            params.delete('startDate');
            params.delete('endDate');
        } else if (val === 'today') {
            const s = format(now, 'yyyy-MM-dd');
            params.set('startDate', s);
            params.set('endDate', s);
        } else if (val === 'week') {
            const s = format(startOfWeek(now), 'yyyy-MM-dd');
            // Adjust end of week logic if needed, usually Saturday
            const e = format(endOfWeek(now), 'yyyy-MM-dd');
            params.set('startDate', s);
            params.set('endDate', e);
        } else if (val === 'month') {
            const s = format(startOfMonth(now), 'yyyy-MM-dd');
            const e = format(endOfMonth(now), 'yyyy-MM-dd');
            params.set('startDate', s);
            params.set('endDate', e);
        }

        router.push(`?${params.toString()}`);
    }

    return (
        <Card>
            <CardContent className="p-4 flex flex-col md:flex-row gap-4 items-center">
            <div className="relative w-full md:max-w-sm">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
                <Input
                    placeholder="Buscar por nome da rota..."
                    className="pl-9"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>
            <div className="w-full md:w-48">
                <Select value={period} onValueChange={handlePeriodChange}>
                    <SelectTrigger>
                        <SelectValue placeholder="Período" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todo o período</SelectItem>
                        <SelectItem value="today">Hoje</SelectItem>
                        <SelectItem value="week">Esta Semana</SelectItem>
                        <SelectItem value="month">Este Mês</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            </CardContent>
        </Card>
    );
}
