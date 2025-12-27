
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
    CommandSeparator,
} from "@/components/ui/Command"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { getCategories, createCategory } from "@/lib/data/categories"
import { ProductCategory } from "@/types/product"
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/Dialog"
import { CategoryManagerModal } from "./CategoryManagerModal"
import { useToast } from "@/components/ui/use-toast"

interface CategorySelectorProps {
    value?: string; // ID
    onChange: (value: string | null) => void;
    className?: string;
    disabled?: boolean;
}

export function CategorySelector({ value, onChange, className, disabled }: CategorySelectorProps) {
    const { toast } = useToast()
    const [open, setOpen] = React.useState(false)
    const [categories, setCategories] = React.useState<ProductCategory[]>([])
    const [searchValue, setSearchValue] = React.useState("")
    const [manageOpen, setManageOpen] = React.useState(false)

    // Fetch initial
    const fetchCategories = async () => {
        try {
            const data = await getCategories();
            setCategories(data);
        } catch (e) {
            console.error(e);
        }
    }

    React.useEffect(() => {
        fetchCategories();
    }, []);

    const handleCreateOption = async () => {
        if (!searchValue) return;
        try {
            const newCat = await createCategory(searchValue);
            setCategories(prev => [...prev, newCat]);
            onChange(newCat.id);
            setOpen(false);
            setSearchValue("");
            toast({ title: "Categoria criada e selecionada!", variant: "default" });
        } catch (error: any) {
            // If duplicate, try to find existing and select it
            if (error.message.includes("Já existe")) {
                await fetchCategories();
                // Find by normalized matching roughly... actually fetch refetched.
                // let's try to match by name
                const existing = categories.find(c => c.name.toLowerCase() === searchValue.toLowerCase());
                if (existing) {
                    onChange(existing.id);
                    toast({ title: `Categoria já existia, selecionamos '${existing.name}'`, variant: "default" });
                    setOpen(false);
                    return;
                }
            }
            toast({ title: "Erro ao criar", description: error.message, variant: "destructive" });
        }
    }

    const selectedCategory = categories.find((c) => c.id === value)

    const handleSelect = (categoryId: string) => {
        onChange(categoryId === value ? null : categoryId)
        setOpen(false)
    }

    return (
        <div className={cn("flex items-center gap-2", className)}>
            <Popover open={open} onOpenChange={(val) => !disabled && setOpen(val)}>
                <PopoverTrigger asChild>
                    <Button
                        variant="ghost" // Using ghost/custom to override default shadcn button styles significantly
                        role="combobox"
                        aria-expanded={open}
                        disabled={disabled}
                        className={cn(
                            "flex h-10 w-full items-center justify-between rounded-2xl border bg-white px-3 py-2 text-sm ring-offset-background placeholder:text-gray-500",
                            "focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2",
                            "disabled:cursor-not-allowed disabled:opacity-50",
                            "shadow-sm transition-all border-gray-200",
                            "hover:bg-white hover:text-gray-900", // Override ghost hover
                            "text-gray-900", // FORCE override Button ghost text-gray-600 to match Select (usually gray-900 or black)
                            "font-normal", // Override Button's font-semibold
                            "active:scale-100", // Override Button's active:scale-95
                            disabled && "bg-gray-50",
                            className
                        )}
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
                                        value={cat.name.toLowerCase()} // cmkd requires lowercase values for proper filtering
                                        onSelect={() => handleSelect(cat.id)}
                                        onMouseDown={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            handleSelect(cat.id);
                                        }}
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
                        disabled={disabled}
                    >
                        <Settings className="h-4 w-4 text-gray-500" />
                    </Button>
                </DialogTrigger>
                <CategoryManagerModal onChange={fetchCategories} />
            </Dialog>
        </div >
    )
}
