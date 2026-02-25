
import * as React from "react"
import { Check, Plus, Settings, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/Button"
import { getFinancialCategoriesAction, FinancialCategory } from "@/app/actions/financial-categories"
import { Dialog, DialogTrigger } from "@/components/ui/Dialog"
import { FinancialCategoryManagerModal } from "./FinancialCategoryManagerModal"
import { Card } from "@/components/ui/Card"

interface FinancialCategorySelectorProps {
    value?: string; // ID
    onChange: (value: string | null) => void;
    className?: string;
    disabled?: boolean;
    companyId: string;
}

const PARENT_ACCOUNT_LABEL_FALLBACK: Record<string, string> = {
    "3.3": "Custos Indiretos de Fabricação (CIF)",
    "4.1": "Despesas Comerciais",
    "4.2": "Despesas Administrativas",
    "4.3": "Despesas Logísticas",
};

const compareByCode = (left?: string, right?: string): number => {
    const a = left ?? "";
    const b = right ?? "";
    return a.localeCompare(b, "pt-BR", { numeric: true, sensitivity: "base" });
};

const getParentCode = (category: FinancialCategory): string | null => {
    if (category.parent_account_code?.trim()) return category.parent_account_code.trim();
    const accountCode = category.account_code?.trim();
    if (!accountCode) return null;
    const parts = accountCode.split(".");
    if (parts.length < 2) return null;
    return `${parts[0]}.${parts[1]}`;
};

const getParentName = (category: FinancialCategory, parentCode: string | null): string => {
    if (category.parent_account_name?.trim()) return category.parent_account_name.trim();
    if (parentCode && PARENT_ACCOUNT_LABEL_FALLBACK[parentCode]) {
        return PARENT_ACCOUNT_LABEL_FALLBACK[parentCode];
    }
    return "Subcategoria não identificada";
};

const formatCategoryInputLabel = (category: FinancialCategory): string => {
    if (category.account_code?.trim()) return `${category.account_code.trim()} — ${category.name}`;
    return category.name;
};

type GroupedCategory = {
    key: string;
    parentCode: string | null;
    parentName: string;
    items: FinancialCategory[];
};

export function FinancialCategorySelector({ value, onChange, className, disabled, companyId }: FinancialCategorySelectorProps) {
    const [open, setOpen] = React.useState(false)
    const [categories, setCategories] = React.useState<FinancialCategory[]>([])
    const [searchValue, setSearchValue] = React.useState("")
    const [manageOpen, setManageOpen] = React.useState(false)
    const [prefillName, setPrefillName] = React.useState<string>("")
    const wrapperRef = React.useRef<HTMLDivElement>(null)

    // Fetch initial
    const fetchCategories = React.useCallback(async () => {
        if (!companyId) return;
        try {
            const result = await getFinancialCategoriesAction(companyId);
            if (result.data) {
                setCategories(result.data);
            } else if (result.error) {
                console.error(result.error);
            }
        } catch (e) {
            console.error(e);
        }
    }, [companyId]);

    React.useEffect(() => {
        void fetchCategories();
    }, [fetchCategories]);

    const handleOpenCreateModal = () => {
        if (!searchValue.trim()) return;
        setPrefillName(searchValue.trim());
        setManageOpen(true);
        setOpen(false);
    };

    const selectedCategory = categories.find((c) => c.id === value)
    const selectedInputLabel = React.useMemo(() => {
        if (!selectedCategory) return "";
        return formatCategoryInputLabel(selectedCategory);
    }, [selectedCategory]);

    const handleSelect = (category: FinancialCategory) => {
        if (category.id === value) {
            onChange(null);
            setSearchValue("");
        } else {
            onChange(category.id);
            setSearchValue(formatCategoryInputLabel(category));
        }
        setOpen(false)
    }

    const handleClear = () => {
        onChange(null);
        setSearchValue("");
        setOpen(false);
    };

    React.useEffect(() => {
        // Keep input text in sync when value changes externally.
        if (selectedCategory && searchValue !== selectedInputLabel) {
            setSearchValue(selectedInputLabel);
        }
        if (!value && searchValue && selectedCategory?.id !== value) {
            // leave user typed text as-is
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value, selectedCategory?.id, selectedInputLabel]);

    React.useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const normalizedQuery = searchValue.trim().toLowerCase();
    const filtered = React.useMemo(() => {
        if (!normalizedQuery) return categories;
        return categories.filter((c) => {
            const parentCode = getParentCode(c);
            const parentName = getParentName(c, parentCode);
            const hay = `${c.account_code ?? ""} ${c.name} ${parentCode ?? ""} ${parentName}`.toLowerCase();
            return hay.includes(normalizedQuery);
        });
    }, [categories, normalizedQuery]);

    const groupedCategories = React.useMemo((): GroupedCategory[] => {
        const grouped = new Map<string, GroupedCategory>();

        for (const category of filtered) {
            const parentCode = getParentCode(category);
            const parentName = getParentName(category, parentCode);
            const key = `${parentCode ?? "sem-grupo"}::${parentName}`;
            const current = grouped.get(key);
            if (current) {
                current.items.push(category);
                continue;
            }
            grouped.set(key, {
                key,
                parentCode,
                parentName,
                items: [category],
            });
        }

        return Array.from(grouped.values())
            .sort((left, right) => {
                if (!left.parentCode && !right.parentCode) return left.parentName.localeCompare(right.parentName, "pt-BR");
                if (!left.parentCode) return 1;
                if (!right.parentCode) return -1;
                return compareByCode(left.parentCode, right.parentCode);
            })
            .map((group) => ({
                ...group,
                items: [...group.items].sort((left, right) => {
                    const byAccountCode = compareByCode(left.account_code, right.account_code);
                    if (byAccountCode !== 0) return byAccountCode;
                    return left.name.localeCompare(right.name, "pt-BR", { sensitivity: "base" });
                }),
            }));
    }, [filtered]);

    return (
        <div className={cn("flex items-center gap-2 w-full", className)} ref={wrapperRef}>
            <div className="relative w-full">
                <input
                    type="text"
                    value={searchValue}
                    disabled={disabled}
                    placeholder="Selecione..."
                    onFocus={(event) => {
                        if (disabled) return;
                        setOpen(true);
                        event.currentTarget.select();
                    }}
                    onChange={(e) => {
                        const next = e.target.value;
                        setSearchValue(next);
                        setOpen(true);
                        // if user edits text, clear current selection to avoid inconsistency
                        if (selectedCategory && next !== selectedInputLabel) {
                            onChange(null);
                        }
                    }}
                    className={cn(
                        "flex h-10 w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm ring-offset-background placeholder:text-gray-400",
                        "focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500",
                        "disabled:cursor-not-allowed disabled:opacity-50",
                        selectedCategory && "pr-8"
                    )}
                />

                {selectedCategory && !disabled && (
                    <button
                        type="button"
                        onClick={handleClear}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded-2xl transition-colors"
                        title="Limpar"
                    >
                        <X className="h-4 w-4 text-gray-400" />
                    </button>
                )}

                {open && (
                    <Card className="absolute left-0 top-full z-[70] mt-1 w-full overflow-hidden rounded-2xl border border-gray-100 bg-white p-0 shadow-float">
                        <div className="flex items-center border-b px-3 py-2">
                            <span className="text-xs text-gray-500">Buscar categoria...</span>
                        </div>

                        <div className="max-h-60 overflow-y-auto py-1">
                            {filtered.length === 0 ? (
                                <div className="p-2 text-sm text-center">
                                    <p className="mb-2 text-gray-500">Nenhuma categoria encontrada.</p>
                                    {searchValue.trim() && (
                                        <>
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                className="w-full"
                                                onClick={handleOpenCreateModal}
                                            >
                                                <Plus className="w-3 h-3 mr-1" />
                                                Criar categoria
                                            </Button>
                                            <p className="mt-2 text-[11px] text-gray-400">
                                                Para criar, selecione a subcategoria no Plano de Contas.
                                            </p>
                                        </>
                                    )}
                                </div>
                            ) : (
                                <>
                                    {groupedCategories.map((group) => (
                                        <div key={group.key} className="py-1">
                                            <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                                                {group.parentCode ? `${group.parentCode} · ${group.parentName}` : group.parentName}
                                            </div>
                                            {group.items.map((cat) => {
                                                const parentCode = getParentCode(cat);
                                                const parentName = getParentName(cat, parentCode);
                                                return (
                                                    <button
                                                        key={cat.id}
                                                        type="button"
                                                        onMouseDown={(e) => e.preventDefault()}
                                                        onClick={() => handleSelect(cat)}
                                                        className={cn(
                                                            "w-full text-left px-3 py-2 text-sm flex items-start gap-2 hover:bg-gray-50",
                                                            value === cat.id && "bg-gray-50"
                                                        )}
                                                    >
                                                        <Check className={cn("mt-0.5 h-4 w-4 shrink-0", value === cat.id ? "opacity-100" : "opacity-0")} />
                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex min-w-0 items-center gap-2">
                                                                <span className="font-mono text-[11px] text-gray-500 shrink-0">{cat.account_code ?? "—"}</span>
                                                                <span className="truncate text-gray-900">{cat.name}</span>
                                                            </div>
                                                            <p className="mt-0.5 truncate text-xs text-gray-500">
                                                                {parentCode ? `${parentCode} · ${parentName}` : parentName}
                                                            </p>
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    ))}
                                </>
                            )}
                        </div>
                    </Card>
                )}
            </div>

            <Dialog open={manageOpen} onOpenChange={setManageOpen}>
                <DialogTrigger asChild>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 shrink-0"
                        title="Gerenciar Categorias"
                        disabled={disabled}
                    >
                        <Settings className="h-4 w-4 text-gray-500" />
                    </Button>
                </DialogTrigger>
                <FinancialCategoryManagerModal
                    companyId={companyId}
                    onChange={fetchCategories}
                    prefillName={prefillName}
                    onCreated={(categoryId) => {
                        onChange(categoryId);
                        setManageOpen(false);
                        setSearchValue("");
                        setPrefillName("");
                    }}
                />
            </Dialog>
        </div >
    )
}
