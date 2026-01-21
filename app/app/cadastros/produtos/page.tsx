"use client";

import { useEffect, useState, useRef } from "react";
import { useCompany } from "@/contexts/CompanyContext";
import { createClient } from "@/lib/supabaseBrowser";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { Plus, Search, Trash2, Edit2, Package, Layers, Wheat, Box } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useToast } from "@/components/ui/use-toast";
import { PageHeader } from "@/components/ui/PageHeader";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";


interface Item {
    id: string;
    sku: string | null;
    name: string;
    type: string;
    uom: string;
    uom_id?: string | null;
    uoms?: { abbrev: string } | null;
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



    const searchParams = useSearchParams();
    const { toast } = useToast();
    const toastShown = useRef(false);

    useEffect(() => {
        if (toastShown.current) return;

        const success = searchParams?.get("success");
        if (success === "created") {
            toast({ title: "Item criado com sucesso!", variant: "default" });
            toastShown.current = true;
            // Optional: Clean URL
            window.history.replaceState(null, '', '/app/cadastros/produtos');
        } else if (success === "updated") {
            toast({ title: "Item atualizado com sucesso!", variant: "default" });
            toastShown.current = true;
            window.history.replaceState(null, '', '/app/cadastros/produtos');
        }
    }, [searchParams]);

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
                .select('*, uoms(abbrev)')
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

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
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

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'raw_material': return <Wheat className="w-5 h-5" />;
            case 'packaging': return <Box className="w-5 h-5" />;
            case 'wip': return <Layers className="w-5 h-5" />;
            case 'finished_good': return <Package className="w-5 h-5" />;
            default: return <Package className="w-5 h-5" />;
        }
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
                            className="pl-10 h-10 rounded-xl bg-white border-gray-200"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <Select
                        value={typeFilter}
                        onValueChange={(val) => setTypeFilter(val)}
                    >
                        <SelectTrigger className="w-48 h-10 rounded-xl bg-white border-gray-200">
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

                <div className="overflow-hidden border border-gray-200 rounded-2xl bg-white shadow-sm">
                    <Table>
                        <TableHeader className="bg-gray-50/50">
                            <TableRow className="hover:bg-transparent border-gray-100">
                                <TableHead className="px-6 h-10 text-xs font-bold text-gray-500 uppercase tracking-wider">SKU</TableHead>
                                <TableHead className="px-6 h-10 text-xs font-bold text-gray-500 uppercase tracking-wider">Nome</TableHead>
                                <TableHead className="px-6 h-10 text-xs font-bold text-gray-500 uppercase tracking-wider">Tipo</TableHead>
                                <TableHead className="px-6 h-10 text-xs font-bold text-gray-500 uppercase tracking-wider">UOM</TableHead>
                                <TableHead className="px-6 h-10 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Estoque</TableHead>
                                <TableHead className="px-6 h-10 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Custo Médio</TableHead>
                                <TableHead className="px-6 h-10 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Status</TableHead>
                                <TableHead className="px-6 h-10 text-xs font-bold text-gray-500 uppercase tracking-wider text-right pr-6">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={8} className="px-6 py-12 text-center text-gray-500">
                                        Carregando...
                                    </TableCell>
                                </TableRow>
                            ) : items.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={8} className="px-6 py-12 text-center text-gray-500">
                                        <div className="flex flex-col items-center gap-3">
                                            <Package className="w-12 h-12 text-gray-300 opacity-50" />
                                            <p className="text-lg font-medium">Nenhum item encontrado</p>
                                            <p className="text-xs text-gray-400">
                                                Comece cadastrando seus itens de estoque.
                                            </p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                items.map((item) => (
                                    <TableRow
                                        key={item.id}
                                        className="group border-gray-50 hover:bg-gray-50/50 transition-colors cursor-pointer"
                                        onClick={() => router.push(`/app/cadastros/produtos/${item.id}`)}
                                    >
                                        <TableCell className="px-6 py-4">
                                            <span className="text-xs font-mono font-bold text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100">
                                                {item.sku || '-'}
                                            </span>
                                        </TableCell>
                                        <TableCell className="px-6 py-4">
                                            <div className="flex items-center">
                                                <div className="flex-shrink-0 h-9 w-9 bg-brand-50 rounded-xl flex items-center justify-center text-brand-600 shadow-sm border border-brand-100/50 mr-3">
                                                    {getTypeIcon(item.type)}
                                                </div>
                                                <div className="text-sm font-bold text-gray-900 leading-tight">
                                                    {item.name}
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="px-6 py-4">
                                            <span className="text-xs font-medium text-gray-500">{getTypeLabel(item.type)}</span>
                                        </TableCell>
                                        <TableCell className="px-6 py-4">
                                            <div className="flex flex-col gap-1">
                                                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100 w-fit">
                                                    {item.uoms?.abbrev || item.uom}
                                                </span>
                                                {/* Dev-Only Inconsistency Warning */}
                                                {(process.env.NODE_ENV === 'development' && item.uoms?.abbrev && item.uoms.abbrev !== item.uom) && (
                                                    <span className="text-[10px] text-red-500 bg-red-50 px-1 rounded border border-red-100 w-fit" title={`Legacy UOM: ${item.uom} vs Ref: ${item.uoms.abbrev}`}>
                                                        Inconsistente
                                                    </span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="px-6 py-4 text-right">
                                            <span className={item.current_stock && item.current_stock < 0 ? "text-red-600 font-bold" : "text-gray-900 font-bold"}>
                                                {item.current_stock?.toFixed(2) || '0.00'}
                                            </span>
                                        </TableCell>
                                        <TableCell className="px-6 py-4 text-right">
                                            <span className="text-gray-600 font-medium">
                                                R$ {item.avg_cost.toFixed(2)}
                                            </span>
                                        </TableCell>
                                        <TableCell className="px-6 py-4 text-center">
                                            {item.is_active ? (
                                                <span className="inline-flex px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-green-700 bg-green-50 border border-green-100 rounded-full">
                                                    Ativo
                                                </span>
                                            ) : (
                                                <span className="inline-flex px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 bg-gray-50 border border-gray-100 rounded-full">
                                                    Inativo
                                                </span>
                                            )}
                                        </TableCell>
                                        <TableCell className="px-6 py-4 text-right pr-6">
                                            <div className="flex justify-end gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 rounded-lg hover:bg-brand-50 hover:text-brand-600 text-gray-400 transition-colors"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        router.push(`/app/cadastros/produtos/${item.id}`);
                                                    }}
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 rounded-lg hover:bg-red-50 hover:text-red-600 text-gray-400 transition-colors"
                                                    onClick={(e) => handleDelete(item.id, e)}
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
                </div>
            </div>
        </div>
    );
}
