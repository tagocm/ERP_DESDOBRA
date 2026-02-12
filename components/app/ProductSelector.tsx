"use client";

import { useEffect, useState, useRef, forwardRef, useMemo } from "react";
import { Check, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabaseBrowser";
import { useCompany } from "@/contexts/CompanyContext";
import { searchSalesProductsAction } from "@/app/actions/sales/sales-actions";

interface ProductSelectorProps {
    value?: string;
    onChange: (product: any) => void;
    companyId?: string;
    className?: string;
    disabled?: boolean;
    "data-testid"?: string;
}

export const ProductSelector = forwardRef<HTMLInputElement, ProductSelectorProps>(({ value, onChange, companyId, className, disabled, "data-testid": dataTestId }, ref) => {
    const { selectedCompany } = useCompany();
    const supabase = useMemo(() => createClient(), []);
    const activeCompanyId = companyId || selectedCompany?.id;

    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [options, setOptions] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState<any>(null);

    const wrapperRef = useRef<HTMLDivElement>(null);
    const internalInputRef = useRef<HTMLInputElement>(null);

    // Sync forwarded ref with internal ref
    useEffect(() => {
        if (ref) {
            if (typeof ref === 'function') {
                ref(internalInputRef.current);
            } else {
                ref.current = internalInputRef.current;
            }
        }
    }, [ref]);

    // Fetch initial product if value exists
    useEffect(() => {
        if (!value) return;
        if (selectedProduct?.id === value) return;
        if (!activeCompanyId) return;
        const fetchProduct = async () => {
            const { data } = await supabase
                .from('items')
                .select('id, name, sku, uom, sale_price, net_weight_kg_base, gross_weight_kg_base')
                .eq('company_id', activeCompanyId)
                .eq('id', value)
                .single();
            if (data) {
                setSelectedProduct({ ...data, un: data.uom, price: Number(data.sale_price || 0) });
                setSearch(data.name);
            }
        };
        fetchProduct();
    }, [value, supabase, selectedProduct, activeCompanyId]);

    // Handle external clearing
    useEffect(() => {
        if (!value && selectedProduct) {
            setSelectedProduct(null);
            setSearch("");
        }
    }, [value, selectedProduct]);

    // Fetch products based on search (LAZY LOADING)
    useEffect(() => {
        if (!activeCompanyId) {
            setOptions([]);
            setOpen(false);
            return;
        }

        if (selectedProduct && search === selectedProduct.name) {
            setOpen(false);
            return;
        }

        // LAZY LOADING: Only fetch if user has typed at least 2 characters
        if (search.length < 2) {
            setOptions([]);
            setLoading(false);
            setOpen(false); // Close dropdown when search is too short
            return;
        }

        let cancelled = false;
        setOpen(true); // keep immediate feedback while searching
        setLoading(true);

        const fetchProducts = async () => {
            try {
                const data = await searchSalesProductsAction({
                    term: search,
                    companyId: activeCompanyId,
                    limit: 20
                });
                if (cancelled) return;
                setOptions(data ? data.map((d: any) => ({ ...d, un: d.uom, price: Number(d.sale_price || 0) })) : []);
            } catch (error) {
                if (cancelled) return;
                console.error("[ProductSelector] search error:", error);
                setOptions([]);
            } finally {
                if (cancelled) return;
                setLoading(false);
            }
        };

        // Debounce: keep low to improve perceived performance.
        const timer = setTimeout(fetchProducts, 120);
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [search, activeCompanyId, supabase, selectedProduct]);

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
        setSelectedProduct(option);
        setSearch(option.name);
        onChange(option);
        setOpen(false);
    };

    const handleClear = () => {
        setSelectedProduct(null);
        setSearch("");
        onChange(null);
        setOptions([]);
        internalInputRef.current?.focus();
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value;
        setSearch(newValue);

        // If user clears the field or changes it, clear selection
        if (selectedProduct && newValue !== selectedProduct.name) {
            setSelectedProduct(null);
            onChange(null);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Tab' && options.length === 1) {
            e.preventDefault();
            handleSelect(options[0]);
        }
    };

    return (
        <div className={cn("relative", className)} ref={wrapperRef}>
            <div className="relative">
                <input
                    ref={internalInputRef}
                    onKeyDown={handleKeyDown}
                    data-testid={dataTestId}
                    type="text"
                    className={cn(
                        "flex h-9 w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm ring-offset-background placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 disabled:cursor-not-allowed disabled:opacity-50",
                        selectedProduct && "pr-8"
                    )}
                    placeholder="Digite nome ou SKU..."
                    value={search}
                    onChange={handleInputChange}
                    onFocus={() => {
                        if (search.trim().length >= 2 || options.length > 0) {
                            setOpen(true);
                        }
                    }}
                    disabled={disabled}
                />
                {selectedProduct && !disabled && (
                    <button
                        type="button"
                        onClick={handleClear}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded-2xl transition-colors"
                        disabled={disabled}
                    >
                        <X className="h-4 w-4 text-gray-400" />
                    </button>
                )}
            </div>

            {open && (
                <div
                    role="listbox"
                    className="absolute z-50 mt-1 max-h-60 w-full min-w-72 overflow-auto rounded-2xl border border-gray-100 bg-white py-1 text-base shadow-float focus:outline-none sm:text-sm"
                >
                    {loading && (
                        <div className="py-6 text-center text-xs text-gray-500 flex flex-col items-center gap-2" data-testid="product-selector-loading">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Buscando...
                        </div>
                    )}

                    {!loading && options.length === 0 && (
                        <div className="py-6 text-center text-sm text-gray-500">
                            {search.length === 0
                                ? "Digite pelo menos 2 caracteres para buscar..."
                                : search.length < 2
                                    ? "Digite mais 1 caractere para buscar..."
                                    : "Nenhum produto encontrado."}
                        </div>
                    )}

                    {!loading && options.map((option) => (
                        <button
                            key={option.id}
                            type="button"
                            role="option"
                            aria-selected={selectedProduct?.id === option.id}
                            className={cn(
                                "w-full text-left relative cursor-pointer select-none py-2.5 px-3 hover:bg-gray-50 flex items-center justify-between transition-colors",
                                selectedProduct?.id === option.id ? "bg-brand-50 text-brand-700 font-medium" : "text-gray-700"
                            )}
                            onMouseDown={(event) => {
                                event.preventDefault();
                                handleSelect(option);
                            }}
                        >
                            <div className="flex flex-col overflow-hidden flex-1">
                                <span className="truncate font-medium text-sm">{option.name}</span>
                                <span className="text-xs text-gray-400 font-mono">{option.sku}</span>
                            </div>
                            <div className="flex items-center gap-2 ml-4">
                                {option.price && (
                                    <span className="text-xs font-semibold text-gray-900 bg-gray-100 px-1.5 py-0.5 rounded whitespace-nowrap">
                                        R$ {Number(option.price).toFixed(2)}
                                    </span>
                                )}
                                {selectedProduct?.id === option.id && (
                                    <Check className="h-4 w-4 text-brand-600" />
                                )}
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
});
ProductSelector.displayName = "ProductSelector";
