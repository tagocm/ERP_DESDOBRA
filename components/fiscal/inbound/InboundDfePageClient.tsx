"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Checkbox } from "@/components/ui/Checkbox";
import { ListPagination } from "@/components/ui/ListPagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/use-toast";
import {
  CheckCircle2,
  Clock3,
  Copy,
  Download,
  FileText,
  ListTree,
  RefreshCw,
  Search,
  XCircle,
} from "lucide-react";
import type { DfeEnvironment } from "@/lib/fiscal/inbound/schemas";

type InboundTab = "pending" | "received" | "cancelled" | "processing" | "events";
type ManifestEventType = "CIENCIA" | "CONFIRMACAO" | "DESCONHECIMENTO" | "NAO_REALIZADA";

type InboundFiltersState = {
  dateFrom?: string;
  dateTo?: string;
  emitter?: string;
  chnfe?: string;
  manifestStatus?:
    | "SEM_MANIFESTACAO"
    | "CIENCIA"
    | "CONFIRMADA"
    | "DESCONHECIDA"
    | "NAO_REALIZADA";
  onlyFullXml?: boolean;
};

const InboundRowSchema = z.object({
  id: z.string().uuid(),
  environment: z.enum(["production", "homologation"]),
  nsu: z.string(),
  schema: z.string(),
  chnfe: z.string().nullable(),
  emit_cnpj: z.string().nullable(),
  emit_nome: z.string().nullable(),
  dh_emi: z.string().nullable(),
  total: z.number().nullable(),
  has_full_xml: z.boolean(),
  manifest_status: z.enum([
    "SEM_MANIFESTACAO",
    "CIENCIA",
    "CONFIRMADA",
    "DESCONHECIDA",
    "NAO_REALIZADA",
  ]),
  summary_json: z.record(z.string(), z.unknown()),
});

const EventRowSchema = z.object({
  id: z.string().uuid(),
  environment: z.enum(["production", "homologation"]),
  chnfe: z.string(),
  event_type: z.enum(["CIENCIA", "CONFIRMACAO", "DESCONHECIMENTO", "NAO_REALIZADA"]),
  status: z.enum(["PENDING", "SENT", "ERROR"]),
  sefaz_protocol: z.string().nullable(),
  last_error: z.string().nullable(),
  created_at: z.string(),
});

const ListResponseSchema = z.object({
  data: z.array(InboundRowSchema),
  pagination: z.object({
    page: z.number().int(),
    pageSize: z.number().int(),
    total: z.number().int(),
  }),
});

const EventsResponseSchema = z.object({
  data: z.array(EventRowSchema),
  pagination: z.object({
    page: z.number().int(),
    pageSize: z.number().int(),
    total: z.number().int(),
  }),
});

type InboundRow = z.infer<typeof InboundRowSchema>;
type EventRow = z.infer<typeof EventRowSchema>;

function formatCnpj(value: string | null): string {
  if (!value) return "-";
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 14) return value;
  return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
}

function formatDate(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("pt-BR");
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("pt-BR");
}

function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return "-";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function shortKey(value: string | null): string {
  if (!value) return "-";
  if (value.length <= 14) return value;
  return `${value.slice(0, 8)}...${value.slice(-6)}`;
}

function manifestLabel(status: InboundRow["manifest_status"]): string {
  switch (status) {
    case "SEM_MANIFESTACAO":
      return "Sem manifestação";
    case "CIENCIA":
      return "Ciência";
    case "CONFIRMADA":
      return "Confirmada";
    case "DESCONHECIDA":
      return "Desconhecida";
    case "NAO_REALIZADA":
      return "Não realizada";
  }
}

function statusLabel(row: InboundRow): string {
  const asText = JSON.stringify(row.summary_json).toLowerCase();
  if (asText.includes("cancelad") || asText.includes("cstat\":\"101")) {
    return "Cancelada";
  }
  return row.has_full_xml ? "Recebida" : "Em processamento";
}

function statusClass(row: InboundRow): string {
  const label = statusLabel(row);
  if (label === "Cancelada") return "bg-red-100 text-red-800";
  if (label === "Recebida") return "bg-green-100 text-green-800";
  return "bg-amber-100 text-amber-800";
}

function manifestClass(status: InboundRow["manifest_status"]): string {
  if (status === "CONFIRMADA") return "bg-green-100 text-green-800";
  if (status === "SEM_MANIFESTACAO") return "bg-gray-100 text-gray-700";
  if (status === "CIENCIA") return "bg-blue-100 text-blue-800";
  return "bg-rose-100 text-rose-800";
}

function eventTypeLabel(eventType: EventRow["event_type"]): string {
  switch (eventType) {
    case "CIENCIA":
      return "Ciência";
    case "CONFIRMACAO":
      return "Confirmação";
    case "DESCONHECIMENTO":
      return "Desconhecimento";
    case "NAO_REALIZADA":
      return "Operação não realizada";
  }
}

