"use client";

import { useEffect, useState } from "react";
import { useCompany } from "@/contexts/CompanyContext";
import { createClient } from "@/lib/supabaseBrowser";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { Plus, Search, Trash2, Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";


interface Item {
    id: string;
    sku: string | null;
    name: string;
    type: string;
    uom: string;
    is_active: boolean;
    avg_cost: number;
    current_stock?: number;
}

const ITEM_TYPES = [
    { value: 'raw_material', label: 'Matéria-Prima' },
    { value: 'packaging', label: 'Embalagem' },
    { value: 'wip', label: 'Semi-Acabado' },
    { value: 'finished_good', label: 'Produto Acabado' },
    { value: 'service', label: 'Serviço' }
];

export default function ItemsPage() {
    const { selectedCompany } = useCompany();
    const supabase = createClient();
    const router = useRouter();

    const [items, setItems] = useState<Item[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [typeFilter, setTypeFilter] = useState<string>("all");



    useEffect(() => {
        if (selectedCompany) {
            fetchItems();
        }
    }, [selectedCompany, search, typeFilter]);

    const fetchItems = async () => {
        if (!selectedCompany) return;

        setIsLoading(true);
        try {
            let query = supabase
                .from('items')
                .select('*')
                .eq('company_id', selectedCompany.id)
                .is('deleted_at', null)
                .order('name', { ascending: true });

            if (typeFilter !== 'all') {
                query = query.eq('type', typeFilter);
            }

            if (search) {
                query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%`);
            }

            const { data, error } = await query;

            if (error) throw error;

            // Get stock for each item
            const itemsWithStock = await Promise.all(
                (data || []).map(async (item) => {
                    const { data: movements } = await supabase
                        .from('inventory_movements')
                        .select('qty_in, qty_out')
                        .eq('company_id', selectedCompany.id)
                        .eq('item_id', item.id);

                    const stock = movements?.reduce((acc, mov) => acc + mov.qty_in - mov.qty_out, 0) || 0;

                    return {
                        ...item,
                        current_stock: stock
                    };
                })
            );

            setItems(itemsWithStock);
        } catch (error) {
            console.error('Error fetching items:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Tem certeza que deseja excluir este item?')) return;

        try {
            const { error } = await supabase
                .from('items')
                .update({ deleted_at: new Date().toISOString() })
                .eq('id', id);

            if (error) throw error;
            fetchItems();
        } catch (error: any) {
            console.error('Error deleting item:', error);
            alert(`Erro ao excluir item: ${error?.message || 'Erro desconhecido'}`);
        }
    };



    const getTypeLabel = (type: string) => {
        return ITEM_TYPES.find(t => t.value === type)?.label || type;
    };

    return (
        <div>
            <PageHeader
                title="Produtos"
                subtitle="Gerencie produtos, materia-primas e insumos"
                actions={
                    <Button onClick={() => router.push("/app/cadastros/produtos/novo")}>
                        <Plus className="w-4 h-4 mr-2" />
                        Novo Item
                    </Button>
                }
            />

            <div className="max-w-[1600px] mx-auto px-6 h-full">
                <div className="mb-6 flex gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                            placeholder="Buscar por nome ou SKU..."
                            className="pl-10"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <Select
                        value={typeFilter}
                        onValueChange={(val) => setTypeFilter(val)}
                    >
                        <SelectTrigger className="w-48">
                            <SelectValue placeholder="Todos os tipos" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todos os tipos</SelectItem>
                            {ITEM_TYPES.map(type => (
                                <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    SKU
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Nome
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Tipo
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    UOM
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Estoque
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Custo Médio
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
                                    <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                                        Carregando...
                                    </td>
                                </tr>
                            ) : items.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="text-4xl">📦</div>
                                            <p className="text-lg font-medium">Nenhum item encontrado</p>
                                            <p className="text-sm">
                                                Comece cadastrando seus itens de estoque.
                                            </p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                items.map((item) => (
                                    <tr
                                        key={item.id}
                                        className="hover:bg-gray-50 cursor-pointer"
                                        onClick={() => router.push(`/app/cadastros/produtos/${item.id}`)}
                                    >
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-600">
                                            {item.sku || '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-medium text-gray-900">{item.name}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                            {getTypeLabel(item.type)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                            {item.uom}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 font-medium">
                                            {item.current_stock?.toFixed(2) || '0.00'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                                            R$ {item.avg_cost.toFixed(2)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            <span
                                                className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${item.is_active
                                                    ? 'bg-green-100 text-green-800'
                                                    : 'bg-red-100 text-red-800'
                                                    }`}
                                            >
                                                {item.is_active ? 'Ativo' : 'Inativo'}
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
                                                        router.push(`/app/cadastros/produtos/${item.id}`);
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
                                                        handleDelete(item.id);
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
