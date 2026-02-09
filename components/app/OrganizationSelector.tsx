"use client";

import { useEffect, useState, useRef } from "react";
import { Check, X, Plus, ChevronsUpDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { searchOrganizationsAction } from "@/app/actions/sales/organization-actions";
import { getClientDetailsAction } from "@/app/actions/sales/sales-actions";
import { getTenantContextAction } from '@/app/actions/debug/tenant-context-actions';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/Command";
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

    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [options, setOptions] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedCompany, setSelectedCompany] = useState<any>(currentOrganization);

    const wrapperRef = useRef<HTMLDivElement>(null);

    // Fetch initial organization if value exists
    useEffect(() => {
        if (value && !selectedCompany) {
            const loadInitial = async () => {
                setLoading(true);
                try {
                    const res = await getClientDetailsAction(value);
                    if (res.success && res.data) {
                        setSelectedCompany(res.data);
                        setOptions([res.data]);
                    }
                } catch (e) {
                    console.error("Error loading initial org:", e);
                } finally {
                    setLoading(false);
                }
            };
            loadInitial();
        } else if (currentOrganization) {
            setSelectedCompany(currentOrganization);
            if (!options.find(o => o.id === currentOrganization.id)) {
                setOptions(prev => [currentOrganization, ...prev]);
            }
        }
    }, [value, currentOrganization]);

    // Fetch organizations based on search
    useEffect(() => {
        if (!open) return;

        if (search.length < 2) {
            setOptions([]);
            return;
        }

        if (selectedCompany && search === selectedCompany.trade_name) {
            return;
        }

        const fetchOrgs = async () => {
            setLoading(true);
            try {
                console.log(`[Search] Requesting: "${search}" Type: ${type}`);
                const res = await searchOrganizationsAction(search, type);

                if (res.success && res.data) {
                    setOptions(res.data);
                    console.log(`[Search] Result Count: ${res.data.length}`);
                } else {
                    setOptions([]);
                    console.error('[Search] Failed:', res.error);
                }
            } catch (error) {
                console.error("Error searching organizations:", error);
                setOptions([]);
            } finally {
                setLoading(false);
            }
        };

        const timer = setTimeout(fetchOrgs, 300);
        return () => clearTimeout(timer);
    }, [search, selectedCompany, type, open]);

    const handleSelect = (currentValue: string) => {
        const selected = options.find((framework) => framework.id === currentValue);
        console.log('handleSelect:', currentValue, selected);

        setSelectedCompany(selected);
        onChange(currentValue, selected);
        setOpen(false);
    };

    const handleClear = () => {
        setSelectedCompany(null);
        setSearch("");
        onChange("", undefined);
        setOptions([]);
    };

    const handleDebugTenant = async () => {
        console.log('[Debug] Fetching Tenant Context...');
        const res = await getTenantContextAction();
        console.log('[Debug] Tenant Context:', res);
        // Alert for visibility in manual testing
        if (typeof window !== 'undefined') {
            alert(`Tenant Debug:\nUser: ${res.data?.userId}\nCompany: ${res.data?.companyId}\nCustomers: ${res.data?.customersCount}\n\n(Full details in Console)`);
        }
    };

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
                {/* Debug Button - Controlled by Env Var or Dev Mode */}
                {(process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_ENABLE_TENANT_DEBUG === 'true') && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-4 w-4 p-0 text-muted-foreground hover:text-foreground"
                        onClick={handleDebugTenant}
                        title="Debug Tenant Context"
                        data-testid="debug-tenant-btn"
                    >
                        🐛
                    </Button>
                )}
            </div>

            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className={cn(
                            "w-full justify-between",
                            !selectedCompany && "text-muted-foreground",
                            error && "border-destructive",
                            disabled && "opacity-50 cursor-not-allowed",
                            className
                        )}
                        disabled={disabled}
                        data-testid="organization-selector-trigger"
                        id={`org-selector-${dataTestId}`}
                    >
                        {selectedCompany
                            ? selectedCompany.trade_name
                            : "Selecione organização..."}
                        <div className="flex items-center">
                            {selectedCompany && (
                                <X
                                    className="mr-2 h-4 w-4 shrink-0 opacity-50 hover:opacity-100 cursor-pointer"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleClear();
                                    }}
                                />
                            )}
                            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                        </div>
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command shouldFilter={false}>
                        <CommandInput
                            placeholder="Digite nome ou documento..."
                            value={search}
                            onValueChange={setSearch}
                        />
                        <CommandList>
                            <CommandEmpty>
                                {loading ? (
                                    <div className="flex items-center justify-center p-2" data-testid="org-selector-loading">
                                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                        Buscando...
                                    </div>
                                ) : (
                                    "Nenhum resultado encontrado."
                                )}
                            </CommandEmpty>
                            <CommandGroup>
                                {options.map((option: any) => (
                                    <CommandItem
                                        key={option.id}
                                        value={option.id}
                                        onSelect={handleSelect}
                                    >
                                        <Check
                                            className={cn(
                                                "mr-2 h-4 w-4",
                                                selectedCompany?.id === option.id ? "opacity-100" : "opacity-0"
                                            )}
                                        />
                                        <div className="flex flex-col">
                                            <span>{option.trade_name}</span>
                                            {option.document_number && (
                                                <span className="text-xs text-muted-foreground">{option.document_number}</span>
                                            )}
                                        </div>
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        </CommandList>
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
                    </Command>
                </PopoverContent>
            </Popover>
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
            {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
    );
}
