"use client";

import { Input } from "@/components/ui/Input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Search, Filter, X } from "lucide-react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useState, useEffect } from "react";
import { RecurringRuleStatus, AmountType } from "@/types/recurring-rules";

export function RecurringRulesToolbar() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const [search, setSearch] = useState(searchParams.get("q") || "");

    const createQueryString = useCallback(
        (params: Record<string, string | null>) => {
            const newSearchParams = new URLSearchParams(searchParams.toString());
            for (const [key, value] of Object.entries(params)) {
                if (value === null || value === "ALL") {
                    newSearchParams.delete(key);
                } else {
                    newSearchParams.set(key, value);
                }
            }
            return newSearchParams.toString();
        },
        [searchParams]
    );

    const updateFilters = (params: Record<string, string | null>) => {
        router.push(`${pathname}?${createQueryString(params)}`);
    };

    // Debounced search
    useEffect(() => {
        const timer = setTimeout(() => {
            if (search !== (searchParams.get("q") || "")) {
                updateFilters({ q: search || null });
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [search]);

    const handleClear = () => {
        setSearch("");
        router.push(pathname);
    };

    return (
        <div className="px-6 pb-6 border-b border-gray-100 flex flex-col sm:flex-row gap-4 justify-between items-center">
            <div className="relative w-full sm:w-auto flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                    placeholder="Buscar por nome ou fornecedor..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 h-10 w-full bg-gray-50/50 border-gray-200 focus:bg-white transition-colors"
                />
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                <Select
                    value={searchParams.get("status") || "ALL"}
                    onValueChange={(val) => updateFilters({ status: val })}
                >
                    <SelectTrigger className="w-40 h-10 bg-white border-gray-200">
                        <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent align="end">
                        <SelectItem value="ALL">Todos Status</SelectItem>
                        <SelectItem value="ATIVO">Ativo</SelectItem>
                        <SelectItem value="ENCERRADO">Encerrado</SelectItem>
                        <SelectItem value="RASCUNHO">Rascunho</SelectItem>
                    </SelectContent>
                </Select>

                <Select
                    value={searchParams.get("type") || "ALL"}
                    onValueChange={(val) => updateFilters({ type: val })}
                >
                    <SelectTrigger className="w-40 h-10 bg-white border-gray-200">
                        <SelectValue placeholder="Tipo" />
                    </SelectTrigger>
                    <SelectContent align="end">
                        <SelectItem value="ALL">Todos Tipos</SelectItem>
                        <SelectItem value="FIXO">Fixo</SelectItem>
                        <SelectItem value="VARIAVEL">Variável</SelectItem>
                    </SelectContent>
                </Select>

                <Select
                    value={searchParams.get("sort") || "recent"}
                    onValueChange={(val) => updateFilters({ sort: val })}
                >
                    <SelectTrigger className="w-40 h-10 bg-white border-gray-200">
                        <SelectValue placeholder="Ordenar por" />
                    </SelectTrigger>
                    <SelectContent align="end">
                        <SelectItem value="recent">Mais recentes</SelectItem>
                        <SelectItem value="name_asc">Nome (A-Z)</SelectItem>
                    </SelectContent>
                </Select>

                {(searchParams.toString() !== "" || search !== "") && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleClear}
                        className="text-gray-500 hover:text-gray-700 h-10 px-3"
                    >
                        <X className="w-4 h-4 mr-2" /> Limpar
                    </Button>
                )}
            </div>
        </div>
    );
}
