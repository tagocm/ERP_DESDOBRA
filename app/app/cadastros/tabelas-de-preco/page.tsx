"use client";

import { useEffect, useState } from "react";
import { useCompany } from "@/contexts/CompanyContext";
import { createClient } from "@/lib/supabaseBrowser";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { Plus, Search, Trash2, Pencil, Copy, Calendar, Tag, Edit2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";

import { getPriceTables, deletePriceTable, duplicatePriceTable, PriceTable } from "@/lib/price-tables";
import { format, parseISO } from "date-fns";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const STATES = [
    "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
    "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"
];

export default function PriceTablesPage() {
    const { selectedCompany } = useCompany();
    const supabase = createClient();
    const router = useRouter();

    const [tables, setTables] = useState<PriceTable[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; id: string | null; name: string | null }>({
        open: false,
        id: null,
        name: null
    });

    useEffect(() => {
        if (selectedCompany) {
            loadTables();
        }
    }, [selectedCompany, search, statusFilter]);

    const loadTables = async () => {
        if (!selectedCompany) return;
        setIsLoading(true);
        try {
            const data = await getPriceTables(supabase, selectedCompany.id, {
                search,
                isActive: statusFilter === 'active' ? true : statusFilter === 'inactive' ? false : null
            });
            setTables(data);
        } catch (error) {
            console.error(error);
            alert("Erro ao carregar tabelas.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = (id: string, name: string) => {
        setDeleteDialog({ open: true, id, name });
    };

    const executeDelete = async () => {
        if (!deleteDialog.id) return;

        try {
            await deletePriceTable(supabase, deleteDialog.id);
            setDeleteDialog({ open: false, id: null, name: null });
            loadTables();
        } catch (error: any) {
            console.error(error);
            alert("Erro ao excluir: " + error.message);
        }
    };

    const handleDuplicate = async (id: string) => {
        if (!confirm("Deseja duplicar esta tabela?")) return;

        try {
            const newTable = await duplicatePriceTable(supabase, id);
            router.push(`/app/cadastros/tabelas-de-preco/${newTable.id}`);
        } catch (error: any) {
            console.error(error);
            alert("Erro ao duplicar: " + error.message);
        }
    };

    return (
        <div>
            <PageHeader
                title="Tabelas de Preços"
                subtitle="Crie e gerencie tabelas por estado, perfil e validade"
                actions={
                    <Button onClick={() => router.push("/app/cadastros/tabelas-de-preco/nova")}>
                        <Plus className="w-4 h-4 mr-2" />
                        Novo Tabela
                    </Button>
                }
            />

            <div className="max-w-screen-2xl mx-auto px-6 h-full pb-10">
                <div className="mb-6 flex gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                            placeholder="Buscar por nome..."
                            className="pl-10 h-10 rounded-2xl bg-white border-gray-200"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <Select
                        value={statusFilter}
                        onValueChange={(val) => setStatusFilter(val)}
                    >
                        <SelectTrigger className="w-48 h-10 rounded-2xl bg-white border-gray-200">
                            <SelectValue placeholder="Todas as situações" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todas as situações</SelectItem>
                            <SelectItem value="active">Ativas</SelectItem>
                            <SelectItem value="inactive">Inativas</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <Card className="overflow-hidden">
                    <Table>
                        <TableHeader className="bg-gray-50/50">
                            <TableRow className="hover:bg-transparent border-gray-100">
                                <TableHead className="px-6 h-10 text-xs font-bold text-gray-500 uppercase tracking-wider">Nome / Data</TableHead>
                                <TableHead className="px-6 h-10 text-xs font-bold text-gray-500 uppercase tracking-wider">Validade</TableHead>
                                <TableHead className="px-6 h-10 text-xs font-bold text-gray-500 uppercase tracking-wider">Abrangência (Estados)</TableHead>
                                <TableHead className="px-6 h-10 text-xs font-bold text-gray-500 uppercase tracking-wider">Perfis / Canais</TableHead>
                                <TableHead className="px-6 h-10 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Comissão</TableHead>
                                <TableHead className="px-6 h-10 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Status</TableHead>
                                <TableHead className="px-6 h-10 text-xs font-bold text-gray-500 uppercase tracking-wider text-right pr-6">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="px-6 py-12 text-center text-gray-500">
                                        Carregando...
                                    </TableCell>
                                </TableRow>
                            ) : tables.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="px-6 py-12 text-center text-gray-500">
                                        <div className="flex flex-col items-center gap-3">
                                            <Tag className="w-12 h-12 text-gray-300 opacity-50" />
                                            <p className="text-lg font-medium">Nenhuma tabela encontrada</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                tables.map((table) => (
                                    <TableRow
                                        key={table.id}
                                        className="group border-gray-50 hover:bg-gray-50/50 transition-colors cursor-pointer"
                                        onClick={() => router.push(`/app/cadastros/tabelas-de-preco/${table.id}`)}
                                    >
                                        <TableCell className="px-6 py-4">
                                            <div className="text-sm font-bold text-gray-900 leading-tight">{table.name}</div>
                                            <div className="text-xs text-gray-500 flex items-center mt-1 font-medium">
                                                <Calendar className="w-3 h-3 mr-1" />
                                                Efetiva: {table.effective_date ? format(parseISO(table.effective_date), "dd/MM/yyyy") : "-"}
                                            </div>
                                        </TableCell>
                                        <TableCell className="px-6 py-4">
                                            {table.valid_from || table.valid_to ? (
                                                <div className="flex flex-col text-xs font-medium text-gray-600">
                                                    <span>De: {table.valid_from ? format(parseISO(table.valid_from), "dd/MM/yyyy") : "Início"}</span>
                                                    <span>Até: {table.valid_to ? format(parseISO(table.valid_to), "dd/MM/yyyy") : "Indefinido"}</span>
                                                </div>
                                            ) : (
                                                <span className="text-gray-400 italic text-xs">Sem validade</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="px-6 py-4">
                                            <div className="flex gap-1 flex-wrap">
                                                {!table.states || table.states.length === 0 ? (
                                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-gray-100 text-gray-500 border border-gray-200">
                                                        Todos
                                                    </span>
                                                ) : (
                                                    table.states.slice(0, 3).map(s => (
                                                        <span key={s} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-100">
                                                            {s}
                                                        </span>
                                                    ))
                                                )}
                                                {table.states && table.states.length > 3 && (
                                                    <span className="text-[10px] font-bold text-gray-400">+{table.states.length - 3}</span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="px-6 py-4">
                                            <div className="flex gap-1 flex-wrap">
                                                {!table.customer_profiles || table.customer_profiles.length === 0 ? (
                                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-gray-100 text-gray-500 border border-gray-200">
                                                        Qualquer
                                                    </span>
                                                ) : (
                                                    table.customer_profiles.slice(0, 2).map(p => (
                                                        <span key={p} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-100">
                                                            {p}
                                                        </span>
                                                    ))
                                                )}
                                                {table.customer_profiles && table.customer_profiles.length > 2 && (
                                                    <span className="text-[10px] font-bold text-gray-400">+{table.customer_profiles.length - 2}</span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="px-6 py-4 text-right">
                                            <span className="text-sm font-medium text-gray-600">
                                                {table.commission_pct ? `${table.commission_pct}%` : '-'}
                                            </span>
                                        </TableCell>
                                        <TableCell className="px-6 py-4 text-center">
                                            {table.is_active ? (
                                                <span className="inline-flex px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-green-700 bg-green-50 border border-green-100 rounded-full">
                                                    Ativa
                                                </span>
                                            ) : (
                                                <span className="inline-flex px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 bg-gray-50 border border-gray-100 rounded-full">
                                                    Inativa
                                                </span>
                                            )}
                                        </TableCell>
                                        <TableCell className="px-6 py-4 text-right pr-6">
                                            <div className="flex justify-end items-center gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                className="h-8 w-8 rounded-2xl hover:bg-brand-50 hover:text-brand-600 text-gray-400 transition-colors"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDuplicate(table.id);
                                                    }}
                                                    title="Duplicar"
                                                >
                                                    <Copy className="w-4 h-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                className="h-8 w-8 rounded-2xl hover:bg-brand-50 hover:text-brand-600 text-gray-400 transition-colors"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        router.push(`/app/cadastros/tabelas-de-preco/${table.id}`);
                                                    }}
                                                    title="Editar"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                className="h-8 w-8 rounded-2xl hover:bg-red-50 hover:text-red-600 text-gray-400 transition-colors"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDelete(table.id, table.name);
                                                    }}
                                                    title="Excluir"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </Card>
            </div>

            <AlertDialog open={deleteDialog.open} onOpenChange={(open) => !open && setDeleteDialog({ open: false, id: null, name: null })}>
                    <AlertDialogContent className="rounded-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Excluir Tabela de Preços?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Tem certeza que deseja excluir a tabela <strong>"{deleteDialog.name}"</strong>? Esta ação não pode ser desfeita.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={executeDelete}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            Excluir
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
