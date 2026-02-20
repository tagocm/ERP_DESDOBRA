"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
    CheckCircle2,
    Download,
    Plus,
    RefreshCcw,
    Save,
    Send,
    Trash2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { CardHeaderStandard } from "@/components/ui/CardHeaderStandard";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/Select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/use-toast";
import {
    addFactorOperationItem,
    applyOperationResponses,
    cancelFactorOperation,
    concludeFactorOperation,
    createOperationVersion,
    downloadOperationPackageZip,
    getFactorApiErrorMessage,
    getFactorOperationDetail,
    listInstallmentsWithFactor,
    listOpenInstallments,
    removeFactorOperationItem,
    sendOperationToFactor,
    updateFactorOperation,
} from "@/lib/data/finance/factor/factor-client";
import type {
    EligibleInstallment,
    FactorItemAction,
    FactorOperationDetailPayload,
    FactorResponseStatus,
} from "@/lib/data/finance/factor/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import { FactorActionBadge, FactorOperationStatusBadge, FactorResponseStatusBadge } from "./FactorBadges";

type ResponseDraft = {
    responseStatus: FactorResponseStatus;
    responseCode: string;
    responseMessage: string;
    acceptedAmount: string;
    adjustedAmount: string;
    adjustedDueDate: string;
    feeAmount: string;
    interestAmount: string;
    iofAmount: string;
    otherCostAmount: string;
};

function formatNumberish(value: number | null | undefined): string {
    if (value === null || value === undefined) return "";
    return String(value);
}

function canEditOperation(status: FactorOperationDetailPayload["operation"]["status"]): boolean {
    return status === "draft" || status === "in_adjustment";
}

function canConcludeOperation(status: FactorOperationDetailPayload["operation"]["status"]): boolean {
    return status === "sent_to_factor" || status === "in_adjustment";
}

function buildResponseDrafts(detail: FactorOperationDetailPayload): Record<string, ResponseDraft> {
    const responseByItem = new Map<string, FactorOperationDetailPayload["responses"][number]>();
    for (const response of detail.responses) {
        if (!responseByItem.has(response.operation_item_id)) {
            responseByItem.set(response.operation_item_id, response);
        }
    }

    return detail.items.reduce<Record<string, ResponseDraft>>((acc, item) => {
        const response = responseByItem.get(item.id);
        acc[item.id] = {
            responseStatus: response?.response_status ?? item.status ?? "pending",
            responseCode: response?.response_code ?? "",
            responseMessage: response?.response_message ?? "",
            acceptedAmount: formatNumberish(response?.accepted_amount ?? item.final_amount ?? item.amount_snapshot),
            adjustedAmount: formatNumberish(response?.adjusted_amount ?? item.final_amount),
            adjustedDueDate: response?.adjusted_due_date ?? item.final_due_date ?? item.proposed_due_date ?? "",
            feeAmount: formatNumberish(response?.fee_amount ?? 0),
            interestAmount: formatNumberish(response?.interest_amount ?? 0),
            iofAmount: formatNumberish(response?.iof_amount ?? 0),
            otherCostAmount: formatNumberish(response?.other_cost_amount ?? 0),
        };
        return acc;
    }, {});
}

function downloadBlob(blob: Blob, fileName: string) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
}