function eventStatusLabel(status: EventRow["status"]): string {
  if (status === "PENDING") return "Pendente";
  if (status === "SENT") return "Enviado";
  return "Erro";
}

function eventStatusClass(status: EventRow["status"]): string {
  if (status === "SENT") return "bg-green-100 text-green-800";
  if (status === "PENDING") return "bg-amber-100 text-amber-800";
  return "bg-red-100 text-red-800";
}

function buildListQuery(args: {
  environment: DfeEnvironment;
  tab: InboundTab;
  filters: InboundFiltersState;
  page: number;
  pageSize: number;
}): string {
  const params = new URLSearchParams();
  params.set("environment", args.environment);
  params.set("page", String(args.page));
  params.set("pageSize", String(args.pageSize));

  if (args.tab !== "events") {
    params.set("tab", args.tab);
  }

  if (args.filters.dateFrom) params.set("dateFrom", args.filters.dateFrom);
  if (args.filters.dateTo) params.set("dateTo", args.filters.dateTo);
  if (args.filters.emitter) params.set("emitter", args.filters.emitter);
  if (args.filters.chnfe) params.set("chnfe", args.filters.chnfe);
  if (args.filters.manifestStatus) params.set("manifestStatus", args.filters.manifestStatus);
  if (args.filters.onlyFullXml) params.set("onlyFullXml", "true");

  return params.toString();
}

