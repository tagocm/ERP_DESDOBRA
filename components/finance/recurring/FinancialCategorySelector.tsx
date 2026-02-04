
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
import { getFinancialCategoriesAction, createFinancialCategoryAction, FinancialCategory } from "@/app/actions/financial-categories"
import { Dialog, DialogTrigger } from "@/components/ui/Dialog"
import { FinancialCategoryManagerModal } from "./FinancialCategoryManagerModal"
import { useToast } from "@/components/ui/use-toast"

interface FinancialCategorySelectorProps {
    value?: string; // ID
    onChange: (value: string | null) => void;
    className?: string;
    disabled?: boolean;
    companyId: string;
}

export function FinancialCategorySelector({ value, onChange, className, disabled, companyId }: FinancialCategorySelectorProps) {
    const { toast } = useToast()
    const [open, setOpen] = React.useState(false)
    const [categories, setCategories] = React.useState<FinancialCategory[]>([])
    const [searchValue, setSearchValue] = React.useState("")
    const [manageOpen, setManageOpen] = React.useState(false)

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

    const handleCreateOption = async () => {
        if (!searchValue) return;
        try {
            const result = await createFinancialCategoryAction(searchValue);
            if (result.data) {
                const newCat = result.data;
                setCategories(prev => [...prev, newCat]);
                onChange(newCat.id);
                setOpen(false);
                setSearchValue("");
                toast({ title: "Categoria criada e selecionada!", variant: "default" });
            } else if (result.error) {
                if (result.error.includes("Já existe")) {
                    await fetchCategories();
                    const existing = categories.find(c => c.name.toLowerCase() === searchValue.toLowerCase());
                    if (existing) {
                        onChange(existing.id);
                        toast({ title: `Categoria já existia, selecionamos '${existing.name}'`, variant: "default" });
                        setOpen(false);
                        return;
                    }
                }
                toast({ title: "Erro ao criar", description: result.error, variant: "destructive" });
            }
        } catch (error: any) {
            toast({ title: "Erro ao criar", description: error.message, variant: "destructive" });
        }
    }

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
                            <span className="truncate">{selectedCategory.name}</span>
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
                                            onClick={handleCreateOption}
                                        >
                                            <Plus className="w-3 h-3 mr-1" />
                                            Criar "{searchValue}"
                                        </Button>
                                    )}
                                </div>
                            </CommandEmpty>
                            <CommandGroup heading="Categorias">
                                {categories.map((cat) => (
                                    <CommandItem
                                        key={cat.id}
                                        value={cat.name.toLowerCase()} // Search by lowercase name
                                        onSelect={() => handleSelect(cat.id)}
                                        className="cursor-pointer"
                                    >
                                        <Check
                                            className={cn(
                                                "mr-2 h-4 w-4",
                                                value === cat.id ? "opacity-100" : "opacity-0"
                                            )}
                                        />
                                        {cat.name}
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
                <FinancialCategoryManagerModal companyId={companyId} onChange={fetchCategories} />
            </Dialog>
        </div >
    )
}
