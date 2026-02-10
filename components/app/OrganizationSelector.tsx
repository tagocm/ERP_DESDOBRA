"use client";

import { useEffect, useState, useRef } from "react";
import { Check, X, Plus, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { searchOrganizationsAction } from "@/app/actions/sales/organization-actions";
import { getClientDetailsAction } from "@/app/actions/sales/sales-actions";
import { Label } from "@/components/ui/Label";

interface OrganizationSelectorProps {
    value?: string;
    onChange: (value: string, org?: any) => void;
    currentOrganization?: any;
    type?: 'customer' | 'supplier' | 'carrier' | 'all';
    label?: string;
    disabled?: boolean;
    error?: string;
    description?: string;
    onCreateNew?: () => void;
    className?: string;
    required?: boolean;
    "data-testid"?: string;
}

export function OrganizationSelector({
    value,
    onChange,
    currentOrganization,
    type = 'all',
    label,
    disabled = false,
    error,
    description,
    onCreateNew,
    className,
    required = false,
    "data-testid": dataTestId
}: OrganizationSelectorProps) {
    const entityLabel =
        type === 'customer'
            ? 'cliente'
            : type === 'supplier'
                ? 'fornecedor'
                : type === 'carrier'
                    ? 'transportadora'
                    : 'organização';

    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [options, setOptions] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedCompany, setSelectedCompany] = useState<any>(currentOrganization);
    const searchRequestRef = useRef(0);
    const searchCacheRef = useRef<Map<string, { ts: number; data: any[] }>>(new Map());

    const wrapperRef = useRef<HTMLDivElement>(null);

    // Fetch initial organization if value exists
    useEffect(() => {
        if (value && (!selectedCompany || selectedCompany.id !== value)) {
            const loadInitial = async () => {
                setLoading(true);
                try {
                    const res = await getClientDetailsAction(value);
                    if (res && !res.error) {
                        setSelectedCompany(res);
                        setSearch(res.trade_name || "");
                        setOptions(prev => (prev.some(option => option.id === res.id) ? prev : [res, ...prev]));
                    }
                } catch (e) {
                    console.error("Error loading initial org:", e);
                } finally {
                    setLoading(false);
                }
            };
            loadInitial();
        } else if (
            currentOrganization &&
            (
                !selectedCompany ||
                selectedCompany.id !== currentOrganization.id ||
                selectedCompany.trade_name !== currentOrganization.trade_name
            )
        ) {
            setSelectedCompany(currentOrganization);
            setSearch(currentOrganization.trade_name || "");
            setOptions(prev => (prev.some(o => o.id === currentOrganization.id) ? prev : [currentOrganization, ...prev]));
        }
    }, [value, currentOrganization, selectedCompany]);

    // Fetch organizations based on search
    useEffect(() => {
        if (selectedCompany && search === selectedCompany.trade_name) {
            setOpen(false);
            return;
        }

        if (search.length < 2) {
            setOptions([]);
            setOpen(false);
            return;
        }

        const requestId = ++searchRequestRef.current;
        const normalizedQuery = search.trim().toLowerCase();
        const cacheKey = `${type}:${normalizedQuery}`;
        const cached = searchCacheRef.current.get(cacheKey);
        const now = Date.now();

        if (cached && now - cached.ts < 5 * 60 * 1000) {
            setOptions(cached.data);
            setOpen(true);
            setLoading(false);
            return;
        }

        const fetchOrgs = async () => {
            setLoading(true);
            try {
                const res = await searchOrganizationsAction(search, type);
                if (requestId !== searchRequestRef.current) return;

                if (res.success && res.data) {
                    setOptions(res.data);
                    searchCacheRef.current.set(cacheKey, { ts: Date.now(), data: res.data });
                    setOpen(true);
                } else {
                    setOptions([]);
                    searchCacheRef.current.set(cacheKey, { ts: Date.now(), data: [] });
                    setOpen(true);
                }
            } catch (error) {
                console.error("Error searching organizations:", error);
                if (requestId !== searchRequestRef.current) return;
                setOptions([]);
                setOpen(true);
            } finally {
                if (requestId !== searchRequestRef.current) return;
                setLoading(false);
            }
        };

        const timer = setTimeout(fetchOrgs, 180);
        return () => {
            clearTimeout(timer);
        };
    }, [search, type, selectedCompany]);

    const handleSelect = (currentValue: string) => {
        const selected = options.find((framework) => framework.id === currentValue);
        if (!selected) return;

        setSelectedCompany(selected);
        setSearch(selected?.trade_name || "");
        onChange(currentValue, selected);
        setOpen(false);
    };

    const handleClear = () => {
        setSelectedCompany(null);
        setSearch("");
        onChange("", undefined);
        setOptions([]);
        setOpen(false);
    };

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <div className={cn("flex flex-col gap-2", className)} ref={wrapperRef} data-testid={dataTestId}>
            <div className="flex items-center gap-2">
                {label && (
                    <Label
                        className={cn(error && "text-destructive", required && "after:content-['*'] after:ml-0.5 after:text-destructive")}
                        htmlFor={`org-selector-${dataTestId}`}
                    >
                        {label}
                    </Label>
                )}
            </div>

            <div className="relative">
                <input
                    id={`org-selector-${dataTestId}`}
                    data-testid="organization-selector-trigger"
                    type="text"
                    value={search}
                    disabled={disabled}
                    placeholder={`Selecione ${entityLabel}...`}
                    onFocus={() => {
                        if (search.length >= 2) setOpen(true);
                    }}
                    onChange={(e) => {
                        const nextSearch = e.target.value;
                        setSearch(nextSearch);
                        if (selectedCompany && nextSearch !== selectedCompany.trade_name) {
                            setSelectedCompany(null);
                        }
                    }}
                    className={cn(
                        "flex h-10 w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm ring-offset-background placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 disabled:cursor-not-allowed disabled:opacity-50",
                        selectedCompany && "pr-8",
                        error && "border-destructive",
                        className
                    )}
                />
                {selectedCompany && !disabled && (
                    <button
                        type="button"
                        onClick={handleClear}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded-2xl transition-colors"
                    >
                        <X className="h-4 w-4 text-gray-400" />
                    </button>
                )}
            </div>

            {open && (
                <div className="absolute left-0 top-full z-[70] mt-1 max-h-60 w-full overflow-auto rounded-2xl border border-gray-100 bg-white py-1 text-base shadow-float focus:outline-none sm:text-sm">
                    {loading && (
                        <div className="py-6 text-center text-xs text-gray-500 flex flex-col items-center gap-2" data-testid="org-selector-loading">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Buscando...
                        </div>
                    )}

                    {!loading && options.length === 0 && (
                        <div className="py-6 text-center text-sm text-gray-500">
                            {search.length < 2
                                ? "Digite pelo menos 2 caracteres para buscar..."
                                : "Nenhum resultado encontrado."}
                        </div>
                    )}

                    {!loading && options.map((option: any) => (
                        <button
                            key={option.id}
                            type="button"
                            className={cn(
                                "w-full text-left relative cursor-pointer select-none py-2.5 px-3 hover:bg-gray-50 flex items-center justify-between transition-colors",
                                selectedCompany?.id === option.id ? "bg-brand-50 text-brand-700 font-medium" : "text-gray-700"
                            )}
                            onClick={() => handleSelect(option.id)}
                        >
                            <div className="flex flex-col overflow-hidden flex-1">
                                <span className="truncate font-medium text-sm">{option.trade_name}</span>
                                {option.document_number && (
                                    <span className="text-xs text-gray-400">{option.document_number}</span>
                                )}
                            </div>
                            {selectedCompany?.id === option.id && (
                                <Check className="h-4 w-4 text-brand-600 ml-2" />
                            )}
                        </button>
                    ))}

                    <div className="border-t border-gray-100 p-2">
                        <Button
                            size="sm"
                            variant="ghost"
                            className="w-full justify-start h-8 text-xs"
                            onClick={() => {
                                if (onCreateNew) onCreateNew();
                                else console.log('Create new clicked logic missing');
                            }}
                        >
                            <Plus className="w-3 h-3 mr-2" />
                            {type === 'supplier' ? 'Novo Fornecedor' :
                                type === 'carrier' ? 'Nova Transportadora' :
                                    'Novo Cliente'}
                        </Button>
                    </div>
                </div>
            )}
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
            {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
    );
}
