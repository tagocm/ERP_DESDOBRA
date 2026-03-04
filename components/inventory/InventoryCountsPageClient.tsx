"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { InventoryModuleTabs } from "@/components/inventory/InventoryModuleTabs";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/Dialog";
import { Label } from "@/components/ui/Label";
import { Textarea } from "@/components/ui/Textarea";
import { Badge } from "@/components/ui/Badge";
import { Checkbox } from "@/components/ui/Checkbox";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Plus, Search } from "lucide-react";
import {
  createInventoryCountDraftAction,
  listControlledStockItemsAction,
  listInventoryCountsAction,
} from "@/app/actions/inventory-counts";
import type { InventoryCountItem, InventoryCountSummary, InventoryCountStatus } from "@/lib/inventory/inventory-counts";
import { todayInBrasilia } from "@/lib/utils";

const STATUS_OPTIONS: Array<{ value: "all" | InventoryCountStatus; label: string }> = [
  { value: "all", label: "Todos os status" },
  { value: "DRAFT", label: "Rascunho" },
  { value: "POSTED", label: "Postado" },
  { value: "CANCELED", label: "Cancelado" },
];

function formatStatus(status: InventoryCountStatus): string {
  if (status === "DRAFT") return "Rascunho";
  if (status === "POSTED") return "Postado";
  return "Cancelado";
}

function statusBadgeClass(status: InventoryCountStatus): string {
  if (status === "DRAFT") return "bg-amber-50 text-amber-700 border-amber-200";
  if (status === "POSTED") return "bg-green-50 text-green-700 border-green-200";
  return "bg-gray-100 text-gray-700 border-gray-200";
}

function todayDateInputValue(): string {
  return todayInBrasilia();
}