function ManifestModal({
  open,
  row,
  onClose,
  onSubmitted,
}: {
  open: boolean;
  row: InboundRow | null;
  onClose: () => void;
  onSubmitted: () => Promise<void>;
}) {
  const { toast } = useToast();
  const [eventType, setEventType] = useState<ManifestEventType>("CIENCIA");
  const [justification, setJustification] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setEventType("CIENCIA");
      setJustification("");
      setSubmitting(false);
    }
  }, [open]);

  const needsJustification = eventType === "DESCONHECIMENTO" || eventType === "NAO_REALIZADA";

  const submit = async () => {
    if (!row) return;
    if (needsJustification && justification.trim().length < 15) {
      toast({
        title: "Justificativa inválida",
        description: "Informe no mínimo 15 caracteres.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`/api/fiscal/inbound/${row.id}/manifest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventType,
          justification: justification.trim() || undefined,
        }),
      });

      const payload: unknown = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message =
          typeof payload === "object" && payload !== null && "error" in payload
            ? String((payload as { error: unknown }).error)
            : "Falha ao enfileirar manifestação";
        throw new Error(message);
      }

      toast({ title: "Manifestação enfileirada", description: "O worker irá enviar o evento à SEFAZ." });
      await onSubmitted();
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao manifestar";
      toast({ title: "Erro", description: message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (!nextOpen ? onClose() : undefined)}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Manifestação do Destinatário</DialogTitle>
          <DialogDescription>
            Selecione o tipo de manifestação para a chave {row?.chnfe ? shortKey(row.chnfe) : "-"}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <label className="text-sm font-medium text-gray-700">Tipo de manifestação</label>
          <Select value={eventType} onValueChange={(value) => setEventType(value as ManifestEventType)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="CIENCIA">Ciência da operação</SelectItem>
              <SelectItem value="CONFIRMACAO">Confirmação da operação</SelectItem>
              <SelectItem value="DESCONHECIMENTO">Desconhecimento da operação</SelectItem>
              <SelectItem value="NAO_REALIZADA">Operação não realizada</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {needsJustification && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Justificativa</label>
            <Textarea
              value={justification}
              onChange={(event) => setJustification(event.target.value)}
              placeholder="Descreva o motivo..."
              rows={4}
              maxLength={1000}
            />
            <p className="text-xs text-gray-500 text-right">{justification.trim().length}/1000</p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? "Enviando..." : "Confirmar manifestação"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function InboundDfePageClient({
  initialEnvironment,
}: {
  initialEnvironment: DfeEnvironment;
}) {
  const { toast } = useToast();
  const [environment, setEnvironment] = useState<DfeEnvironment>(initialEnvironment);
  const [tab, setTab] = useState<InboundTab>("pending");
  const [filters, setFilters] = useState<InboundFiltersState>({});
  const [rows, setRows] = useState<InboundRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedRow, setSelectedRow] = useState<InboundRow | null>(null);

  const pageSize = tab === "events" ? 30 : 50;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      if (tab === "events") {
        const params = new URLSearchParams();
        params.set("environment", environment);
        params.set("page", String(page));
        params.set("pageSize", String(pageSize));

        const response = await fetch(`/api/fiscal/inbound/events?${params.toString()}`);
        const payloadUnknown: unknown = await response.json();

        if (!response.ok) {
          const message =
            typeof payloadUnknown === "object" && payloadUnknown !== null && "error" in payloadUnknown
              ? String((payloadUnknown as { error: unknown }).error)
              : "Falha ao carregar eventos";
          throw new Error(message);
        }

        const payload = EventsResponseSchema.parse(payloadUnknown);
        setEvents(payload.data);
        setTotal(payload.pagination.total);
        setRows([]);
      } else {
        const query = buildListQuery({
          environment,
          tab,
          filters,
          page,
          pageSize,
        });
        const response = await fetch(`/api/fiscal/inbound/list?${query}`);
        const payloadUnknown: unknown = await response.json();

        if (!response.ok) {
          const message =
            typeof payloadUnknown === "object" && payloadUnknown !== null && "error" in payloadUnknown
              ? String((payloadUnknown as { error: unknown }).error)
              : "Falha ao carregar NF-e de entrada";
          throw new Error(message);
        }

        const payload = ListResponseSchema.parse(payloadUnknown);
        setRows(payload.data);
        setTotal(payload.pagination.total);
        setEvents([]);
      }
    } catch (errorLoad) {
      const message = errorLoad instanceof Error ? errorLoad.message : "Erro ao carregar dados";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [environment, tab, filters, page, pageSize]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [environment, tab, filters]);

  const tabClassName = (active: boolean, activeClass: string) =>
    `px-4 py-2 -mb-px border-b-2 font-medium text-sm transition-colors ${
      active
        ? activeClass
        : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
    }`;

  const isEmpty = useMemo(() => {
    if (tab === "events") return events.length === 0;
    return rows.length === 0;
  }, [tab, events, rows]);

  const copyKey = async (key: string | null) => {
    if (!key) return;
    try {
      await navigator.clipboard.writeText(key);
      toast({ title: "Chave copiada" });
    } catch {
      toast({ title: "Não foi possível copiar a chave", variant: "destructive" });
    }
  };

  const downloadXml = (id: string) => {
    window.location.href = `/api/fiscal/inbound/${id}/xml`;
  };

  const openDanfe = (id: string) => {
    window.open(`/api/fiscal/inbound/${id}/danfe.pdf`, "_blank", "noopener,noreferrer");
  };

  const downloadDanfe = async (id: string, key: string | null) => {
    try {
      const response = await fetch(`/api/fiscal/inbound/${id}/danfe.pdf`);
      if (!response.ok) {
        const payload: unknown = await response.json().catch(() => ({}));
        const message =
          typeof payload === "object" && payload !== null && "error" in payload
            ? String((payload as { error: unknown }).error)
            : "Falha ao baixar PDF";
        throw new Error(message);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `danfe-entrada-${key ?? id}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (errorDownload) {
      const message = errorDownload instanceof Error ? errorDownload.message : "Erro ao baixar PDF";
      toast({ title: "Erro", description: message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 border-b border-gray-200 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <button
            className={tabClassName(tab === "pending", "border-blue-600 text-blue-600")}
            onClick={() => setTab("pending")}
          >
            <Clock3 className="w-4 h-4 inline-block mr-2" />
            Compras Pendentes
          </button>
          <button
            className={tabClassName(tab === "received", "border-green-600 text-green-600")}
            onClick={() => setTab("received")}
          >
            <CheckCircle2 className="w-4 h-4 inline-block mr-2" />
            NF-e Recebidas
          </button>
          <button
            className={tabClassName(tab === "cancelled", "border-red-600 text-red-600")}
            onClick={() => setTab("cancelled")}
          >
            <XCircle className="w-4 h-4 inline-block mr-2" />
            Canceladas
          </button>
          <button
            className={tabClassName(tab === "processing", "border-amber-600 text-amber-600")}
            onClick={() => setTab("processing")}
          >
            <RefreshCw className="w-4 h-4 inline-block mr-2" />
            Em processamento
          </button>
        </div>

        <button
          className={tabClassName(tab === "events", "border-indigo-600 text-indigo-600")}
          onClick={() => setTab("events")}
        >
          <ListTree className="w-4 h-4 inline-block mr-2" />
          Eventos
        </button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">Ambiente</label>
              <Select value={environment} onValueChange={(value) => setEnvironment(value as DfeEnvironment)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="production">Produção</SelectItem>
                  <SelectItem value="homologation">Homologação</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">Data inicial</label>
              <Input
                type="date"
                value={filters.dateFrom || ""}
                onChange={(event) => setFilters((prev) => ({ ...prev, dateFrom: event.target.value || undefined }))}
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">Data final</label>
              <Input
                type="date"
                value={filters.dateTo || ""}
                onChange={(event) => setFilters((prev) => ({ ...prev, dateTo: event.target.value || undefined }))}
              />
            </div>

            <div className="space-y-1 md:col-span-2">
              <label className="text-sm font-medium text-gray-700">Emitente (nome ou CNPJ)</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                <Input
                  className="pl-9"
                  placeholder="Digite para filtrar..."
                  value={filters.emitter || ""}
                  onChange={(event) => setFilters((prev) => ({ ...prev, emitter: event.target.value || undefined }))}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">Chave NF-e</label>
              <Input
                placeholder="44 dígitos"
                value={filters.chnfe || ""}
                onChange={(event) => setFilters((prev) => ({ ...prev, chnfe: event.target.value || undefined }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">Status de manifestação</label>
              <Select
                value={filters.manifestStatus || "ALL"}
                onValueChange={(value) =>
                  setFilters((prev) => ({
                    ...prev,
                    manifestStatus: value === "ALL" ? undefined : (value as InboundFiltersState["manifestStatus"]),
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos</SelectItem>
                  <SelectItem value="SEM_MANIFESTACAO">Sem manifestação</SelectItem>
                  <SelectItem value="CIENCIA">Ciência</SelectItem>
                  <SelectItem value="CONFIRMADA">Confirmada</SelectItem>
                  <SelectItem value="DESCONHECIDA">Desconhecida</SelectItem>
                  <SelectItem value="NAO_REALIZADA">Não realizada</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end pb-2">
              <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700">
                <Checkbox
                  checked={Boolean(filters.onlyFullXml)}
                  onCheckedChange={(checked) =>
                    setFilters((prev) => ({ ...prev, onlyFullXml: checked === true ? true : undefined }))
                  }
                />
                Somente com XML completo
              </label>
            </div>

            <div className="flex items-end justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => setFilters({})}
              >
                Limpar
              </Button>
              <Button onClick={() => void load()}>Aplicar filtros</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-center justify-between">
          <p className="text-sm text-red-800">{error}</p>
          <Button variant="outline" size="sm" onClick={() => void load()}>
            Tentar novamente
          </Button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">Carregando...</div>
      ) : isEmpty ? (
        <div className="text-center py-12 border rounded-2xl">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhum registro encontrado</h3>
          <p className="text-gray-500">Ajuste os filtros ou sincronize novamente para buscar documentos.</p>
        </div>
      ) : tab === "events" ? (
        <div className="overflow-x-auto rounded-2xl border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-white">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data/Hora</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Chave</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Evento</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Protocolo</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Detalhes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {events.map((event) => (
                <tr key={event.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-700">{formatDateTime(event.created_at)}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{shortKey(event.chnfe)}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{eventTypeLabel(event.event_type)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${eventStatusClass(event.status)}`}>
                      {eventStatusLabel(event.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">{event.sefaz_protocol || "-"}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{event.last_error || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-white">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data emissão</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Emitente</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">CNPJ emitente</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Chave</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Manifestação</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-700">{formatDate(row.dh_emi)}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">{row.emit_nome || "-"}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{formatCnpj(row.emit_cnpj)}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    <div className="flex items-center gap-2">
                      <span>{shortKey(row.chnfe)}</span>
                      {row.chnfe && (
                        <button
                          type="button"
                          className="text-gray-400 hover:text-gray-600"
                          onClick={() => void copyKey(row.chnfe)}
                          title="Copiar chave"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 text-right">{formatCurrency(row.total)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${statusClass(row)}`}>
                      {statusLabel(row)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${manifestClass(row.manifest_status)}`}>
                      {manifestLabel(row.manifest_status)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-full border-gray-200"
                        disabled={!row.has_full_xml}
                        onClick={() => downloadXml(row.id)}
                        title={row.has_full_xml ? "Baixar XML" : "XML indisponível"}
                      >
                        <Download className="w-4 h-4 mr-1" /> XML
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-full border-gray-200"
                        disabled={!row.has_full_xml}
                        onClick={() => openDanfe(row.id)}
                      >
                        Ver/Imprimir DANFE
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-full border-gray-200"
                        disabled={!row.has_full_xml}
                        onClick={() => void downloadDanfe(row.id, row.chnfe)}
                      >
                        Baixar PDF
                      </Button>
                      <Button
                        size="sm"
                        className="rounded-full"
                        disabled={!row.chnfe}
                        onClick={() => setSelectedRow(row)}
                      >
                        Manifestar
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ListPagination
        page={page}
        pageSize={pageSize}
        total={total}
        onPageChange={setPage}
        label={tab === "events" ? "eventos" : "notas"}
        disabled={loading}
      />

      <ManifestModal
        open={Boolean(selectedRow)}
        row={selectedRow}
        onClose={() => setSelectedRow(null)}
        onSubmitted={load}
      />
    </div>
  );
}
