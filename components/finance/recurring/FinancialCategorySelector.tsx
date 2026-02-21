
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

export function FinancialCategorySelector({ value, onChange, className, disabled, companyId }: FinancialCategorySelectorProps) {
    const [open, setOpen] = React.useState(false)
    const [categories, setCategories] = React.useState<FinancialCategory[]>([])
    const [searchValue, setSearchValue] = React.useState("")
    const [manageOpen, setManageOpen] = React.useState(false)
    const [prefillName, setPrefillName] = React.useState<string>("")
    const wrapperRef = React.useRef<HTMLDivElement>(null)

    // Fetch initial
    const fetchCategories = async () => {
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
    }

    React.useEffect(() => {
        fetchCategories();
    }, [companyId]);

    const handleOpenCreateModal = () => {
        if (!searchValue.trim()) return;
        setPrefillName(searchValue.trim());
        setManageOpen(true);
        setOpen(false);
    };

    const selectedCategory = categories.find((c) => c.id === value)

    const handleSelect = (categoryId: string) => {
        onChange(categoryId === value ? null : categoryId)
        setOpen(false)
    }

    const handleClear = () => {
        onChange(null);
        setSearchValue("");
        setOpen(false);
    };

    React.useEffect(() => {
        // Keep input text in sync when value changes externally.
        if (selectedCategory && searchValue !== selectedCategory.name) {
            setSearchValue(selectedCategory.name);
        }
        if (!value && searchValue && selectedCategory?.id !== value) {
            // leave user typed text as-is
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value, selectedCategory?.id]);

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
            const hay = `${c.account_code ?? ""} ${c.name}`.toLowerCase();
            return hay.includes(normalizedQuery);
        });
    }, [categories, normalizedQuery]);

    return (
        <div className={cn("flex items-center gap-2 w-full", className)} ref={wrapperRef}>
            <div className="relative w-full">
                <input
                    type="text"
                    value={searchValue}
                    disabled={disabled}
                    placeholder="Selecione..."
                    onFocus={() => !disabled && setOpen(true)}
                    onChange={(e) => {
                        const next = e.target.value;
                        setSearchValue(next);
                        setOpen(true);
                        // if user edits text, clear current selection to avoid inconsistency
                        if (selectedCategory && next !== selectedCategory.name) {
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
                                    <div className="px-3 py-1 text-xs font-semibold text-gray-500">Categorias</div>
                                    {filtered.map((cat) => (
                                        <button
                                            key={cat.id}
                                            type="button"
                                            onMouseDown={(e) => e.preventDefault()}
                                            onClick={() => handleSelect(cat.id)}
                                            className={cn(
                                                "w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-gray-50",
                                                value === cat.id && "bg-gray-50"
                                            )}
                                        >
                                            <Check className={cn("h-4 w-4", value === cat.id ? "opacity-100" : "opacity-0")} />
                                            <span className="font-mono text-xs text-gray-400 w-14 shrink-0">{cat.account_code ?? ""}</span>
                                            <span className="truncate text-gray-900">{cat.name}</span>
                                        </button>
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
