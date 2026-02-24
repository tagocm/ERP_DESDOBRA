"use client";

import React from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Textarea } from "@/components/ui/Textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { useToast } from "@/components/ui/use-toast";
import {
    CreateInboundReversalRequestSchema,
    CreateInboundReversalResponseSchema,
    OutboundReversalDetailsResponseSchema,
    ReversalModeSchema,
    ReversalReasonCodeSchema,
    type OutboundReversalDetailsResponse,
} from "@/lib/fiscal/nfe/reversal/schemas";
import { REVERSAL_NATOP, REVERSAL_REASON_LABELS_PT, buildReversalInfCpl } from "@/lib/fiscal/nfe/reversal/texts";
import { z } from "zod";

type Mode = z.infer<typeof ReversalModeSchema>;
type ReasonCode = z.infer<typeof ReversalReasonCodeSchema>;

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    outboundEmissionId: string | null;
    disabled?: boolean;
    onCreated?: () => void;
};

function safeNumber(value: string): number | null {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
}

export function InboundReversalModal(props: Props) {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = React.useState(false);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [details, setDetails] = React.useState<OutboundReversalDetailsResponse | null>(null);

    const [mode, setMode] = React.useState<Mode>("TOTAL");
    const [reasonCode, setReasonCode] = React.useState<ReasonCode | null>(null);
    const [reasonOther, setReasonOther] = React.useState("");
    const [internalNotes, setInternalNotes] = React.useState("");

    const [qtyByNItem, setQtyByNItem] = React.useState<Map<number, string>>(new Map());

    const canLoad = props.open && typeof props.outboundEmissionId === "string" && props.outboundEmissionId.length > 0;

    React.useEffect(() => {
        if (!props.open) return;
        // Reset UI state on open to avoid bleeding between emissions.
        setDetails(null);
        setIsLoading(false);
        setIsSubmitting(false);
        setMode("TOTAL");
        setReasonCode(null);
        setReasonOther("");
        setInternalNotes("");
        setQtyByNItem(new Map());
    }, [props.open, props.outboundEmissionId]);

    React.useEffect(() => {
        if (!canLoad) return;

        let cancelled = false;
        setIsLoading(true);

        (async () => {
            try {
                const response = await fetch("/api/fiscal/nfe/reversal/outbound-details", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ outboundEmissionId: props.outboundEmissionId }),
                });

                const payloadUnknown: unknown = await response.json().catch(() => ({}));
                if (!response.ok) {
                    const maybeError = payloadUnknown as { error?: unknown };
                    const message = typeof maybeError?.error === "string" ? maybeError.error : "Falha ao carregar itens para estorno.";
                    throw new Error(message);
                }

                const parsed = OutboundReversalDetailsResponseSchema.parse(payloadUnknown);
                if (cancelled) return;

                setDetails(parsed);
                setQtyByNItem(new Map(parsed.items.map((it) => [it.nItem, String(it.quantity)])));
            } catch (e: unknown) {
                if (cancelled) return;
                const message = e instanceof Error ? e.message : "Falha ao carregar dados do estorno.";
                toast({ title: "Erro ao carregar estorno", description: message, variant: "destructive" });
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [canLoad, props.outboundEmissionId, toast]);

    const isPartial = mode === "PARCIAL";

    const infCplPreview = details && reasonCode
        ? buildReversalInfCpl({
            outboundAccessKey: details.emission.accessKey,
            reasonCode,
            reasonOther: reasonCode === "OUTROS" ? reasonOther : null,
            isPartial,
        })
        : "";

    const validateBeforeSubmit = (): { ok: true; selection: Array<{ nItem: number; qty: number; isProduced: boolean }> } | { ok: false; message: string } => {
        if (!details) return { ok: false, message: "Dados da NF-e não carregados." };
        if (!reasonCode) return { ok: false, message: "Selecione o motivo do estorno." };
        if (reasonCode === "OUTROS" && reasonOther.trim().length === 0) return { ok: false, message: "Informe o motivo em 'Outros'." };

        const selection: Array<{ nItem: number; qty: number; isProduced: boolean }> = [];

        if (isPartial) {
            for (const item of details.items) {
                const raw = qtyByNItem.get(item.nItem) ?? "";
                const qty = safeNumber(raw);
                if (qty === null || qty <= 0) continue;
                if (qty > item.quantity) {
                    return { ok: false, message: `Quantidade do item ${item.nItem} acima do original.` };
                }
                selection.push({ nItem: item.nItem, qty, isProduced: item.isProduced });
            }

            if (selection.length === 0) return { ok: false, message: "No estorno parcial, selecione ao menos 1 item com quantidade > 0." };
        } else {
            // TOTAL: não precisa enviar selection
        }

        return { ok: true, selection };
    };

    const handleSubmit = async () => {
        if (!props.outboundEmissionId || props.disabled) return;

        const validation = validateBeforeSubmit();
        if (!validation.ok) {
            toast({ title: "Dados incompletos", description: validation.message, variant: "destructive" });
            return;
        }

        setIsSubmitting(true);
        try {
            const payload = CreateInboundReversalRequestSchema.parse({
                outboundEmissionId: props.outboundEmissionId,
                mode,
                reasonCode,
                reasonOther: reasonCode === "OUTROS" ? reasonOther : undefined,
                internalNotes: internalNotes.trim().length ? internalNotes : undefined,
                selection: isPartial ? validation.selection : undefined,
            });

            const response = await fetch("/api/fiscal/nfe/reversal/create", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            const resultUnknown: unknown = await response.json().catch(() => ({}));
            if (!response.ok) {
                const maybe = resultUnknown as { error?: unknown };
                const message = typeof maybe?.error === "string" ? maybe.error : "Falha ao solicitar estorno.";
                throw new Error(message);
            }

            const result = CreateInboundReversalResponseSchema.parse(resultUnknown);

            toast({
                title: result.existing ? "Estorno já solicitado" : "Estorno enfileirado",
                description: result.inboundEmissionId
                    ? "A NF-e de entrada já foi gerada. Consulte a lista de NF-e emitidas."
                    : "A solicitação foi criada. Aguarde o processamento pelo SEFAZ Worker.",
            });

            props.onOpenChange(false);
            props.onCreated?.();
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : "Falha ao solicitar estorno.";
            toast({ title: "Erro ao gerar NF-e de entrada", description: message, variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    const emissionSummary = details?.emission ?? null;

    return (
        <Dialog open={props.open} onOpenChange={props.onOpenChange}>
            <DialogContent
                className={[
                    // Override base DialogContent layout (grid) to avoid min-height issues with scrollable children.
                    "flex flex-col",
                    // Pin to top and override base centering transform to avoid clipping the header on tall modals.
                    // Offset below the app header (the shell header can overlap z-50 content).
                    "!top-20 !translate-y-0",
                    "w-[calc(100vw-2rem)] max-w-5xl",
                    // Account for the top offset to keep bottom inside viewport.
                    "!max-h-[calc(100vh-6rem)] overflow-hidden p-0",
                ].join(" ")}
            >
                <div className="sticky top-0 z-10 border-b border-gray-100 bg-white px-6 py-4">
                    <DialogHeader className="space-y-1">
                        <DialogTitle className="text-xl">Gerar NF-e de Entrada (Estorno)</DialogTitle>
                        <DialogDescription>
                            Isso não cancela a NF-e original. Gera uma NF-e de entrada (devolução) referenciando a chave da NF-e de saída.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-3 text-sm">
                        <div className="grid grid-cols-1 gap-2 md:grid-cols-12">
                            <div className="md:col-span-4">
                                <div className="text-xs font-medium uppercase tracking-wider text-gray-500">NF-e de saída</div>
                                <div className="font-semibold text-gray-900">
                                    {emissionSummary?.numero ?? "-"} / Série {emissionSummary?.serie ?? "-"}
                                </div>
                            </div>
                            <div className="md:col-span-5">
                                <div className="text-xs font-medium uppercase tracking-wider text-gray-500">Cliente</div>
                                <div className="font-semibold text-gray-900">{emissionSummary?.clientName ?? "-"}</div>
                            </div>
                            <div className="md:col-span-3">
                                <div className="text-xs font-medium uppercase tracking-wider text-gray-500">Total</div>
                                <div className="font-semibold text-gray-900">
                                    {typeof emissionSummary?.totalAmount === "number"
                                        ? emissionSummary.totalAmount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                                        : "-"}
                                </div>
                            </div>
                            <div className="md:col-span-12">
                                <div className="text-xs font-medium uppercase tracking-wider text-gray-500">Chave</div>
                                <div
                                    className="font-mono text-[11px] leading-4 text-gray-900 whitespace-nowrap overflow-x-auto"
                                    title={emissionSummary?.accessKey ?? ""}
                                >
                                    {emissionSummary?.accessKey ?? "-"}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="min-h-0 flex-1 overflow-auto p-6">
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[380px_1fr]">
                        <div className="space-y-4">
                            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                                <div className="mb-3 text-sm font-semibold text-gray-900">Configuração</div>

                                <div className="space-y-2">
                                    <Label>Tipo de estorno</Label>
                                    <RadioGroup
                                        value={mode}
                                        onValueChange={(value) => setMode(ReversalModeSchema.parse(value))}
                                        className="grid grid-cols-2 gap-2"
                                    >
                                        <label className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-white p-3 shadow-card">
                                            <RadioGroupItem value="TOTAL" />
                                            <div className="text-sm font-medium text-gray-900">Total</div>
                                        </label>
                                        <label className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-white p-3 shadow-card">
                                            <RadioGroupItem value="PARCIAL" />
                                            <div className="text-sm font-medium text-gray-900">Parcial</div>
                                        </label>
                                    </RadioGroup>
                                </div>

                                <div className="mt-4 space-y-2">
                                    <Label>Motivo (obrigatório)</Label>
                                    <Select value={reasonCode ?? ""} onValueChange={(value) => setReasonCode(ReversalReasonCodeSchema.parse(value))}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Selecione..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {Object.entries(REVERSAL_REASON_LABELS_PT).map(([code, label]) => (
                                                <SelectItem key={code} value={code}>
                                                    {label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {reasonCode === "OUTROS" && (
                                    <div className="mt-4 space-y-2">
                                        <Label>Descreva o motivo</Label>
                                        <Textarea
                                            value={reasonOther}
                                            onChange={(e) => setReasonOther(e.target.value)}
                                            placeholder="Ex.: Cliente não recebeu, retorno ao CD..."
                                            className="min-h-24"
                                        />
                                    </div>
                                )}

                                <div className="mt-4 space-y-2">
                                    <Label>Observações internas (opcional)</Label>
                                    <Textarea
                                        value={internalNotes}
                                        onChange={(e) => setInternalNotes(e.target.value)}
                                        placeholder="Notas internas para auditoria/operacional (não vai para o XML)."
                                        className="min-h-20"
                                    />
                                </div>
                            </div>

                            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                                <div className="mb-2 text-sm font-semibold text-gray-900">Texto para SEFAZ (prévia)</div>
                                <div className="text-xs text-gray-500">Read-only</div>

                                <div className="mt-3 rounded-2xl border border-gray-200 bg-gray-50 p-3 text-xs leading-5">
                                    <div className="text-gray-600">natOp</div>
                                    <div className="font-semibold text-gray-900 break-words">{REVERSAL_NATOP}</div>
                                    <div className="mt-3 text-gray-600">infCpl</div>
                                    <div className="text-gray-900 break-words">{infCplPreview || "Selecione o motivo para ver a prévia."}</div>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
                            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                                <div>
                                    <div className="text-sm font-semibold text-gray-900">Itens do estorno</div>
                                    <div className="text-xs text-gray-500">
                                        {isPartial ? "Informe as quantidades que devem retornar." : "Estorno total usa as quantidades originais."}
                                    </div>
                                </div>
                                {isLoading && <Loader2 className="h-4 w-4 animate-spin text-gray-500" />}
                            </div>

                            <div className="max-h-[520px] overflow-auto">
                                {isLoading && (
                                    <div className="p-4 text-sm text-gray-600">Carregando itens...</div>
                                )}
                                {!isLoading && !details && (
                                    <div className="p-4 text-sm text-gray-600">Nenhum dado carregado.</div>
                                )}
                                {!isLoading && details && details.items.length === 0 && (
                                    <div className="p-4 text-sm text-gray-600">Nenhum item encontrado.</div>
                                )}
                                {!isLoading && details && details.items.length > 0 && (
                                    <table className="w-full text-sm">
                                        <thead className="sticky top-0 bg-white">
                                            <tr className="text-left text-xs uppercase tracking-wider text-gray-500">
                                                <th className="px-4 py-2">#</th>
                                                <th className="px-4 py-2">Produto</th>
                                                <th className="px-4 py-2">Qtd. original</th>
                                                <th className="px-4 py-2">{isPartial ? "Qtd. estorno" : "Qtd."}</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {details.items.map((it) => (
                                                <tr key={it.nItem}>
                                                    <td className="px-4 py-3 text-gray-500">{it.nItem}</td>
                                                    <td className="px-4 py-3">
                                                        <div className="font-medium text-gray-900">{it.name}</div>
                                                        {it.sku ? <div className="text-xs text-gray-500">SKU {it.sku}</div> : null}
                                                    </td>
                                                    <td className="px-4 py-3 text-gray-900">{it.quantity}</td>
                                                    <td className="px-4 py-3">
                                                        <Input
                                                            type="number"
                                                            step="0.0001"
                                                            min={0}
                                                            max={it.quantity}
                                                            disabled={!isPartial}
                                                            value={qtyByNItem.get(it.nItem) ?? ""}
                                                            onChange={(e) => {
                                                                const next = new Map(qtyByNItem);
                                                                next.set(it.nItem, e.target.value);
                                                                setQtyByNItem(next);
                                                            }}
                                                            className="h-9 w-32"
                                                        />
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>

                            <div className="border-t border-gray-100 px-4 py-3 text-xs text-gray-500">
                                Dica: no estorno parcial, informe apenas as quantidades que devem retornar (0 ignora o item).
                            </div>
                        </div>
                    </div>
                </div>

                <div className="sticky bottom-0 border-t border-gray-100 bg-white px-6 py-4">
                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => props.onOpenChange(false)} disabled={isSubmitting}>
                            Cancelar
                        </Button>
                        <Button onClick={handleSubmit} disabled={props.disabled || isSubmitting || isLoading || !details}>
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Gerando...
                                </>
                            ) : (
                                "Gerar NF-e de Entrada"
                            )}
                        </Button>
                    </DialogFooter>
                </div>
            </DialogContent>
        </Dialog>
    );
}
