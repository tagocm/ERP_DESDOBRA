"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Command as CommandPrimitive } from "cmdk";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Search } from "lucide-react";

export function CommandPalette() {
    const router = useRouter();
    const [open, setOpen] = React.useState(false);

    React.useEffect(() => {
        const down = (e: KeyboardEvent) => {
            // Toggle on Cmd+K
            if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                setOpen((open) => !open);
            }
            // Open on Custom Event dispatched by Sidebar logic (optional, if we use dispatch, though standard keydown above works if focus isn't trapped)
        };

        document.addEventListener("keydown", down);
        return () => document.removeEventListener("keydown", down);
    }, []);

    const runCommand = React.useCallback((command: () => unknown) => {
        setOpen(false);
        command();
    }, []);

    return (
        <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
            <DialogPrimitive.Portal>
                <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
                <DialogPrimitive.Content className="fixed left-[50%] top-[20%] z-50 w-full max-w-xl translate-x-[-50%] gap-4 rounded-xl border border-gray-200 bg-white p-0 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]">
                    <CommandPrimitive className="flex h-full w-full flex-col overflow-hidden rounded-xl bg-white">
                        <div className="flex items-center border-b px-3" cmdk-input-wrapper="">
                            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                            <CommandPrimitive.Input
                                placeholder="O que você precisa?"
                                className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-gray-500 disabled:cursor-not-allowed disabled:opacity-50"
                                autoFocus
                            />
                        </div>
                        <CommandPrimitive.List className="max-h-[300px] overflow-y-auto overflow-x-hidden p-2">
                            <CommandPrimitive.Empty className="py-6 text-center text-sm">Nenhum resultado encontrado.</CommandPrimitive.Empty>

                            <CommandPrimitive.Group heading="Ações Rápidas" className="mb-2 px-2 text-xs font-medium text-gray-500">
                                <CommandItem onSelect={() => runCommand(() => router.push('/app/vendas/pedidos/novo'))}>
                                    + Novo Pedido
                                </CommandItem>
                                <CommandItem onSelect={() => runCommand(() => router.push('/app/cadastros/pessoas-e-empresas/novo'))}>
                                    + Novo Cadastro
                                </CommandItem>
                            </CommandPrimitive.Group>

                            <CommandPrimitive.Separator className="h-px bg-gray-100 mx-2 my-2" />

                            <CommandPrimitive.Group heading="Navegação" className="mb-2 px-2 text-xs font-medium text-gray-500">
                                <CommandItem onSelect={() => runCommand(() => router.push('/app/crm/pipeline'))}>
                                    CRM / Pipeline
                                </CommandItem>
                                <CommandItem onSelect={() => runCommand(() => router.push('/app/vendas/pedidos'))}>
                                    Vendas / Pedidos
                                </CommandItem>
                                <CommandItem onSelect={() => runCommand(() => router.push('/app/expedicao/separacao'))}>
                                    Expedição / Separação
                                </CommandItem>
                                <CommandItem onSelect={() => runCommand(() => router.push('/app/estoque/movimentacoes'))}>
                                    Estoque / Movimentações
                                </CommandItem>
                                <CommandItem onSelect={() => runCommand(() => router.push('/app/financeiro/receber'))}>
                                    Financeiro / Contas a Receber
                                </CommandItem>
                            </CommandPrimitive.Group>
                        </CommandPrimitive.List>
                    </CommandPrimitive>
                </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
    );
}

function CommandItem({
    children,
    onSelect,
}: {
    children: React.ReactNode;
    onSelect: () => void;
}) {
    return (
        <CommandPrimitive.Item
            onSelect={onSelect}
            className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none aria-selected:bg-gray-100 aria-selected:text-gray-900 data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
        >
            {children}
        </CommandPrimitive.Item>
    );
}
