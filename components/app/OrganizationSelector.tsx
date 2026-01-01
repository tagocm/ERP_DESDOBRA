"use client";

import { useEffect, useState, useRef } from "react";
import { Check, X, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabaseBrowser";
import { useCompany } from "@/contexts/CompanyContext";

interface OrganizationSelectorProps {
    value?: string;
    onChange: (org: any) => void;
    type?: 'customer' | 'supplier' | 'carrier' | 'all';
    disabled?: boolean;
}

export function OrganizationSelector({ value, onChange, type = 'all', disabled }: OrganizationSelectorProps) {
    const { selectedCompany } = useCompany();
    const supabase = createClient();

    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [options, setOptions] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedOrg, setSelectedOrg] = useState<any>(null);

    const wrapperRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Fetch initial organization if value exists
    useEffect(() => {
        if (!value || selectedOrg) return;
        const fetchOrg = async () => {
            const { data } = await supabase
                .from('organizations')
                .select('id, trade_name, document, document_number')
                .eq('id', value)
                .single();
            if (data) {
                setSelectedOrg(data);
                setSearch(data.trade_name);
            }
        };
        fetchOrg();
    }, [value, supabase, selectedOrg]);

    // Fetch organizations based on search
    useEffect(() => {
        if (!selectedCompany || search.length < 2) {
            setOptions([]);
            return;
        }

        // Avoid re-fetching/opening if the search matches the currently selected item exactly
        if (selectedOrg && search === selectedOrg.trade_name) {
            return;
        }

        const fetchOrgs = async () => {
            setLoading(true);
            try {
                // Remove all non-digit characters for number comparison
                const cleanSearch = search.replace(/[^\d]/g, '');
                const isNumericSearch = cleanSearch.length >= 2;

                // Fetch organizations - get more if doing numeric search for client-side filtering
                const { data } = await supabase
                    .from('organizations')
                    .select('id, trade_name, document, document_number')
                    .eq('company_id', selectedCompany.id)
                    .limit(isNumericSearch ? 100 : 20);



                let filteredData = data || [];

                // Filter results
                filteredData = filteredData.filter(org => {
                    // Check name match
                    const nameMatch = org.trade_name?.toLowerCase().includes(search.toLowerCase());

                    // Check document match (search in both formatted and unformatted fields)
                    if (isNumericSearch) {
                        const cleanDoc = (org.document || '').replace(/[^\d]/g, '');
                        const cleanDocNumber = (org.document_number || '');
                        const docMatch = cleanDoc.includes(cleanSearch) || cleanDocNumber.includes(cleanSearch);
                        return nameMatch || docMatch;
                    }

                    return nameMatch;
                }).slice(0, 20); // Limit to 20 results

                setOptions(filteredData);
                setOpen(true);
            } finally {
                setLoading(false);
            }
        };

        const timer = setTimeout(fetchOrgs, 300);
        return () => clearTimeout(timer);
    }, [search, selectedCompany, supabase]);

    // Close on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleSelect = (option: any) => {
        setSelectedOrg(option);
        setSearch(option.trade_name);
        onChange(option);
        setOpen(false);
        inputRef.current?.blur();
    };

    const handleClear = () => {
        setSelectedOrg(null);
        setSearch("");
        onChange(null);
        setOptions([]);
        inputRef.current?.focus();
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value;
        setSearch(newValue);

        // If user clears the field or changes it, clear selection
        if (selectedOrg && newValue !== selectedOrg.trade_name) {
            setSelectedOrg(null);
            onChange(null);
        }
    };

    return (
        <div className="relative" ref={wrapperRef}>
            <div className="relative">
                <input
                    ref={inputRef}
                    type="text"
                    className={cn(
                        "flex h-10 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm ring-offset-background placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 disabled:cursor-not-allowed disabled:opacity-50",
                        selectedOrg && "pr-8"
                    )}
                    placeholder="Digite nome ou documento..."
                    value={search}
                    onChange={handleInputChange}
                    disabled={disabled}
                    onFocus={() => {
                        if (search.length >= 2) setOpen(true);
                    }}
                />
                {selectedOrg && !disabled && (
                    <button
                        type="button"
                        onClick={handleClear}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded-md transition-colors"
                        disabled={disabled}
                    >
                        <X className="h-4 w-4 text-gray-400" />
                    </button>
                )}
            </div>

            {open && (search.length >= 2 || options.length > 0) && (
                <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-gray-100 bg-white py-1 text-base shadow-xl focus:outline-none sm:text-sm">
                    {loading && (
                        <div className="p-3 text-center text-xs text-gray-400">
                            Buscando...
                        </div>
                    )}

                    {!loading && options.length === 0 && search.length >= 2 && (
                        <div className="p-3 text-center text-xs text-gray-500">
                            Nenhum resultado encontrado.
                        </div>
                    )}

                    {!loading && options.map((option) => (
                        <div
                            key={option.id}
                            className={cn(
                                "relative cursor-pointer select-none py-2.5 pl-3 pr-9 hover:bg-gray-50 transition-colors",
                                selectedOrg?.id === option.id ? "bg-brand-50 font-medium text-brand-700" : "text-gray-900"
                            )}
                            onClick={() => handleSelect(option)}
                        >
                            <div className="flex flex-col">
                                <span className="block truncate">{option.trade_name}</span>
                                {option.document && (
                                    <span className="text-xs text-gray-400">{option.document}</span>
                                )}
                            </div>
                            {selectedOrg?.id === option.id && (
                                <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-brand-600">
                                    <Check className="h-4 w-4" />
                                </span>
                            )}
                        </div>
                    ))}

                    <div className="border-t border-gray-100 p-2">
                        <Button
                            size="sm"
                            variant="secondary"
                            className="w-full justify-start h-8 text-xs"
                            onClick={() => {
                                // TODO: Open new client modal
                                console.log('Open new client modal');
                            }}
                        >
                            <Plus className="w-3 h-3 mr-2" />
                            Novo Cliente
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
