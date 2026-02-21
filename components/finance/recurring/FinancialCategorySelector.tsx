
import * as React from "react"
import { Check, ChevronDown, Plus, Settings } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/Button"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/Command"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { getFinancialCategoriesAction, FinancialCategory } from "@/app/actions/financial-categories"
import { Dialog, DialogTrigger } from "@/components/ui/Dialog"
import { FinancialCategoryManagerModal } from "./FinancialCategoryManagerModal"

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

    return (
        <div className={cn("flex items-center gap-2 w-full", className)}>
            <Popover open={open} onOpenChange={(val) => !disabled && setOpen(val)}>
                <PopoverTrigger asChild>
                    <Button
                        variant="ghost"
                        role="combobox"
                        aria-expanded={open}
                        disabled={disabled}
                        className={cn(
                            "flex h-10 w-full items-center justify-between rounded-2xl border bg-white px-3 py-2 text-sm ring-offset-background placeholder:text-gray-500",
                            "focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2",
                            "disabled:cursor-not-allowed disabled:opacity-50",
                            "shadow-none transition-all border-gray-200", // Standard input style
                            "hover:bg-white hover:text-gray-900", // Override ghost
                            "text-gray-900",
                            "font-normal",
                            disabled && "bg-gray-50",
                            className,
                            "my-0"
                        )}
                        onClick={() => setOpen(!open)}
                    >
                        {selectedCategory ? (
                            <span className="truncate flex items-center gap-2">
                                {selectedCategory.account_code && (
                                    <span className="font-mono text-xs text-gray-500">{selectedCategory.account_code}</span>
                                )}
                                <span className="truncate">{selectedCategory.name}</span>
                            </span>
                        ) : (
                            <span className="text-gray-500">Selecione...</span>
                        )}
                        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[320px] p-0 data-[state=open]:!zoom-in-100 data-[state=closed]:!zoom-out-100" align="start">
                    <Command>
                        <CommandInput
                            placeholder="Buscar categoria..."
                            value={searchValue}
                            onValueChange={setSearchValue}
                        />
                        <CommandList>
                            <CommandEmpty>
                                <div className="p-2 text-sm text-center">
                                    <p className="mb-2 text-gray-500">Nenhuma categoria encontrada.</p>
                                    {searchValue && (
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            className="w-full"
                                            onClick={handleOpenCreateModal}
                                        >
                                            <Plus className="w-3 h-3 mr-1" />
                                            Criar categoria
                                        </Button>
                                    )}
                                    {searchValue && (
                                        <p className="mt-2 text-[11px] text-gray-400">
                                            Para criar, selecione a subcategoria no Plano de Contas.
                                        </p>
                                    )}
                                </div>
                            </CommandEmpty>
                            <CommandGroup heading="Categorias">
                                {categories.map((cat) => (
                                    <CommandItem
                                        key={cat.id}
                                        value={`${cat.name} ${cat.account_code ?? ''}`.toLowerCase()} // Search by name + code
                                        onSelect={() => handleSelect(cat.id)}
                                        className="cursor-pointer"
                                    >
                                        <Check
                                            className={cn(
                                                "mr-2 h-4 w-4",
                                                value === cat.id ? "opacity-100" : "opacity-0"
                                            )}
                                        />
                                        <span className="font-mono text-xs text-gray-400 w-14">
                                            {cat.account_code ?? ''}
                                        </span>
                                        <span className="truncate">{cat.name}</span>
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>

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
