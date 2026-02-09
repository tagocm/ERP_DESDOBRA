
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
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/Dialog"
import { TaxGroupManagerModal } from "./TaxGroupManagerModal"
import { useToast } from "@/components/ui/use-toast"
import { useCompany } from "@/contexts/CompanyContext"
import { listTaxGroupsAction, createTaxGroupAction } from "@/app/actions/tax-group-actions"
import type { TaxGroupDTO } from "@/lib/types/products-dto"

interface TaxGroupSelectorProps {
    value?: string; // ID
    onChange: (value: string | null) => void;
    className?: string;
    disabled?: boolean;
    onGroupUpdated?: () => void;
}

export function TaxGroupSelector({ value, onChange, className, disabled, onGroupUpdated }: TaxGroupSelectorProps) {
    const { toast } = useToast()
    const { selectedCompany } = useCompany();

    const [open, setOpen] = React.useState(false)
    const [groups, setGroups] = React.useState<TaxGroupDTO[]>([])
    const [searchValue, setSearchValue] = React.useState("")
    const [manageOpen, setManageOpen] = React.useState(false)

    // Fetch initial
    const fetchGroups = async () => {
        if (!selectedCompany?.id) return;
        try {
            const result = await listTaxGroupsAction();
            if (result.success) {
                setGroups(result.data);
                onGroupUpdated?.();
            }
        } catch (e) {
            console.error(e);
        }
    }

    React.useEffect(() => {
        fetchGroups();
    }, [selectedCompany?.id]);

    const handleCreateOption = async () => {
        if (!searchValue || !selectedCompany?.id) return;
        try {
            const result = await createTaxGroupAction({
                name: searchValue,
                is_active: true,
                ncm: undefined,
                cest: undefined,
                origin_default: 0
            });
            if (result.success) {
                const newGroup = result.data;
                setGroups(prev => [...prev, newGroup]);
                onChange(newGroup.id);
                setOpen(false);
                setSearchValue("");
                onGroupUpdated?.();
                toast({ title: "Grupo criado e selecionado!", description: "Edite-o para adicionar NCM/CEST.", variant: "default" });
            } else {
                toast({ title: "Erro ao criar", description: result.error, variant: "destructive" });
            }
        } catch (error) {
            console.error(error);
            toast({ title: "Erro ao criar", variant: "destructive" });
        }
    }

    const selectedGroup = groups.find((g) => g.id === value)

    const handleSelect = (groupId: string) => {
        onChange(groupId === value ? null : groupId)
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
                            "shadow-card transition-all border-gray-200",
                            "hover:bg-white hover:text-gray-900",
                            "text-gray-900",
                            "font-normal",
                            "active:scale-100",
                            disabled && "bg-gray-50",
                            className,
                            "my-0" // Force reset margins as they are applied to the wrapper
                        )}
                    >
                        {selectedGroup ? (
                            <span className="truncate text-left w-full">{selectedGroup.name}</span>
                        ) : (
                            <span className="text-gray-500">Selecione...</span>
                        )}
                        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[480px] p-0 data-[state=open]:!zoom-in-100 data-[state=closed]:!zoom-out-100" align="start">
                    <Command>
                        <CommandInput
                            placeholder="Buscar grupo tributário..."
                            value={searchValue}
                            onValueChange={setSearchValue}
                        />
                        <CommandList>
                            <CommandEmpty>
                                <div className="p-2 text-sm text-center">
                                    <p className="mb-2 text-gray-500">Nenhum grupo encontrado.</p>
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
                            <CommandGroup heading="Grupos Tributários">
                                {groups.map((group) => (
                                    <CommandItem
                                        key={group.id}
                                        value={group.name}
                                        onSelect={() => handleSelect(group.id)}
                                        onMouseDown={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            handleSelect(group.id);
                                        }}
                                        className="cursor-pointer data-[disabled]:pointer-events-auto data-[disabled]:opacity-100"
                                    >
                                        <Check
                                            className={cn(
                                                "mr-2 h-4 w-4",
                                                value === group.id ? "opacity-100" : "opacity-0"
                                            )}
                                        />
                                        <div className="flex flex-col">
                                            <span>{group.name}</span>
                                            {(group.ncm || group.cest) && (
                                                <span className="text-[10px] text-gray-400">
                                                    {group.ncm ? `NCM: ${group.ncm}` : ''}
                                                    {group.ncm && group.cest ? ' • ' : ''}
                                                    {group.cest ? `CEST: ${group.cest}` : ''}
                                                </span>
                                            )}
                                        </div>
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
                <TaxGroupManagerModal onChange={fetchGroups} />
            </Dialog>
        </div >
    )
}
