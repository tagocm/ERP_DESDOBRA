"use client";

import { useEffect, useState } from "react";
import { useCompany } from "@/contexts/CompanyContext";
import { createClient } from "@/lib/supabaseBrowser";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { Plus, Search, Trash2, Pencil, Copy, Calendar } from "lucide-react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";

import { getPriceTables, deletePriceTable, duplicatePriceTable, PriceTable } from "@/lib/price-tables";
import { format } from "date-fns";

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

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`Tem certeza que deseja excluir a tabela "${name}"?`)) return;

        try {
            await deletePriceTable(supabase, id);
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
                        Nova Tabela
                    </Button>
                }
            />

            <div className="max-w-[1600px] mx-auto px-6 h-full pb-10">
                <div className="mb-6 flex gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                            placeholder="Buscar por nome..."
                            className="pl-10"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <Select
                        value={statusFilter}
                        onValueChange={(val) => setStatusFilter(val)}
                    >
                        <SelectTrigger className="w-48">
                            <SelectValue placeholder="Todas as situações" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todas as situações</SelectItem>
                            <SelectItem value="active">Ativas</SelectItem>
                            <SelectItem value="inactive">Inativas</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Nome / Data
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Validade
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Abrangência (Estados)
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Perfis / Canais
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Comissão
                                </th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Status
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Ações
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                                        Carregando...
                                    </td>
                                </tr>
                            ) : tables.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="text-3xl">🏷️</div>
                                            <p className="text-lg font-medium">Nenhuma tabela encontrada</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                tables.map((table) => (
                                    <tr
                                        key={table.id}
                                        className="hover:bg-gray-50 cursor-pointer"
                                        onClick={() => router.push(`/app/cadastros/tabelas-de-preco/${table.id}`)}
                                    >
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-medium text-gray-900">{table.name}</div>
                                            <div className="text-xs text-gray-500 flex items-center mt-1">
                                                <Calendar className="w-3 h-3 mr-1" />
                                                Efetiva: {table.effective_date ? format(new Date(table.effective_date), "dd/MM/yyyy") : "-"}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                            {table.valid_from || table.valid_to ? (
                                                <div className="flex flex-col text-xs">
                                                    <span>De: {table.valid_from ? format(new Date(table.valid_from), "dd/MM/yyyy") : "Início"}</span>
                                                    <span>Até: {table.valid_to ? format(new Date(table.valid_to), "dd/MM/yyyy") : "Indefinido"}</span>
                                                </div>
                                            ) : (
                                                <span className="text-gray-400 italic">Sem validade</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex gap-1 flex-wrap">
                                                {!table.states || table.states.length === 0 ? (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                                                        Todos
                                                    </span>
                                                ) : (
                                                    table.states.slice(0, 3).map(s => (
                                                        <span key={s} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                                                            {s}
                                                        </span>
                                                    ))
                                                )}
                                                {table.states && table.states.length > 3 && (
                                                    <span className="text-xs text-gray-500">+{table.states.length - 3}</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex gap-1 flex-wrap">
                                                {!table.customer_profiles || table.customer_profiles.length === 0 ? (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                                                        Qualquer
                                                    </span>
                                                ) : (
                                                    table.customer_profiles.slice(0, 2).map(p => (
                                                        <span key={p} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-50 text-purple-700 border border-purple-100">
                                                            {p}
                                                        </span>
                                                    ))
                                                )}
                                                {table.customer_profiles && table.customer_profiles.length > 2 && (
                                                    <span className="text-xs text-gray-500">+{table.customer_profiles.length - 2}</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-600">
                                            {table.commission_pct ? `${table.commission_pct}%` : '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            <span
                                                className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${table.is_active
                                                    ? 'bg-green-100 text-green-800'
                                                    : 'bg-red-100 text-red-800'
                                                    }`}
                                            >
                                                {table.is_active ? 'Ativa' : 'Inativa'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <div className="flex justify-end items-center gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-gray-500 hover:text-brand-600 hover:bg-brand-50"
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
                                                    className="h-8 w-8 text-gray-500 hover:text-brand-600 hover:bg-brand-50"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        router.push(`/app/cadastros/tabelas-de-preco/${table.id}`);
                                                    }}
                                                    title="Editar"
                                                >
                                                    <Pencil className="w-4 h-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDelete(table.id, table.name);
                                                    }}
                                                    title="Excluir"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}