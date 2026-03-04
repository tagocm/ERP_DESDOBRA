"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { InventoryModuleTabs } from "@/components/inventory/InventoryModuleTabs";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Switch } from "@/components/ui/Switch";
import { Label } from "@/components/ui/Label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Save, CheckCircle2, Printer } from "lucide-react";
import {
  getInventoryCountDetailAction,
  postInventoryCountAction,
  updateInventoryCountLinesAction,
} from "@/app/actions/inventory-counts";
import type { InventoryCountDetail, InventoryCountLine, InventoryCountLinePatch, InventoryCountStatus } from "@/lib/inventory/inventory-counts";

function statusLabel(status: InventoryCountStatus): string {
  if (status === "DRAFT") return "Rascunho";
  if (status === "POSTED") return "Postado";
  return "Cancelado";
}

function statusClass(status: InventoryCountStatus): string {
  if (status === "DRAFT") return "bg-amber-50 text-amber-700 border-amber-200";
  if (status === "POSTED") return "bg-green-50 text-green-700 border-green-200";
  return "bg-gray-100 text-gray-700 border-gray-200";
}

function normalizeText(value: string | null): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

const quantityFormatter = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatQuantity(value: number): string {
  return quantityFormatter.format(value);
}

export function InventoryCountDetailClient({ inventoryCountId }: { inventoryCountId: string }) {
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isPosting, setIsPosting] = useState(false);

  const [detail, setDetail] = useState<InventoryCountDetail | null>(null);
  const [lastSavedLines, setLastSavedLines] = useState<Map<string, InventoryCountLine>>(new Map());

  const [search, setSearch] = useState("");
  const [onlyDivergences, setOnlyDivergences] = useState(false);
  const [onlyNotCounted, setOnlyNotCounted] = useState(false);

  const [isPostModalOpen, setIsPostModalOpen] = useState(false);

  const loadDetail = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getInventoryCountDetailAction(inventoryCountId);
      setDetail(data);
      setLastSavedLines(new Map(data.lines.map((line) => [line.id, line])));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao carregar inventário.";
      toast({ title: "Erro", description: message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [inventoryCountId, toast]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const isDraft = detail?.status === "DRAFT";

  const filteredLines = useMemo(() => {
    if (!detail) return [];

    const term = search.trim().toLowerCase();

    return detail.lines.filter((line) => {
      if (term) {
        const sku = line.itemSku?.toLowerCase() ?? "";
        const matches = line.itemName.toLowerCase().includes(term) || sku.includes(term);
        if (!matches) {
          return false;
        }
      }

      if (onlyDivergences && line.countedQtyBase !== null && line.diffQtyBase === 0) {
        return false;
      }

      if (onlyNotCounted && line.countedQtyBase !== null) {
        return false;
      }

      return true;
    });
  }, [detail, search, onlyDivergences, onlyNotCounted]);

  const pendingPatches = useMemo(() => {
    if (!detail || !isDraft) return [];

    const patches: InventoryCountLinePatch[] = [];

    for (const line of detail.lines) {
      const saved = lastSavedLines.get(line.id);
      if (!saved) continue;

      const countedChanged = (saved.countedQtyBase ?? null) !== (line.countedQtyBase ?? null);
      const notesChanged = normalizeText(saved.notes) !== normalizeText(line.notes);

      if (countedChanged || notesChanged) {
        patches.push({
          id: line.id,
          countedQtyBase: line.countedQtyBase,
          notes: normalizeText(line.notes),
        });
      }
    }

    return patches;
  }, [detail, isDraft, lastSavedLines]);

  const handleLineChange = (lineId: string, updates: Partial<InventoryCountLine>) => {
    setDetail((prev) => {
      if (!prev) return prev;

      const lines = prev.lines.map((line) => {
        if (line.id !== lineId) return line;

        const nextCounted = updates.countedQtyBase !== undefined ? updates.countedQtyBase : line.countedQtyBase;
        const nextDiff = nextCounted === null ? 0 : nextCounted - line.systemQtyBase;

        return {
          ...line,
          ...updates,
          countedQtyBase: nextCounted,
          diffQtyBase: nextDiff,
        };
      });

      return {
        ...prev,
        lines,
        totals: {
          totalItems: lines.length,
          countedItems: lines.filter((line) => line.countedQtyBase !== null).length,
          divergenceItems: lines.filter((line) => line.countedQtyBase !== null && line.diffQtyBase !== 0).length,
        },
      };
    });
  };

  const handleSave = async () => {
    if (!detail || pendingPatches.length === 0) {
      return;
    }

    setIsSaving(true);
    try {
      const updated = await updateInventoryCountLinesAction(detail.id, pendingPatches);
      setDetail(updated);
      setLastSavedLines(new Map(updated.lines.map((line) => [line.id, line])));
      toast({ title: "Salvo", description: "Contagens atualizadas." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao salvar contagens.";
      toast({ title: "Erro", description: message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePost = async () => {
    if (!detail) return;

    setIsPosting(true);
    try {
      const result = await postInventoryCountAction(detail.id);
      setDetail(result.detail);
      setLastSavedLines(new Map(result.detail.lines.map((line) => [line.id, line])));
      setIsPostModalOpen(false);
      toast({
        title: "Inventário postado",
        description: `Movimentos gerados: ${result.postedItems}`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao postar inventário.";
      toast({ title: "Erro", description: message, variant: "destructive" });
    } finally {
      setIsPosting(false);
    }
  };

  const handlePrintSheet = () => {
    if (typeof window === "undefined") {
      return;
    }

    window.open(`/api/inventory/counts/${inventoryCountId}/print`, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={detail?.number ? `Inventário #${detail.number}` : "Inventário"}
        subtitle={detail ? `Data da contagem: ${new Date(detail.countedAt).toLocaleDateString("pt-BR")}` : "Carregando..."}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={handlePrintSheet}>
              <Printer className="w-4 h-4 mr-2" />
              Imprimir Contagem
            </Button>
            {detail?.status === "POSTED" && (
              <Link href={`/app/estoque/movimentacoes?referenceType=inventory_count&referenceId=${inventoryCountId}`}>
                <Button variant="outline">Ver movimentos gerados</Button>
              </Link>
            )}
            {isDraft && (
              <>
                <Button variant="outline" onClick={handleSave} disabled={pendingPatches.length === 0 || isSaving}>
                  {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  Salvar
                </Button>
                <Button onClick={() => setIsPostModalOpen(true)}>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Postar Inventário
                </Button>
              </>
            )}
            {detail && <Badge className={statusClass(detail.status)}>{statusLabel(detail.status)}</Badge>}
          </div>
        }
      >
        <InventoryModuleTabs />
      </PageHeader>

      <div className="px-6 space-y-4">
        <Card>
          <CardContent className="p-4 flex flex-wrap items-end gap-4">
            <div className="w-full md:w-80 space-y-2">
              <Label>Busca</Label>
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por SKU ou item"
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch checked={onlyDivergences} onCheckedChange={setOnlyDivergences} />
              <Label>Somente divergências</Label>
            </div>

            <div className="flex items-center gap-2">
              <Switch checked={onlyNotCounted} onCheckedChange={setOnlyNotCounted} />
              <Label>Somente não contados</Label>
            </div>

            {detail && (
              <div className="ml-auto text-sm text-gray-600">
                Itens: <strong>{detail.totals.countedItems}/{detail.totals.totalItems}</strong> • Divergências: <strong>{detail.totals.divergenceItems}</strong>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full min-w-[1180px] table-fixed text-sm">
              <colgroup>
                <col className="w-[10%]" />
                <col className="w-[30%]" />
                <col className="w-[8%]" />
                <col className="w-[10%]" />
                <col className="w-[10%]" />
                <col className="w-[10%]" />
                <col className="w-[22%]" />
              </colgroup>
              <thead className="bg-white text-gray-500 font-semibold border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-center">SKU</th>
                  <th className="px-4 py-3 text-center">Item</th>
                  <th className="px-4 py-3 text-center">UOM</th>
                  <th className="px-4 py-3 text-center">Estoque</th>
                  <th className="px-4 py-3 text-center">Contagem física</th>
                  <th className="px-4 py-3 text-center">Diferença</th>
                  <th className="px-4 py-3 text-center">Observação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-10 text-center text-gray-500">
                      <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                    </td>
                  </tr>
                ) : filteredLines.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-10 text-center text-gray-500">Nenhuma linha para exibir.</td>
                  </tr>
                ) : (
                  filteredLines.map((line) => (
                    <tr key={line.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-xs font-mono text-gray-500">{line.itemSku ?? "S/ SKU"}</td>
                      <td className="px-4 py-2 font-medium text-gray-900">{line.itemName}</td>
                      <td className="px-4 py-2 text-gray-600">{line.uom ?? "UN"}</td>
                      <td className="px-4 py-2 text-right text-gray-700">{formatQuantity(line.systemQtyBase)}</td>
                      <td className="px-4 py-2 text-right">
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          className="h-8 w-36 ml-auto text-right"
                          value={line.countedQtyBase ?? ""}
                          disabled={!isDraft}
                          onChange={(event) => {
                            const value = event.target.value;
                            if (value === "") {
                              handleLineChange(line.id, { countedQtyBase: null });
                              return;
                            }
                            const parsed = Number.parseFloat(value);
                            if (Number.isFinite(parsed)) {
                              handleLineChange(line.id, { countedQtyBase: parsed });
                            }
                          }}
                        />
                      </td>
                      <td className="px-4 py-2 text-right">
                        <span className={line.diffQtyBase > 0 ? "text-green-700 font-semibold" : line.diffQtyBase < 0 ? "text-red-700 font-semibold" : "text-gray-600"}>
                          {line.diffQtyBase > 0 ? "+" : line.diffQtyBase < 0 ? "-" : ""}
                          {formatQuantity(Math.abs(line.diffQtyBase))}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <Input
                          className="h-8"
                          value={line.notes ?? ""}
                          disabled={!isDraft}
                          onChange={(event) => handleLineChange(line.id, { notes: event.target.value || null })}
                          placeholder="Observação da divergência"
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={isPostModalOpen} onOpenChange={setIsPostModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Postar inventário</DialogTitle>
            <DialogDescription>
              Após postar, o inventário ficará somente leitura e os ajustes serão lançados no ledger.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 text-sm text-gray-700">
            <p>Total de itens: <strong>{detail?.totals.totalItems ?? 0}</strong></p>
            <p>Itens contados: <strong>{detail?.totals.countedItems ?? 0}</strong></p>
            <p>Itens com divergência: <strong>{detail?.totals.divergenceItems ?? 0}</strong></p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPostModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handlePost} disabled={isPosting}>
              {isPosting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Confirmar postagem
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
