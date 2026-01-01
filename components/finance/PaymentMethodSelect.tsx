"use client"

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"
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
import { createClient } from "@/lib/supabaseBrowser"

interface PaymentMode {
    id: string;
    name: string;
}

interface Props {
    value?: string; // Expecting Name (Text) as per requirement, but could be ID if we switch logic. sticking to Name as we save text in ar_installments.
    onChange: (val: string) => void;
    className?: string;
    placeholder?: string;
}

export function PaymentMethodSelect({ value, onChange, className, placeholder = "Selecione..." }: Props) {
    const [open, setOpen] = React.useState(false)
    const [modes, setModes] = React.useState<PaymentMode[]>([])
    const [loading, setLoading] = React.useState(false)
    const supabase = createClient();

    React.useEffect(() => {
        const fetchModes = async () => {
            setLoading(true);
            const { data } = await supabase.from('payment_modes').select('id, name').eq('is_active', true).order('name');
            if (data) setModes(data);
            setLoading(false);
        };
        fetchModes();
    }, []);

    return (
        <Popover open={open} onOpenChange={setOpen} modal={true}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className={cn("w-full justify-between bg-white", className)}
                >
                    {value
                        ? modes.find((mode) => mode.name === value)?.name || value
                        : <span className="text-gray-400">{placeholder}</span>}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[200px] p-0">
                <Command>
                    <CommandInput placeholder="Buscar modalidade..." />
                    <CommandList>
                        <CommandEmpty>Nenhuma modalidade encontrada.</CommandEmpty>
                        <CommandGroup>
                            {modes.map((mode) => (
                                <CommandItem
                                    key={mode.id}
                                    value={mode.name}
                                    onSelect={(currentValue) => {
                                        onChange(currentValue === value ? "" : currentValue)
                                        setOpen(false)
                                    }}
                                >
                                    <Check
                                        className={cn(
                                            "mr-2 h-4 w-4",
                                            value === mode.name ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                    {mode.name}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}