export function FactorOperationDetailPageClient({ operationId }: { operationId: string }) {
    const { toast } = useToast();
    const [detail, setDetail] = useState<FactorOperationDetailPayload | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [openInstallments, setOpenInstallments] = useState<EligibleInstallment[]>([]);
    const [withFactorInstallments, setWithFactorInstallments] = useState<EligibleInstallment[]>([]);
    const [installmentsLoading, setInstallmentsLoading] = useState(false);
    const [installmentSearch, setInstallmentSearch] = useState("");
    const [responseDrafts, setResponseDrafts] = useState<Record<string, ResponseDraft>>({});
    const [dueDateDrafts, setDueDateDrafts] = useState<Record<string, string>>({});
    const [operationNotes, setOperationNotes] = useState("");
    const [expectedSettlementDate, setExpectedSettlementDate] = useState("");
    const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
    const [cancelReason, setCancelReason] = useState("");
    const [processingAction, setProcessingAction] = useState(false);

    const loadDetail = useCallback(async (isReload = false) => {
        if (isReload) setRefreshing(true);
        else setLoading(true);
        try {
            const payload = await getFactorOperationDetail(operationId);
            setDetail(payload);
            setOperationNotes(payload.operation.notes ?? "");
            setExpectedSettlementDate(payload.operation.expected_settlement_date ?? "");
            setResponseDrafts(buildResponseDrafts(payload));
        } catch (error: unknown) {
            toast({
                title: "Erro ao carregar operação",
                description: getFactorApiErrorMessage(error),
                variant: "destructive",
            });
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [operationId, toast]);

    const loadInstallments = useCallback(async () => {
        setInstallmentsLoading(true);
        try {
            const [openRows, withFactorRows] = await Promise.all([
                listOpenInstallments(installmentSearch),
                listInstallmentsWithFactor(),
            ]);
            setOpenInstallments(openRows);
            setWithFactorInstallments(withFactorRows);
        } catch (error: unknown) {
            toast({
                title: "Erro ao carregar parcelas",
                description: getFactorApiErrorMessage(error),
                variant: "destructive",
            });
        } finally {
            setInstallmentsLoading(false);
        }
    }, [installmentSearch, toast]);

    useEffect(() => {
        void loadDetail();
    }, [loadDetail]);

    useEffect(() => {
        void loadInstallments();
    }, [loadInstallments]);

    const editable = useMemo(() => {
        if (!detail) return false;
        return canEditOperation(detail.operation.status);
    }, [detail]);

    const handleSaveMetadata = async () => {
        if (!detail) return;
        setProcessingAction(true);
        try {
            await updateFactorOperation(detail.operation.id, {
                notes: operationNotes.trim() || null,
                expectedSettlementDate: expectedSettlementDate || null,
            });
            toast({
                title: "Operação atualizada",
                description: "Dados do cabeçalho salvos com sucesso.",
            });
            await loadDetail(true);
        } catch (error: unknown) {
            toast({
                title: "Erro ao salvar operação",
                description: getFactorApiErrorMessage(error),
                variant: "destructive",
            });
        } finally {
            setProcessingAction(false);
        }
    };

    const handleAddItem = async (
        actionType: FactorItemAction,
        installmentId: string,
        proposedDueDate?: string,
    ) => {
        if (!detail) return;
        setProcessingAction(true);
        try {
            await addFactorOperationItem(detail.operation.id, {
                actionType,
                installmentId,
                proposedDueDate: proposedDueDate || null,
            });
            toast({
                title: "Item adicionado",
                description: "Parcela incluída na operação.",
            });
            if (actionType === "due_date_change") {
                setDueDateDrafts((prev) => ({ ...prev, [installmentId]: "" }));
            }
            await Promise.all([loadDetail(true), loadInstallments()]);
        } catch (error: unknown) {
            toast({
                title: "Erro ao adicionar item",
                description: getFactorApiErrorMessage(error),
                variant: "destructive",
            });
        } finally {
            setProcessingAction(false);
        }
    };

    const handleRemoveItem = async (itemId: string) => {
        if (!detail) return;
        setProcessingAction(true);
        try {
            await removeFactorOperationItem(detail.operation.id, itemId);
            toast({ title: "Item removido" });
            await Promise.all([loadDetail(true), loadInstallments()]);
        } catch (error: unknown) {
            toast({
                title: "Erro ao remover item",
                description: getFactorApiErrorMessage(error),
                variant: "destructive",
            });
        } finally {
            setProcessingAction(false);
        }
    };

    const handleGenerateVersion = async () => {
        if (!detail) return;
        setProcessingAction(true);
        try {
            await createOperationVersion(detail.operation.id);
            toast({
                title: "Versão gerada",
                description: "Pacote congelado com sucesso.",
            });
            await loadDetail(true);
        } catch (error: unknown) {
            toast({
                title: "Erro ao gerar versão",
                description: getFactorApiErrorMessage(error),
                variant: "destructive",
            });
        } finally {
            setProcessingAction(false);
        }
    };

    const handleSendToFactor = async () => {
        if (!detail) return;
        setProcessingAction(true);
        try {
            await sendOperationToFactor(detail.operation.id);
            toast({
                title: "Operação enviada",
                description: "Pacote enviado para análise da factor.",
            });
            await loadDetail(true);
        } catch (error: unknown) {
            toast({
                title: "Erro ao enviar operação",
                description: getFactorApiErrorMessage(error),
                variant: "destructive",
            });
        } finally {
            setProcessingAction(false);
        }
    };

    const handleApplyResponses = async () => {
        if (!detail) return;
        if (!detail.operation.current_version_id) {
            toast({
                title: "Versão pendente",
                description: "Gere e envie uma versão antes de aplicar retorno.",
                variant: "destructive",
            });
            return;
        }

        const hasPendingStatus = detail.items.some((item) => {
            const draft = responseDrafts[item.id];
            return !draft || draft.responseStatus === "pending";
        });

        if (hasPendingStatus) {
            toast({
                title: "Retorno incompleto",
                description: "Defina Aceito, Recusado ou Ajustado para todos os itens.",
                variant: "destructive",
            });
            return;
        }

        setProcessingAction(true);
        try {
            await applyOperationResponses(
                detail.operation.id,
                detail.operation.current_version_id,
                detail.items.map((item) => ({
                    itemId: item.id,
                    responseStatus: responseDrafts[item.id].responseStatus,
                    responseCode: responseDrafts[item.id].responseCode || null,
                    responseMessage: responseDrafts[item.id].responseMessage || null,
                    acceptedAmount: responseDrafts[item.id].acceptedAmount,
                    adjustedAmount: responseDrafts[item.id].adjustedAmount,
                    adjustedDueDate: responseDrafts[item.id].adjustedDueDate || null,
                    feeAmount: responseDrafts[item.id].feeAmount,
                    interestAmount: responseDrafts[item.id].interestAmount,
                    iofAmount: responseDrafts[item.id].iofAmount,
                    otherCostAmount: responseDrafts[item.id].otherCostAmount,
                })),
            );
            toast({
                title: "Retorno aplicado",
                description: "A operação foi atualizada com o retorno da factor.",
            });
            await loadDetail(true);
        } catch (error: unknown) {
            toast({
                title: "Erro ao aplicar retorno",
                description: getFactorApiErrorMessage(error),
                variant: "destructive",
            });
        } finally {
            setProcessingAction(false);
        }
    };

    const handleConcludeOperation = async () => {
        if (!detail) return;
        setProcessingAction(true);
        try {
            const result = await concludeFactorOperation(
                detail.operation.id,
                expectedSettlementDate || undefined,
                operationNotes || null,
            );
            toast({
                title: result.idempotent ? "Operação já concluída" : "Operação concluída",
                description: result.idempotent
                    ? "Nenhum lançamento duplicado foi gerado."
                    : "Lançamentos financeiros gerados com rastreabilidade.",
            });
            await loadDetail(true);
        } catch (error: unknown) {
            toast({
                title: "Erro ao concluir operação",
                description: getFactorApiErrorMessage(error),
                variant: "destructive",
            });
        } finally {
            setProcessingAction(false);
        }
    };

    const handleCancelOperation = async () => {
        if (!detail) return;
        if (cancelReason.trim().length < 3) {
            toast({
                title: "Motivo obrigatório",
                description: "Informe um motivo com ao menos 3 caracteres.",
                variant: "destructive",
            });
            return;
        }

        setProcessingAction(true);
        try {
            await cancelFactorOperation(detail.operation.id, cancelReason.trim());
            setCancelDialogOpen(false);
            setCancelReason("");
            toast({
                title: "Operação cancelada",
                description: "A operação foi encerrada sem conclusão financeira.",
            });
            await loadDetail(true);
        } catch (error: unknown) {
            toast({
                title: "Erro ao cancelar operação",
                description: getFactorApiErrorMessage(error),
                variant: "destructive",
            });
        } finally {
            setProcessingAction(false);
        }
    };

    const handleDownloadBundle = async (bundle: "all" | "xml" | "danfe") => {
        if (!detail) return;
        try {
            const blob = await downloadOperationPackageZip(detail.operation.id, bundle);
            downloadBlob(blob, `factor-operacao-${detail.operation.operation_number}-${bundle}.zip`);
        } catch (error: unknown) {
            toast({
                title: "Erro ao baixar pacote",
                description: getFactorApiErrorMessage(error),
                variant: "destructive",
            });
        }
    };

    if (loading || !detail) {
        return (
            <div className="px-6 pb-8">
                <Card>
                    <CardContent className="p-10 text-center text-gray-500">
                        Carregando operação...
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6 px-6 pb-8">
            <Card>
                <CardHeaderStandard
                    title={`Operação #${detail.operation.operation_number}`}
                    description={`Factor: ${detail.factor.name}`}
                    actions={(
                        <div className="flex items-center gap-2 flex-wrap justify-end">
                            <FactorOperationStatusBadge status={detail.operation.status} />
                            <Button variant="outline" onClick={() => void loadDetail(true)} disabled={refreshing}>
                                <RefreshCcw className={`w-4 h-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
                                Atualizar
                            </Button>
                            <Button variant="outline" onClick={() => void handleGenerateVersion()} disabled={!editable || processingAction}>
                                <Save className="w-4 h-4 mr-2" />
                                Gerar Versão
                            </Button>
                            <Button onClick={() => void handleSendToFactor()} disabled={!editable || processingAction}>
                                <Send className="w-4 h-4 mr-2" />
                                Enviar à Factor
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => void handleConcludeOperation()}
                                disabled={!canConcludeOperation(detail.operation.status) || processingAction}
                            >
                                <CheckCircle2 className="w-4 h-4 mr-2" />
                                Concluir
                            </Button>
                            <Button
                                variant="danger"
                                onClick={() => setCancelDialogOpen(true)}
                                disabled={detail.operation.status === "completed" || detail.operation.status === "cancelled" || processingAction}
                            >
                                Cancelar
                            </Button>
                        </div>
                    )}
                />
                <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <Card className="border-gray-100 shadow-none">
                        <CardContent className="p-4">
                            <p className="text-xs uppercase text-gray-500">Valor Bruto</p>
                            <p className="text-xl font-semibold text-gray-900">{formatCurrency(detail.operation.gross_amount)}</p>
                        </CardContent>
                    </Card>
                    <Card className="border-gray-100 shadow-none">
                        <CardContent className="p-4">
                            <p className="text-xs uppercase text-gray-500">Custos</p>
                            <p className="text-xl font-semibold text-amber-700">{formatCurrency(detail.operation.costs_amount)}</p>
                        </CardContent>
                    </Card>
                    <Card className="border-gray-100 shadow-none">
                        <CardContent className="p-4">
                            <p className="text-xs uppercase text-gray-500">Líquido</p>
                            <p className="text-xl font-semibold text-emerald-700">{formatCurrency(detail.operation.net_amount)}</p>
                        </CardContent>
                    </Card>
                    <Card className="border-gray-100 shadow-none">
                        <CardContent className="p-4">
                            <p className="text-xs uppercase text-gray-500">Versão Atual</p>
                            <p className="text-xl font-semibold text-gray-900">V{detail.operation.version_counter}</p>
                        </CardContent>
                    </Card>
                </CardContent>
            </Card>

            <Tabs defaultValue="package">
                <TabsList className="w-full md:w-auto">
                    <TabsTrigger value="package">Montagem do Pacote</TabsTrigger>
                    <TabsTrigger value="documents">Documentos</TabsTrigger>
                    <TabsTrigger value="response">Retorno da Factor</TabsTrigger>
                    <TabsTrigger value="preview">Prévia de Lançamentos</TabsTrigger>
                </TabsList>

                <TabsContent value="package" className="space-y-6">
                    <Card>
                        <CardHeaderStandard
                            title="Cabeçalho da Operação"
                            description="Dados gerais e observações da operação."
                            actions={(
                                <Button onClick={() => void handleSaveMetadata()} disabled={!editable || processingAction}>
                                    <Save className="w-4 h-4 mr-2" />
                                    Salvar
                                </Button>
                            )}
                        />
                        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label>Data de emissão</Label>
                                <Input value={detail.operation.issue_date} readOnly disabled />
                            </div>
                            <div className="space-y-2">
                                <Label>Liquidação esperada</Label>
                                <Input
                                    type="date"
                                    value={expectedSettlementDate}
                                    onChange={(event) => setExpectedSettlementDate(event.target.value)}
                                    disabled={!editable}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Status</Label>
                                <Input value={detail.operation.status} readOnly disabled />
                            </div>
                            <div className="space-y-2 md:col-span-3">
                                <Label>Notas</Label>
                                <Textarea
                                    value={operationNotes}
                                    onChange={(event) => setOperationNotes(event.target.value)}
                                    rows={3}
                                    disabled={!editable}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeaderStandard
                            title="Itens da Operação"
                            description="Relação final da operação e status de retorno por item."
                        />
                        <CardContent>
                            <div className="rounded-2xl border border-gray-100 overflow-hidden">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>#</TableHead>
                                            <TableHead>Ação</TableHead>
                                            <TableHead>Parcela</TableHead>
                                            <TableHead>Vencimento</TableHead>
                                            <TableHead className="text-right">Valor</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead className="text-right">Ações</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {detail.items.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={7} className="h-20 text-center text-gray-500">
                                                    Nenhum item na operação.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            detail.items.map((item) => (
                                                <TableRow key={item.id}>
                                                    <TableCell>{item.line_no}</TableCell>
                                                    <TableCell><FactorActionBadge action={item.action_type} /></TableCell>
                                                    <TableCell>{item.installment_number_snapshot}</TableCell>
                                                    <TableCell>{formatDate(item.due_date_snapshot)}</TableCell>
                                                    <TableCell className="text-right">{formatCurrency(item.amount_snapshot)}</TableCell>
                                                    <TableCell><FactorResponseStatusBadge status={item.status} /></TableCell>
                                                    <TableCell className="text-right">
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => void handleRemoveItem(item.id)}
                                                            disabled={!editable || processingAction}
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeaderStandard
                            title="Parcelas Elegíveis (Desconto)"
                            description="Parcela em aberto e ainda em custody própria."
                        />
                        <CardContent className="space-y-3">
                            <div className="flex items-center gap-2">
                                <Input
                                    value={installmentSearch}
                                    onChange={(event) => setInstallmentSearch(event.target.value)}
                                    placeholder="Buscar por número do título..."
                                />
                                <Button variant="outline" onClick={() => void loadInstallments()}>
                                    Buscar
                                </Button>
                            </div>
                            <div className="rounded-2xl border border-gray-100 overflow-hidden">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Título</TableHead>
                                            <TableHead>Parcela</TableHead>
                                            <TableHead>Vencimento</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead className="text-right">Saldo</TableHead>
                                            <TableHead className="text-right">Ação</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {installmentsLoading ? (
                                            <TableRow>
                                                <TableCell colSpan={6} className="h-16 text-center text-gray-500">
                                                    Carregando parcelas...
                                                </TableCell>
                                            </TableRow>
                                        ) : openInstallments.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={6} className="h-16 text-center text-gray-500">
                                                    Sem parcelas elegíveis.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            openInstallments.map((installment) => (
                                                <TableRow key={installment.id}>
                                                    <TableCell>{String(installment.ar_title.document_number ?? "-")}</TableCell>
                                                    <TableCell>{installment.installment_number}</TableCell>
                                                    <TableCell>{formatDate(installment.due_date)}</TableCell>
                                                    <TableCell>{installment.status}</TableCell>
                                                    <TableCell className="text-right">{formatCurrency(installment.amount_open)}</TableCell>
                                                    <TableCell className="text-right">
                                                        <Button
                                                            size="sm"
                                                            onClick={() => void handleAddItem("discount", installment.id)}
                                                            disabled={!editable || processingAction}
                                                        >
                                                            <Plus className="w-4 h-4 mr-1" />
                                                            Descontar
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeaderStandard
                            title="Parcelas na Factor (Recompra / Alterar Vencimento)"
                            description="Atalho para regularização diária de títulos sob custody da factor."
                        />
                        <CardContent>
                            <div className="rounded-2xl border border-gray-100 overflow-hidden">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Título</TableHead>
                                            <TableHead>Parcela</TableHead>
                                            <TableHead>Vencimento Atual</TableHead>
                                            <TableHead className="text-right">Saldo</TableHead>
                                            <TableHead>Novo vencimento</TableHead>
                                            <TableHead className="text-right">Ações</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {installmentsLoading ? (
                                            <TableRow>
                                                <TableCell colSpan={6} className="h-16 text-center text-gray-500">
                                                    Carregando parcelas...
                                                </TableCell>
                                            </TableRow>
                                        ) : withFactorInstallments.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={6} className="h-16 text-center text-gray-500">
                                                    Nenhuma parcela em custody da factor.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            withFactorInstallments.map((installment) => (
                                                <TableRow key={installment.id}>
                                                    <TableCell>{String(installment.ar_title.document_number ?? "-")}</TableCell>
                                                    <TableCell>{installment.installment_number}</TableCell>
                                                    <TableCell>{formatDate(installment.due_date)}</TableCell>
                                                    <TableCell className="text-right">{formatCurrency(installment.amount_open)}</TableCell>
                                                    <TableCell>
                                                        <Input
                                                            type="date"
                                                            value={dueDateDrafts[installment.id] ?? ""}
                                                            onChange={(event) => setDueDateDrafts((prev) => ({ ...prev, [installment.id]: event.target.value }))}
                                                            disabled={!editable}
                                                        />
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex items-center justify-end gap-2">
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => void handleAddItem("buyback", installment.id)}
                                                                disabled={!editable || processingAction}
                                                            >
                                                                Recompra
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                onClick={() => void handleAddItem("due_date_change", installment.id, dueDateDrafts[installment.id])}
                                                                disabled={!editable || processingAction || !(dueDateDrafts[installment.id] ?? "").trim()}
                                                            >
                                                                Alterar
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="documents" className="space-y-6">
                    <Card>
                        <CardHeaderStandard
                            title="Pacotes e Artefatos"
                            description="Baixe XMLs e DANFEs vinculados ao pacote enviado para a factor."
                            actions={(
                                <div className="flex items-center gap-2">
                                    <Button variant="outline" onClick={() => void handleDownloadBundle("xml")}>
                                        <Download className="w-4 h-4 mr-2" />
                                        ZIP XML
                                    </Button>
                                    <Button variant="outline" onClick={() => void handleDownloadBundle("danfe")}>
                                        <Download className="w-4 h-4 mr-2" />
                                        ZIP DANFE
                                    </Button>
                                    <Button onClick={() => void handleDownloadBundle("all")}>
                                        <Download className="w-4 h-4 mr-2" />
                                        ZIP Completo
                                    </Button>
                                </div>
                            )}
                        />
                        <CardContent>
                            <div className="rounded-2xl border border-gray-100 overflow-hidden">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Versão</TableHead>
                                            <TableHead>Status origem</TableHead>
                                            <TableHead>Itens</TableHead>
                                            <TableHead className="text-right">Bruto</TableHead>
                                            <TableHead className="text-right">Custos</TableHead>
                                            <TableHead className="text-right">Líquido</TableHead>
                                            <TableHead>Gerada em</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {detail.versions.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={7} className="h-16 text-center text-gray-500">
                                                    Nenhuma versão gerada.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            detail.versions.map((version) => (
                                                <TableRow key={version.id}>
                                                    <TableCell className="font-semibold">V{version.version_number}</TableCell>
                                                    <TableCell>{version.source_status}</TableCell>
                                                    <TableCell>{version.total_items}</TableCell>
                                                    <TableCell className="text-right">{formatCurrency(version.gross_amount)}</TableCell>
                                                    <TableCell className="text-right">{formatCurrency(version.costs_amount)}</TableCell>
                                                    <TableCell className="text-right">{formatCurrency(version.net_amount)}</TableCell>
                                                    <TableCell>{formatDate(version.created_at)}</TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="response" className="space-y-6">
                    <Card>
                        <CardHeaderStandard
                            title="Retorno da Factor"
                            description="Registre aceite, recusa ou ajustes por item."
                            actions={(
                                <Button onClick={() => void handleApplyResponses()} disabled={processingAction || detail.items.length === 0}>
                                    <CheckCircle2 className="w-4 h-4 mr-2" />
                                    Aplicar retorno
                                </Button>
                            )}
                        />
                        <CardContent className="space-y-3">
                            {detail.items.length === 0 ? (
                                <div className="rounded-2xl border border-gray-100 p-6 text-center text-gray-500">
                                    Adicione itens na aba &quot;Montagem do Pacote&quot; para registrar retorno.
                                </div>
                            ) : (
                                detail.items.map((item) => {
                                    const draft = responseDrafts[item.id];
                                    if (!draft) return null;

                                    return (
                                        <Card key={item.id} className="border-gray-100 shadow-none">
                                            <CardContent className="p-4 space-y-4">
                                                <div className="flex items-center justify-between gap-3">
                                                    <div className="space-y-1">
                                                        <p className="text-sm font-semibold text-gray-900">
                                                            Item #{item.line_no} · Parcela {item.installment_number_snapshot}
                                                        </p>
                                                        <div className="flex items-center gap-2">
                                                            <FactorActionBadge action={item.action_type} />
                                                            <FactorResponseStatusBadge status={draft.responseStatus} />
                                                        </div>
                                                    </div>
                                                    <p className="text-sm text-gray-600">
                                                        Valor base: <span className="font-semibold text-gray-900">{formatCurrency(item.amount_snapshot)}</span>
                                                    </p>
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                                    <div className="space-y-1">
                                                        <Label>Status</Label>
                                                        <Select
                                                            value={draft.responseStatus}
                                                            onValueChange={(value) => setResponseDrafts((prev) => ({
                                                                ...prev,
                                                                [item.id]: { ...prev[item.id], responseStatus: value as FactorResponseStatus },
                                                            }))}
                                                        >
                                                            <SelectTrigger>
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="accepted">Aceito</SelectItem>
                                                                <SelectItem value="rejected">Recusado</SelectItem>
                                                                <SelectItem value="adjusted">Ajustado</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <Label>Valor aceito</Label>
                                                        <Input
                                                            value={draft.acceptedAmount}
                                                            onChange={(event) => setResponseDrafts((prev) => ({
                                                                ...prev,
                                                                [item.id]: { ...prev[item.id], acceptedAmount: event.target.value },
                                                            }))}
                                                            placeholder="0,00"
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <Label>Valor ajustado</Label>
                                                        <Input
                                                            value={draft.adjustedAmount}
                                                            onChange={(event) => setResponseDrafts((prev) => ({
                                                                ...prev,
                                                                [item.id]: { ...prev[item.id], adjustedAmount: event.target.value },
                                                            }))}
                                                            placeholder="0,00"
                                                            disabled={draft.responseStatus !== "adjusted"}
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <Label>Vencimento ajustado</Label>
                                                        <Input
                                                            type="date"
                                                            value={draft.adjustedDueDate}
                                                            onChange={(event) => setResponseDrafts((prev) => ({
                                                                ...prev,
                                                                [item.id]: { ...prev[item.id], adjustedDueDate: event.target.value },
                                                            }))}
                                                            disabled={draft.responseStatus !== "adjusted"}
                                                        />
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                                    <div className="space-y-1">
                                                        <Label>Taxa</Label>
                                                        <Input
                                                            value={draft.feeAmount}
                                                            onChange={(event) => setResponseDrafts((prev) => ({
                                                                ...prev,
                                                                [item.id]: { ...prev[item.id], feeAmount: event.target.value },
                                                            }))}
                                                            placeholder="0,00"
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <Label>Juros</Label>
                                                        <Input
                                                            value={draft.interestAmount}
                                                            onChange={(event) => setResponseDrafts((prev) => ({
                                                                ...prev,
                                                                [item.id]: { ...prev[item.id], interestAmount: event.target.value },
                                                            }))}
                                                            placeholder="0,00"
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <Label>IOF</Label>
                                                        <Input
                                                            value={draft.iofAmount}
                                                            onChange={(event) => setResponseDrafts((prev) => ({
                                                                ...prev,
                                                                [item.id]: { ...prev[item.id], iofAmount: event.target.value },
                                                            }))}
                                                            placeholder="0,00"
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <Label>Outros custos</Label>
                                                        <Input
                                                            value={draft.otherCostAmount}
                                                            onChange={(event) => setResponseDrafts((prev) => ({
                                                                ...prev,
                                                                [item.id]: { ...prev[item.id], otherCostAmount: event.target.value },
                                                            }))}
                                                            placeholder="0,00"
                                                        />
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                    <div className="space-y-1">
                                                        <Label>Código retorno</Label>
                                                        <Input
                                                            value={draft.responseCode}
                                                            onChange={(event) => setResponseDrafts((prev) => ({
                                                                ...prev,
                                                                [item.id]: { ...prev[item.id], responseCode: event.target.value },
                                                            }))}
                                                            placeholder="Opcional"
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <Label>Mensagem retorno</Label>
                                                        <Input
                                                            value={draft.responseMessage}
                                                            onChange={(event) => setResponseDrafts((prev) => ({
                                                                ...prev,
                                                                [item.id]: { ...prev[item.id], responseMessage: event.target.value },
                                                            }))}
                                                            placeholder="Opcional"
                                                        />
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    );
                                })
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="preview" className="space-y-6">
                    <Card>
                        <CardHeaderStandard
                            title="Prévia de Lançamentos"
                            description="Valores estimados para AR/AP gerados apenas na conclusão da operação."
                        />
                        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <Card className="border-gray-100 shadow-none">
                                <CardContent className="p-4">
                                    <p className="text-xs uppercase text-gray-500">Liquidação AR (Desconto)</p>
                                    <p className="text-xl font-semibold text-gray-900">{formatCurrency(detail.postingPreview.discountAmount)}</p>
                                </CardContent>
                            </Card>
                            <Card className="border-gray-100 shadow-none">
                                <CardContent className="p-4">
                                    <p className="text-xs uppercase text-gray-500">Recompra (AP)</p>
                                    <p className="text-xl font-semibold text-gray-900">{formatCurrency(detail.postingPreview.buybackAmount)}</p>
                                </CardContent>
                            </Card>
                            <Card className="border-gray-100 shadow-none">
                                <CardContent className="p-4">
                                    <p className="text-xs uppercase text-gray-500">Custos da Factor</p>
                                    <p className="text-xl font-semibold text-amber-700">{formatCurrency(detail.postingPreview.factorCostsAmount)}</p>
                                </CardContent>
                            </Card>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
                <DialogContent className="rounded-2xl">
                    <DialogHeader>
                        <DialogTitle>Cancelar Operação</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-2">
                        <Label>Motivo</Label>
                        <Textarea
                            value={cancelReason}
                            onChange={(event) => setCancelReason(event.target.value)}
                            placeholder="Descreva o motivo do cancelamento"
                            rows={4}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>Voltar</Button>
                        <Button variant="danger" onClick={() => void handleCancelOperation()} disabled={processingAction}>
                            Confirmar cancelamento
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
