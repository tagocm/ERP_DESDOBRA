
"use client";

import * as React from "react"
import { Check, ChevronDown, Loader2 } from "lucide-react"

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
import { useToast } from "@/components/ui/use-toast"
import { listCfopsAction } from "@/app/actions/cfop-actions"
import type { CfopDTO } from "@/lib/types/products-dto"

interface CfopSelectorProps {
    value?: string; // code
    onChange: (value: string | null) => void;
    className?: string;
    disabled?: boolean;
}

export function CfopSelector({ value, onChange, className, disabled }: CfopSelectorProps) {
    const { toast } = useToast()
    const [open, setOpen] = React.useState(false)
    const [cfops, setCfops] = React.useState<CfopDTO[]>([]) // Full list or filtered
    const [loading, setLoading] = React.useState(false)
    const [initialLoadDone, setInitialLoadDone] = React.useState(false)

    // Load all CFOPs once or on open? There are not that many (< 1000). 
    // Loading all is safer for "search by description".
    const fetchCfops = async () => {
        setLoading(true);
        try {
            const result = await listCfopsAction();
            if (result.success) {
                setCfops(result.data);
            } else {
                toast({ title: "Erro ao carregar CFOPs", description: result.error, variant: "destructive" });
            }
        } catch (e) {
            console.error(e);
            toast({ title: "Erro ao carregar CFOPs", variant: "destructive" });
        } finally {
            setLoading(false);
            setInitialLoadDone(true);
        }
    }

    React.useEffect(() => {
        if (open && !initialLoadDone) {
            fetchCfops();
        }
    }, [open, initialLoadDone]);

    // If we have a value but no options loaded, we might want to load to show the label.
    // Or we rely on the fact that if value is set, it's a code. 
    // To show description, we need the list.
    React.useEffect(() => {
        if (value && !initialLoadDone) {
            fetchCfops();
        }
    }, [value, initialLoadDone]);

    const selectedCfop = cfops.find((c) => c.codigo === value)

    return (
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
                        "shadow-card transition-all border-gray-200",
                        "hover:bg-white hover:text-gray-900",
                        "text-gray-900",
                        "font-normal",
                        "active:scale-100",
                        disabled && "bg-gray-50",
                        className
                    )}
                >
                    {selectedCfop ? (
                        <span className="truncate">{selectedCfop.codigo} — {selectedCfop.descricao}</span>
                    ) : (
                        <span className="text-gray-500">Selecione o CFOP...</span>
                    )}
                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[600px] p-0 data-[state=open]:!zoom-in-100 data-[state=closed]:!zoom-out-100" align="start">
                <Command filter={(value, search) => {
                    // Custom filter to match code or description
                    // The 'value' passed to filter is usually the value prop of CommandItem, which we set to code + description
                    if (value.toLowerCase().includes(search.toLowerCase())) return 1;
                    return 0;
                }}>
                    <CommandInput placeholder="Buscar CFOP (código ou descrição)..." />
                    <CommandList>
                        {loading && (
                            <div className="flex justify-center p-4">
                                <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
                            </div>
                        )}
                        {!loading && cfops.length === 0 && (
                            <CommandEmpty>Nenhum CFOP encontrado.</CommandEmpty>
                        )}
                        {!loading && (
                            <CommandGroup className="max-h-[300px] overflow-y-auto">
                                {cfops.map((cfop) => (
                                    <CommandItem
                                        key={cfop.codigo}
                                        value={`${cfop.codigo} ${cfop.descricao}`.toLowerCase()} // value for filtering
                                        onSelect={() => {
                                            onChange(cfop.codigo)
                                            setOpen(false)
                                            toast({ title: "CFOP definido no produto" });
                                        }}
                                        className="cursor-pointer text-left items-center data-[disabled]:pointer-events-auto data-[disabled]:opacity-100"
                                    >
                                        <div className="flex items-center w-full">
                                            <Check
                                                className={cn(
                                                    "mr-2 h-4 w-4 shrink-0",
                                                    value === cfop.codigo ? "opacity-100" : "opacity-0"
                                                )}
                                            />
                                            <div className="flex flex-col text-left">
                                                <span className="font-medium text-gray-900">{cfop.codigo}</span>
                                            </div>
                                            <span className="ml-2 text-gray-500 truncate text-left flex-1">
                                                {cfop.descricao}
                                            </span>
                                        </div>
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        )}
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}
