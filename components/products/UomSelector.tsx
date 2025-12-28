"use client";

import * as React from "react"
import { Check, ChevronDown, Loader2, Plus, Settings } from "lucide-react"

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
import { getUoms, createUom, Uom } from "@/lib/data/uoms" // You'll need to export Uom type or import from types
import { useToast } from "@/components/ui/use-toast"
import { UomManagerModal } from "./UomManagerModal"
import { useCompany } from "@/contexts/CompanyContext"

interface UomSelectorProps {
    value?: string; // uom_id
    onChange: (value: string | null) => void;
    onSelect?: (uom: any) => void;
    className?: string;
    disabled?: boolean;
}

export function UomSelector({ value, onChange, onSelect, className, disabled }: UomSelectorProps) {
    const { toast } = useToast()
    const { selectedCompany } = useCompany();

    const [open, setOpen] = React.useState(false)
    const [uoms, setUoms] = React.useState<any[]>([])
    const [loading, setLoading] = React.useState(false)
    const [initialLoadDone, setInitialLoadDone] = React.useState(false)

    // Custom query state for "Create on the fly"
    const [searchQuery, setSearchQuery] = React.useState("")

    const fetchUoms = async () => {
        setLoading(true);
        try {
            const data = await getUoms();
            setUoms(data);
        } catch (e) {
            console.error(e);
            toast({ title: "Erro ao carregar unidades", variant: "destructive" });
        } finally {
            setLoading(false);
            setInitialLoadDone(true);
        }
    }

    React.useEffect(() => {
        if (open && !initialLoadDone) {
            fetchUoms();
        }
    }, [open, initialLoadDone]);

    // Ensure we load if there is an initial value to display the label
    React.useEffect(() => {
        if (value && !initialLoadDone) {
            fetchUoms();
        }
    }, [value, initialLoadDone]);

    // Handle create new on the fly
    const handleCreateNew = async () => {
        if (!selectedCompany) return;
        if (!searchQuery) return;

        // Simple parsing logic: "Pacote (Pc)" -> Name: Pacote, Abbrev: Pc
        // Or if just "Pacote", Abbrev = "Pacote" (truncated)
        let name = searchQuery;
        let abbrev = searchQuery.slice(0, 3).toUpperCase(); // Default abbrev

        // Try to be smart if user types "Name (Abbrev)"
        const match = searchQuery.match(/^(.*)\s*\((.*)\)$/);
        if (match) {
            name = match[1].trim();
            abbrev = match[2].trim();
        }

        try {
            setLoading(true);
            const newUom = await createUom({
                company_id: selectedCompany.id,
                name: name,
                abbrev: abbrev,
                is_active: true
            });

            if (newUom) {
                setUoms(prev => [...prev, newUom]); // Optimistic update or refetch? Pushing is fine.
                onChange(newUom.id);
                if (onSelect) onSelect(newUom);
                setOpen(false);
                setSearchQuery("");
                toast({ title: "Unidade criada!", description: `${newUom.name} (${newUom.abbrev})` });
            }
        } catch (error: any) {
            if (error.message?.includes("uoms_name_company_unique")) {
                toast({ title: "Esta unidade já existe.", variant: "destructive" });
            } else if (error.message?.includes("uoms_abbrev_company_unique")) {
                toast({ title: "Esta abreviação já existe.", variant: "destructive" });
            } else {
                toast({ title: "Erro ao criar unidade", variant: "destructive" });
            }
        } finally {
            setLoading(false);
        }
    }

    // Refresh if manager modal changes things? 
    // Ideally we lift state or use a query cache, but here we can just expose a refresh ref or simply re-fetch on open.
    // For simplicity, we re-fetch when the manager modal closes if needed, but let's just re-fetch every open for now or add a refresh trigger.
    const onManagerClose = (open: boolean) => {
        if (!open) {
            // Reload when manager closes to reflect edits/deletes
            fetchUoms();
        }
    }

    const selectedUom = uoms.find((c) => c.id === value)

    return (
        <div className={cn("flex items-center gap-2", className)}>
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
                            "shadow-sm transition-all border-gray-200",
                            "hover:bg-white hover:text-gray-900",
                            "text-gray-900",
                            "font-normal",
                            "active:scale-100",
                            disabled && "bg-gray-50"
                        )}
                    >
                        {selectedUom ? (
                            <span className="truncate flex items-center gap-2">
                                <span className="font-medium text-gray-900">{selectedUom.name}</span>
                                <span className="text-gray-500">({selectedUom.abbrev})</span>
                            </span>
                        ) : (
                            <span className="text-gray-500">Selecione...</span>
                        )}
                        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0 data-[state=open]:!zoom-in-100 data-[state=closed]:!zoom-out-100 min-w-[300px]" align="start">
                    <Command shouldFilter={false}>
                        <CommandInput
                            placeholder="Buscar unidade..."
                            value={searchQuery}
                            onValueChange={setSearchQuery}
                        />
                        <CommandList>
                            {loading && (
                                <div className="flex justify-center p-4">
                                    <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
                                </div>
                            )}

                            {!loading && (
                                <CommandGroup>
                                    {uoms
                                        .filter(u =>
                                            u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                            u.abbrev.toLowerCase().includes(searchQuery.toLowerCase())
                                        )
                                        .map((uom) => (
                                            <CommandItem
                                                key={uom.id}
                                                value={`${uom.name} ${uom.abbrev}`.toLowerCase()}
                                                onSelect={() => {
                                                    onChange(uom.id)
                                                    if (onSelect) onSelect(uom)
                                                    setOpen(false)
                                                }}
                                                className="cursor-pointer data-[disabled]:pointer-events-auto data-[disabled]:opacity-100"
                                            >
                                                <Check
                                                    className={cn(
                                                        "mr-2 h-4 w-4",
                                                        value === uom.id ? "opacity-100" : "opacity-0"
                                                    )}
                                                />
                                                <span className="font-medium text-gray-900 mr-2">{uom.name}</span>
                                                <span className="text-gray-500">({uom.abbrev})</span>
                                            </CommandItem>
                                        ))}
                                </CommandGroup>
                            )}

                            {!loading && searchQuery && !uoms.some(u => u.name.toLowerCase() === searchQuery.toLowerCase()) && (
                                <>
                                    <CommandSeparator />
                                    <CommandGroup>
                                        <CommandItem
                                            onSelect={handleCreateNew}
                                            className="cursor-pointer text-brand-600 font-medium data-[disabled]:pointer-events-auto data-[disabled]:opacity-100"
                                        >
                                            <Plus className="mr-2 h-4 w-4" />
                                            Criar "{searchQuery}"
                                        </CommandItem>
                                    </CommandGroup>
                                </>
                            )}
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>

            <UomManagerModal
                onOpenChange={onManagerClose}
                trigger={
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 shrink-0"
                        disabled={disabled}
                        title="Gerenciar Unidades"
                        type="button"
                    >
                        <Settings className="h-4 w-4 text-gray-500" />
                    </Button>
                }
            />
        </div>
    )
}
