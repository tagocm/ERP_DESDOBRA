"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useCompany } from "@/contexts/CompanyContext";
import { createClient } from "@/lib/supabaseBrowser";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { Plus, Search, Trash2, Edit2, Package, Layers, Wheat, Box, Calendar } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useToast } from "@/components/ui/use-toast";
import { PageHeader } from "@/components/ui/PageHeader";
import { ListPagination } from "@/components/ui/ListPagination";
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

interface ItemsListViewProps {
  title: string;
  subtitle: string;
  showCreateButton?: boolean;
  showActions?: boolean;
  rowHrefBase?: string;
  createHref?: string;
  paginationLabel?: string;
  enableSuccessToast?: boolean;
  headerContent?: React.ReactNode;
  showBalanceDateFilter?: boolean;
}

interface InventoryMovementRow {
  qty_in: number | null;
  qty_out: number | null;
  qty_base: number | null;
  occurred_at: string | null;
  created_at: string | null;
}

function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const ITEM_TYPES = [
  { value: "raw_material", label: "Matéria-Prima" },
  { value: "packaging", label: "Embalagem" },
  { value: "wip", label: "Semi-Acabado" },
  { value: "finished_good", label: "Produto Acabado" },
  { value: "service", label: "Serviço" },
];

export function ItemsListView({
  title,
  subtitle,
  showCreateButton = false,
  showActions = false,
  rowHrefBase = "/app/cadastros/produtos",
  createHref = "/app/cadastros/produtos/novo",
  paginationLabel = "itens",
  enableSuccessToast = false,
  headerContent,
  showBalanceDateFilter = false,
}: ItemsListViewProps) {
  const { selectedCompany } = useCompany();
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [items, setItems] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [balanceDate, setBalanceDate] = useState<string>(() => toDateInputValue(new Date()));

  const toastShown = useRef(false);
  const PAGE_SIZE = 100;

  useEffect(() => {
    if (!enableSuccessToast || toastShown.current) return;

    const success = searchParams?.get("success");
    if (success === "created") {
      toast({ title: "Item criado com sucesso!", variant: "default" });
      toastShown.current = true;
      window.history.replaceState(null, "", "/app/cadastros/produtos");
    } else if (success === "updated") {
      toast({ title: "Item atualizado com sucesso!", variant: "default" });
      toastShown.current = true;
      window.history.replaceState(null, "", "/app/cadastros/produtos");
    }
  }, [enableSuccessToast, searchParams, toast]);

  const fetchItems = useCallback(async () => {
    if (!selectedCompany) return;

    setIsLoading(true);
    try {
      let query = supabase
        .from("items")
        .select("*, uoms(abbrev)")
        .eq("company_id", selectedCompany.id)
        .is("deleted_at", null)
        .order("name", { ascending: true });

      if (typeFilter !== "all") {
        query = query.eq("type", typeFilter);
      }

      if (search) {
        query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;

      const balanceDateEnd = showBalanceDateFilter
        ? new Date(`${balanceDate}T23:59:59.999`)
        : null;

      const itemsWithStock = await Promise.all(
        (data || []).map(async (item) => {
          const { data: movements } = await supabase
            .from("inventory_movements")
            .select("qty_in, qty_out, qty_base, occurred_at, created_at")
            .eq("company_id", selectedCompany.id)
            .eq("item_id", item.id);

          const stock = (movements as InventoryMovementRow[] | null)?.reduce((acc, movement) => {
            if (balanceDateEnd) {
              const movementDateRaw = movement.occurred_at ?? movement.created_at;
              if (!movementDateRaw) return acc;

              const movementDate = new Date(movementDateRaw);
              if (Number.isNaN(movementDate.getTime()) || movementDate > balanceDateEnd) {
                return acc;
              }
            }

            const qtyIn = Number(movement.qty_in ?? 0);
            const qtyOut = Number(movement.qty_out ?? 0);

            if (qtyIn !== 0 || qtyOut !== 0) {
              return acc + qtyIn - qtyOut;
            }

            return acc + Number(movement.qty_base ?? 0);
          }, 0) || 0;

          return {
            ...item,
            current_stock: stock,
          };
        })
      );

      setItems(itemsWithStock);
    } catch (error) {
      console.error("Error fetching items:", error);
    } finally {
      setIsLoading(false);
    }
  }, [balanceDate, search, selectedCompany, showBalanceDateFilter, supabase, typeFilter]);

  useEffect(() => {
    if (selectedCompany) {
      void fetchItems();
    }
  }, [fetchItems, selectedCompany]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, typeFilter]);

  const totalItems = items.length;
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const pagedItems = items.slice(startIndex, startIndex + PAGE_SIZE);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Tem certeza que deseja excluir este item?")) return;

    try {
      const { error } = await supabase
        .from("items")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;
      await fetchItems();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro desconhecido";
      console.error("Error deleting item:", error);
      alert(`Erro ao excluir item: ${message}`);
    }
  };

  const getTypeLabel = (type: string) => ITEM_TYPES.find((itemType) => itemType.value === type)?.label || type;

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "raw_material":
        return <Wheat className="w-5 h-5" />;
      case "packaging":
        return <Box className="w-5 h-5" />;
      case "wip":
        return <Layers className="w-5 h-5" />;
      case "finished_good":
        return <Package className="w-5 h-5" />;
      default:
        return <Package className="w-5 h-5" />;
    }
  };

  const tableColSpan = showActions ? 8 : 7;

  return (
    <div>
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={
          showCreateButton ? (
            <Button onClick={() => router.push(createHref)}>
              <Plus className="w-4 h-4 mr-2" />
              Novo Item
            </Button>
          ) : undefined
        }
      >
        {headerContent}
      </PageHeader>

      <div className="max-w-screen-2xl mx-auto px-6 h-full">
        <div className="mb-6 flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar por nome ou SKU..."
              className="pl-10 h-10 rounded-2xl bg-white border-gray-200"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          {showBalanceDateFilter && (
            <div className="relative w-52">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              <Input
                type="date"
                className="pl-10 h-10 rounded-2xl bg-white border-gray-200"
                value={balanceDate}
                onChange={(event) => setBalanceDate(event.target.value)}
                aria-label="Data do saldo"
              />
            </div>
          )}
          <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value)}>
            <SelectTrigger className="w-48 h-10 rounded-2xl bg-white border-gray-200">
              <SelectValue placeholder="Todos os tipos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              {ITEM_TYPES.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Card className="overflow-hidden">
          <Table>
            <TableHeader className="bg-white">
              <TableRow className="hover:bg-transparent border-gray-200">
                <TableHead className="px-6 h-10 text-xs font-bold text-gray-500 uppercase tracking-wider">SKU</TableHead>
                <TableHead className="px-6 h-10 text-xs font-bold text-gray-500 uppercase tracking-wider">Nome</TableHead>
                <TableHead className="px-6 h-10 text-xs font-bold text-gray-500 uppercase tracking-wider">Tipo</TableHead>
                <TableHead className="px-6 h-10 text-xs font-bold text-gray-500 uppercase tracking-wider">UOM</TableHead>
                <TableHead className="px-6 h-10 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Estoque</TableHead>
                <TableHead className="px-6 h-10 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Custo Médio</TableHead>
                <TableHead className="px-6 h-10 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Status</TableHead>
                {showActions && (
                  <TableHead className="px-6 h-10 text-xs font-bold text-gray-500 uppercase tracking-wider text-right pr-6">
                    Ações
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={tableColSpan} className="px-6 py-12 text-center text-gray-500">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={tableColSpan} className="px-6 py-12 text-center text-gray-500">
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
                pagedItems.map((item) => (
                  <TableRow
                    key={item.id}
                    className={`group border-gray-100 hover:bg-gray-50 transition-colors ${
                      showActions ? "cursor-pointer" : ""
                    }`}
                    onClick={
                      showActions
                        ? () => router.push(`${rowHrefBase}/${item.id}`)
                        : undefined
                    }
                  >
                    <TableCell className="px-6 py-4">
                      <span className="text-xs font-mono font-bold text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100">
                        {item.sku || "-"}
                      </span>
                    </TableCell>
                    <TableCell className="px-6 py-4">
                      <div className="flex items-center">
                        <Card className="flex-shrink-0 h-9 w-9 bg-brand-50 flex items-center justify-center text-brand-600 border-brand-100/50 mr-3">
                          {getTypeIcon(item.type)}
                        </Card>
                        <div className="text-sm font-bold text-gray-900 leading-tight">{item.name}</div>
                      </div>
                    </TableCell>
                    <TableCell className="px-6 py-4">
                      <span className="text-xs font-medium text-gray-500">{getTypeLabel(item.type)}</span>
                    </TableCell>
                    <TableCell className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider bg-gray-50 px-1.5 py-0.5 rounded-2xl border border-gray-100 w-fit">
                          {item.uoms?.abbrev || item.uom}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="px-6 py-4 text-right">
                      <span
                        className={
                          item.current_stock && item.current_stock < 0
                            ? "text-red-600 font-bold"
                            : "text-gray-900 font-bold"
                        }
                      >
                        {item.current_stock?.toFixed(2) || "0.00"}
                      </span>
                    </TableCell>
                    <TableCell className="px-6 py-4 text-right">
                      <span className="text-gray-600 font-medium">R$ {item.avg_cost.toFixed(2)}</span>
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
                    {showActions && (
                      <TableCell className="px-6 py-4 text-right pr-6">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-2xl hover:bg-brand-50 hover:text-brand-600 text-gray-400 transition-colors"
                            onClick={(event) => {
                              event.stopPropagation();
                              router.push(`${rowHrefBase}/${item.id}`);
                            }}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-2xl hover:bg-red-50 hover:text-red-600 text-gray-400 transition-colors"
                            onClick={(event) => handleDelete(item.id, event)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
        <ListPagination
          page={currentPage}
          pageSize={PAGE_SIZE}
          total={totalItems}
          onPageChange={setCurrentPage}
          label={paginationLabel}
          disabled={isLoading}
        />
      </div>
    </div>
  );
}
