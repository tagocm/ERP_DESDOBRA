"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/Command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { BRAZILIAN_BANKS, Bank } from "@/lib/constants/banks";

interface BankSelectorProps {
    value?: string;
    onSelect: (bank: Bank) => void;
    className?: string;
}

export function BankSelector({ value, onSelect, className }: BankSelectorProps) {
    const [open, setOpen] = React.useState(false);

    const selectedBank = BRAZILIAN_BANKS.find((bank) => bank.name === value || bank.code === value);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className={cn("w-full justify-between h-9 rounded-xl px-3 font-normal bg-white border-gray-200 active:scale-100", className)}
                >
                    {selectedBank ? (
                        <span className="truncate flex items-center">
                            <span className="font-bold text-gray-900 mr-2 border border-gray-200 bg-gray-50 px-1.5 rounded text-[10px] h-5 flex items-center">{selectedBank.code}</span>
                            <span className="text-gray-700">{selectedBank.name}</span>
                        </span>
                    ) : (
                        <span className="text-gray-400">Selecionar banco...</span>
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                <Command className="h-[300px]">
                    <CommandInput placeholder="Buscar banco..." />
                    <CommandList className="h-full max-h-full">
                        <CommandEmpty>Nenhum banco encontrado.</CommandEmpty>
                        <CommandGroup>
                            {BRAZILIAN_BANKS.map((bank) => (
                                <CommandItem
                                    key={`${bank.code}-${bank.name}`}
                                    value={bank.name} // Search by name
                                    onSelect={() => {
                                        onSelect(bank);
                                        setOpen(false);
                                    }}
                                    className="cursor-pointer"
                                >
                                    <Check
                                        className={cn(
                                            "mr-2 h-4 w-4",
                                            (value === bank.name || value === bank.code) ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                    <span className="font-bold text-gray-700 mr-2 min-w-[30px]">{bank.code}</span>
                                    <span className="text-gray-600 truncate">{bank.name}</span>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