export function InventoryCountsPageClient() {
  const router = useRouter();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [counts, setCounts] = useState<InventoryCountSummary[]>([]);
  const [statusFilter, setStatusFilter] = useState<"all" | InventoryCountStatus>("all");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [scope, setScope] = useState<"all_controlled" | "selected_items">("all_controlled");
  const [countedAt, setCountedAt] = useState<string>(todayDateInputValue());
  const [notes, setNotes] = useState<string>("");

  const [controlledItems, setControlledItems] = useState<InventoryCountItem[]>([]);
  const [itemSearch, setItemSearch] = useState("");
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);

  const loadCounts = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await listInventoryCountsAction(
        statusFilter === "all" ? undefined : { status: statusFilter }
      );
      setCounts(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao carregar inventários.";
      toast({ title: "Erro", description: message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, toast]);

  const loadControlledItems = useCallback(async () => {
    try {
      const data = await listControlledStockItemsAction();
      setControlledItems(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao carregar itens controlados.";
      toast({ title: "Erro", description: message, variant: "destructive" });
    }
  }, [toast]);

  useEffect(() => {
    void loadCounts();
  }, [loadCounts]);

  useEffect(() => {
    if (isModalOpen) {
      void loadControlledItems();
    }
  }, [isModalOpen, loadControlledItems]);

  const filteredItems = useMemo(() => {
    const term = itemSearch.trim().toLowerCase();
    if (!term) return controlledItems;
    return controlledItems.filter((item) => {
      const sku = item.sku?.toLowerCase() ?? "";
      return item.name.toLowerCase().includes(term) || sku.includes(term);
    });
  }, [controlledItems, itemSearch]);

  const handleToggleItem = (itemId: string, checked: boolean) => {
    setSelectedItemIds((prev) => {
      if (checked) {
        if (prev.includes(itemId)) return prev;
        return [...prev, itemId];
      }
      return prev.filter((id) => id !== itemId);
    });
  };

  const handleOpenCreate = () => {
    setScope("all_controlled");
    setCountedAt(todayDateInputValue());
    setNotes("");
    setItemSearch("");
    setSelectedItemIds([]);
    setIsModalOpen(true);
  };

  const handleCreateDraft = async () => {
    if (scope === "selected_items" && selectedItemIds.length === 0) {
      toast({ title: "Validação", description: "Selecione pelo menos um item para iniciar a contagem.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await createInventoryCountDraftAction({
        countedAt,
        notes: notes.trim() || null,
        scope,
        itemIds: scope === "selected_items" ? selectedItemIds : undefined,
      });

      setIsModalOpen(false);
      toast({ title: "Inventário criado", description: `Inventário #${created.number ?? "-"} iniciado com sucesso.` });
      router.push(`/app/estoque/inventarios/${created.id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível iniciar o inventário.";
      toast({ title: "Erro", description: message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventários"
        subtitle="Contagens físicas e ajustes de estoque com histórico"
        actions={
          <Button onClick={handleOpenCreate}>
            <Plus className="w-4 h-4 mr-2" />
            Novo Inventário
          </Button>
        }
      >
        <InventoryModuleTabs />
      </PageHeader>

      <div className="px-6 space-y-4">
        <Card>
          <CardContent className="p-4 flex flex-wrap gap-3">
            <div className="w-full md:w-56">
              <Select value={statusFilter} onValueChange={(value: "all" | InventoryCountStatus) => setStatusFilter(value)}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-white text-gray-500 font-semibold border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left">Nº</th>
                  <th className="px-6 py-3 text-left">Data</th>
                  <th className="px-6 py-3 text-center">Status</th>
                  <th className="px-6 py-3 text-right">Itens</th>
                  <th className="px-6 py-3 text-right">Divergências</th>
                  <th className="px-6 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-gray-500">
                      <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                    </td>
                  </tr>
                ) : counts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-gray-500">
                      Nenhum inventário registrado.
                    </td>
                  </tr>
                ) : (
                  counts.map((count) => (
                    <tr key={count.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-3 font-semibold text-gray-800">#{count.number ?? "-"}</td>
                      <td className="px-6 py-3 text-gray-700">{new Date(count.countedAt).toLocaleDateString("pt-BR")}</td>
                      <td className="px-6 py-3 text-center">
                        <Badge className={statusBadgeClass(count.status)}>{formatStatus(count.status)}</Badge>
                      </td>
                      <td className="px-6 py-3 text-right text-gray-700">{count.totals.countedItems}/{count.totals.totalItems}</td>
                      <td className="px-6 py-3 text-right font-medium text-gray-800">{count.totals.divergenceItems}</td>
                      <td className="px-6 py-3 text-right">
                        <Button variant="outline" size="sm" onClick={() => router.push(`/app/estoque/inventarios/${count.id}`)}>
                          Abrir
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Novo Inventário</DialogTitle>
            <DialogDescription>Crie uma contagem física para comparar com o estoque do sistema.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data do inventário</Label>
                <Input type="date" value={countedAt} onChange={(event) => setCountedAt(event.target.value)} />
              </div>

              <div className="space-y-2">
                <Label>Escopo</Label>
                <Select value={scope} onValueChange={(value: "all_controlled" | "selected_items") => setScope(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all_controlled">Todos itens controlados</SelectItem>
                    <SelectItem value="selected_items">Itens selecionados</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                className="h-20"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Ex.: Inventário mensal de fechamento."
              />
            </div>

            {scope === "selected_items" && (
              <div className="space-y-3">
                <Label>Selecionar itens</Label>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
                  <Input
                    className="pl-9"
                    placeholder="Buscar por SKU ou nome"
                    value={itemSearch}
                    onChange={(event) => setItemSearch(event.target.value)}
                  />
                </div>
                <div className="max-h-56 border rounded-2xl overflow-auto divide-y divide-gray-100">
                  {filteredItems.length === 0 ? (
                    <div className="px-4 py-6 text-sm text-gray-500 text-center">Nenhum item encontrado.</div>
                  ) : (
                    filteredItems.map((item) => {
                      const checked = selectedItemIds.includes(item.id);
                      return (
                        <label key={item.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 cursor-pointer">
                          <Checkbox checked={checked} onCheckedChange={(state) => handleToggleItem(item.id, state === true)} />
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-gray-800">{item.name}</span>
                            <span className="text-xs text-gray-500 font-mono">{item.sku ?? "S/ SKU"} • {item.uom ?? "UN"}</span>
                          </div>
                        </label>
                      );
                    })
                  )}
                </div>
                <p className="text-xs text-gray-500">Selecionados: {selectedItemIds.length}</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateDraft} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Iniciar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
