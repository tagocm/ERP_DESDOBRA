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
} from "cmdk";
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
    const [search, setSearch] = React.useState("");

    const selectedBank = BRAZILIAN_BANKS.find((bank) => bank.name === value || bank.code === value);

    const filteredBanks = BRAZILIAN_BANKS.filter((bank) =>
        bank.name.toLowerCase().includes(search.toLowerCase()) ||
        bank.code.includes(search)
    );

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className={cn("w-full justify-between h-10 rounded-2xl px-3 font-normal", className)}
                >
                    {selectedBank ? (
                        <span className="truncate">
                            <span className="font-semibold mr-2">{selectedBank.code}</span>
                            {selectedBank.name}
                        </span>
                    ) : (
                        <span className="text-gray-400">Selecionar banco...</span>
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                <div className="flex items-center border-b px-3 h-10">
                    <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                    <input
                        className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-gray-500 disabled:cursor-not-allowed disabled:opacity-50"
                        placeholder="Buscar banco por nome ou código..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <div className="max-h-[300px] overflow-y-auto p-1">
                    {filteredBanks.length === 0 && (
                        <div className="py-6 text-center text-sm text-gray-500">Nenhum banco encontrado.</div>
                    )}
                    {filteredBanks.map((bank) => (
                        <div
                            key={bank.code}
                            className={cn(
                                "relative flex cursor-pointer select-none items-center rounded-lg px-2 py-2 text-sm outline-none hover:bg-gray-100 transition-colors",
                                (value === bank.name || value === bank.code) && "bg-gray-50"
                            )}
                            onClick={() => {
                                onSelect(bank);
                                setOpen(false);
                                setSearch("");
                            }}
                        >
                            <span className="flex-1 truncate">
                                <span className="font-semibold text-brand-600 mr-2 w-8 inline-block">{bank.code}</span>
                                {bank.name}
                            </span>
                            {value === bank.name || value === bank.code ? (
                                <Check className="ml-2 h-4 w-4 text-brand-600" />
                            ) : null}
                        </div>
                    ))}
                </div>
            </PopoverContent>
        </Popover>
    );
}
