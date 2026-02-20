"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Factory, Layers, Plus, RefreshCcw, Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { CardHeaderStandard } from "@/components/ui/CardHeaderStandard";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Label";
import { Textarea } from "@/components/ui/Textarea";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/Dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/Select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import {
    createFactor,
    createFactorOperation,
    getFactorApiErrorMessage,
    listFactorOperations,
    listFactors,
} from "@/lib/data/finance/factor/factor-client";
import type {
    FactorOperationListItem,
    FactorOperationStatus,
    FactorOption,
} from "@/lib/data/finance/factor/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import { FactorOperationStatusBadge } from "./FactorBadges";

type StatusFilter = "all" | FactorOperationStatus;

function toOptionalNumber(value: string): number | undefined {
    const normalized = value.trim().replace(",", ".");
    if (!normalized) return undefined;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : undefined;
}

function getTodayDateValue(): string {
    return new Date().toISOString().slice(0, 10);
}

export function FactorOperationsPageClient() {
    const router = useRouter();
    const { toast } = useToast();
    const [operations, setOperations] = useState<FactorOperationListItem[]>([]);
    const [factors, setFactors] = useState<FactorOption[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
    const [factorFilter, setFactorFilter] = useState<string>("all");
    const [search, setSearch] = useState("");
    const [newOperationOpen, setNewOperationOpen] = useState(false);
    const [newFactorOpen, setNewFactorOpen] = useState(false);
    const [creatingOperation, setCreatingOperation] = useState(false);
    const [creatingFactor, setCreatingFactor] = useState(false);

    const [opForm, setOpForm] = useState({
        factorId: "",
        reference: "",
        issueDate: getTodayDateValue(),
        expectedSettlementDate: "",
        notes: "",
    });

    const [factorForm, setFactorForm] = useState({
        name: "",
        code: "",
        interestRate: "",
        feeRate: "",
        iofRate: "",
        otherRate: "",
        graceDays: "0",
        notes: "",
    });

    const loadData = useCallback(async (isReload = false) => {
        if (isReload) setIsRefreshing(true);
        else setIsLoading(true);

        try {
            const [factorRows, operationRows] = await Promise.all([
                listFactors(),
                listFactorOperations({
                    status: statusFilter === "all" ? undefined : statusFilter,
                    factorId: factorFilter === "all" ? undefined : factorFilter,
                    search: search.trim() || undefined,
                }),
            ]);

            setFactors(factorRows);
            setOperations(operationRows);
        } catch (error: unknown) {
            toast({
                title: "Erro ao carregar operações",
                description: getFactorApiErrorMessage(error),
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [factorFilter, search, statusFilter, toast]);

    useEffect(() => {
        void loadData();
    }, [loadData]);

    const kpis = useMemo(() => {
        const gross = operations.reduce((acc, item) => acc + item.gross_amount, 0);
        const costs = operations.reduce((acc, item) => acc + item.costs_amount, 0);
        const net = operations.reduce((acc, item) => acc + item.net_amount, 0);
        const pending = operations.filter((item) => item.status === "sent_to_factor" || item.status === "in_adjustment").length;
        return {
            total: operations.length,
            pending,
            gross,
            costs,
            net,
        };
    }, [operations]);

    const handleCreateOperation = async () => {
        if (!opForm.factorId) {
            toast({
                title: "Selecione um factor",
                description: "A operação precisa de uma instituição de desconto.",
                variant: "destructive",
            });
            return;
        }

        setCreatingOperation(true);
        try {
            const created = await createFactorOperation({
                factorId: opForm.factorId,
                reference: opForm.reference.trim() || null,
                issueDate: opForm.issueDate,
                expectedSettlementDate: opForm.expectedSettlementDate || null,
                notes: opForm.notes.trim() || null,
            });
            toast({
                title: "Operação criada",
                description: `Operação #${created.operation_number} criada com sucesso.`,
            });
            setNewOperationOpen(false);
            setOpForm({
                factorId: "",
                reference: "",
                issueDate: getTodayDateValue(),
                expectedSettlementDate: "",
                notes: "",
            });
            router.push(`/app/financeiro/desconto-duplicatas/${created.id}`);
        } catch (error: unknown) {
            toast({
                title: "Erro ao criar operação",
                description: getFactorApiErrorMessage(error),
                variant: "destructive",
            });
        } finally {
            setCreatingOperation(false);
        }
    };

    const handleCreateFactor = async () => {
        if (!factorForm.name.trim()) {
            toast({
                title: "Nome obrigatório",
                description: "Informe o nome da factor.",
                variant: "destructive",
            });
            return;
        }

        setCreatingFactor(true);
        try {
            await createFactor({
                name: factorForm.name.trim(),
                code: factorForm.code.trim() || null,
                defaultInterestRate: toOptionalNumber(factorForm.interestRate),
                defaultFeeRate: toOptionalNumber(factorForm.feeRate),
                defaultIofRate: toOptionalNumber(factorForm.iofRate),
                defaultOtherCostRate: toOptionalNumber(factorForm.otherRate),
                defaultGraceDays: Number(factorForm.graceDays || "0"),
                notes: factorForm.notes.trim() || null,
            });

            toast({
                title: "Factor cadastrada",
                description: "A instituição foi adicionada com sucesso.",
            });
            setFactorForm({
                name: "",
                code: "",
                interestRate: "",
                feeRate: "",
                iofRate: "",
                otherRate: "",
                graceDays: "0",
                notes: "",
            });
            setNewFactorOpen(false);
            await loadData(true);
        } catch (error: unknown) {
            toast({
                title: "Erro ao cadastrar factor",
                description: getFactorApiErrorMessage(error),
                variant: "destructive",
            });
        } finally {
            setCreatingFactor(false);
        }
    };

    return (
        <div className="space-y-6 px-6 pb-8">
            <Card>
                <CardHeaderStandard
                    icon={<Layers className="w-5 h-5" />}
                    title="Operações"
                    description="Controle completo do fluxo de desconto de duplicatas."
                    actions={(
                        <div className="flex items-center gap-2">
                            <Button variant="outline" onClick={() => setNewFactorOpen(true)}>
                                <Factory className="w-4 h-4 mr-2" />
                                Nova Factor
                            </Button>
                            <Button variant="outline" onClick={() => router.push("/app/financeiro/desconto-duplicatas/titulos-na-factor")}>
                                Títulos na Factor
                            </Button>
                            <Button onClick={() => setNewOperationOpen(true)}>
                                <Plus className="w-4 h-4 mr-2" />
                                Nova Operação
                            </Button>
                        </div>
                    )}
                />
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                        <Card className="border-gray-100 shadow-none">
                            <CardContent className="p-4">
                                <p className="text-xs uppercase tracking-wide text-gray-500">Operações</p>
                                <p className="text-2xl font-semibold text-gray-900">{kpis.total}</p>
                            </CardContent>
                        </Card>
                        <Card className="border-gray-100 shadow-none">
                            <CardContent className="p-4">
                                <p className="text-xs uppercase tracking-wide text-gray-500">Em Tratativa</p>
                                <p className="text-2xl font-semibold text-blue-700">{kpis.pending}</p>
                            </CardContent>
                        </Card>
                        <Card className="border-gray-100 shadow-none">
                            <CardContent className="p-4">
                                <p className="text-xs uppercase tracking-wide text-gray-500">Bruto</p>
                                <p className="text-xl font-semibold text-gray-900">{formatCurrency(kpis.gross)}</p>
                            </CardContent>
                        </Card>
                        <Card className="border-gray-100 shadow-none">
                            <CardContent className="p-4">
                                <p className="text-xs uppercase tracking-wide text-gray-500">Custos</p>
                                <p className="text-xl font-semibold text-amber-700">{formatCurrency(kpis.costs)}</p>
                            </CardContent>
                        </Card>
                        <Card className="border-gray-100 shadow-none">
                            <CardContent className="p-4">
                                <p className="text-xs uppercase tracking-wide text-gray-500">Líquido</p>
                                <p className="text-xl font-semibold text-emerald-700">{formatCurrency(kpis.net)}</p>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
                        <div className="relative lg:col-span-2">
                            <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                            <Input
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                placeholder="Buscar por referência..."
                                className="pl-9"
                            />
                        </div>
                        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
                            <SelectTrigger>
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos os status</SelectItem>
                                <SelectItem value="draft">Rascunho</SelectItem>
                                <SelectItem value="sent_to_factor">Enviada à Factor</SelectItem>
                                <SelectItem value="in_adjustment">Em Ajuste</SelectItem>
                                <SelectItem value="completed">Concluída</SelectItem>
                                <SelectItem value="cancelled">Cancelada</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select value={factorFilter} onValueChange={setFactorFilter}>
                            <SelectTrigger>
                                <SelectValue placeholder="Factor" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todas as factors</SelectItem>
                                {factors.map((factor) => (
                                    <SelectItem key={factor.id} value={factor.id}>{factor.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex justify-end">
                        <Button variant="outline" onClick={() => void loadData(true)} disabled={isRefreshing}>
                            <RefreshCcw className={`w-4 h-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
                            Atualizar
                        </Button>
                    </div>

                    <div className="rounded-2xl border border-gray-100 overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Nº</TableHead>
                                    <TableHead>Referência</TableHead>
                                    <TableHead>Factor</TableHead>
                                    <TableHead>Emissão</TableHead>
                                    <TableHead className="text-right">Bruto</TableHead>
                                    <TableHead className="text-right">Custos</TableHead>
                                    <TableHead className="text-right">Líquido</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={9} className="h-20 text-center text-gray-500">
                                            Carregando operações...
                                        </TableCell>
                                    </TableRow>
                                ) : operations.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={9} className="h-20 text-center text-gray-500">
                                            Nenhuma operação encontrada.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    operations.map((operation) => (
                                        <TableRow key={operation.id}>
                                            <TableCell className="font-semibold">#{operation.operation_number}</TableCell>
                                            <TableCell>{operation.reference || "-"}</TableCell>
                                            <TableCell>{operation.factor?.name || "-"}</TableCell>
                                            <TableCell>{formatDate(operation.issue_date)}</TableCell>
                                            <TableCell className="text-right">{formatCurrency(operation.gross_amount)}</TableCell>
                                            <TableCell className="text-right">{formatCurrency(operation.costs_amount)}</TableCell>
                                            <TableCell className="text-right">{formatCurrency(operation.net_amount)}</TableCell>
                                            <TableCell>
                                                <FactorOperationStatusBadge status={operation.status} />
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => router.push(`/app/financeiro/desconto-duplicatas/${operation.id}`)}
                                                >
                                                    Abrir
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

            <Dialog open={newOperationOpen} onOpenChange={setNewOperationOpen}>
                <DialogContent className="sm:max-w-2xl rounded-2xl">
                    <DialogHeader>
                        <DialogTitle>Nova Operação de Factor</DialogTitle>
                        <DialogDescription>
                            Crie uma operação em rascunho para montar e enviar o pacote à factor.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2 md:col-span-2">
                            <Label>Factor</Label>
                            <Select value={opForm.factorId} onValueChange={(value) => setOpForm((prev) => ({ ...prev, factorId: value }))}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione a factor" />
                                </SelectTrigger>
                                <SelectContent>
                                    {factors.length === 0 ? (
                                        <SelectItem value="no-factor" disabled>Nenhuma factor cadastrada</SelectItem>
                                    ) : (
                                        factors.map((factor) => (
                                            <SelectItem key={factor.id} value={factor.id}>{factor.name}</SelectItem>
                                        ))
                                    )}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Referência</Label>
                            <Input
                                value={opForm.reference}
                                onChange={(event) => setOpForm((prev) => ({ ...prev, reference: event.target.value }))}
                                placeholder="Ex.: Lote 24/02"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Data de emissão</Label>
                            <Input
                                type="date"
                                value={opForm.issueDate}
                                onChange={(event) => setOpForm((prev) => ({ ...prev, issueDate: event.target.value }))}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Liquidação esperada</Label>
                            <Input
                                type="date"
                                value={opForm.expectedSettlementDate}
                                onChange={(event) => setOpForm((prev) => ({ ...prev, expectedSettlementDate: event.target.value }))}
                            />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                            <Label>Notas</Label>
                            <Textarea
                                value={opForm.notes}
                                onChange={(event) => setOpForm((prev) => ({ ...prev, notes: event.target.value }))}
                                placeholder="Observações internas"
                                rows={3}
                            />
                        </div>
                    </div>
                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setNewOperationOpen(false)}>Cancelar</Button>
                        <Button onClick={() => void handleCreateOperation()} disabled={creatingOperation}>
                            {creatingOperation ? "Criando..." : "Criar operação"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={newFactorOpen} onOpenChange={setNewFactorOpen}>
                <DialogContent className="sm:max-w-2xl rounded-2xl">
                    <DialogHeader>
                        <DialogTitle>Nova Factor</DialogTitle>
                        <DialogDescription>
                            Configure as taxas padrão usadas na simulação do pacote.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2 md:col-span-2">
                            <Label>Nome</Label>
                            <Input
                                value={factorForm.name}
                                onChange={(event) => setFactorForm((prev) => ({ ...prev, name: event.target.value }))}
                                placeholder="Nome da instituição"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Código</Label>
                            <Input
                                value={factorForm.code}
                                onChange={(event) => setFactorForm((prev) => ({ ...prev, code: event.target.value }))}
                                placeholder="Opcional"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Dias de carência</Label>
                            <Input
                                type="number"
                                min={0}
                                value={factorForm.graceDays}
                                onChange={(event) => setFactorForm((prev) => ({ ...prev, graceDays: event.target.value }))}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Juros padrão (%)</Label>
                            <Input
                                type="number"
                                min={0}
                                step="0.0001"
                                value={factorForm.interestRate}
                                onChange={(event) => setFactorForm((prev) => ({ ...prev, interestRate: event.target.value }))}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Taxa padrão (%)</Label>
                            <Input
                                type="number"
                                min={0}
                                step="0.0001"
                                value={factorForm.feeRate}
                                onChange={(event) => setFactorForm((prev) => ({ ...prev, feeRate: event.target.value }))}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>IOF padrão (%)</Label>
                            <Input
                                type="number"
                                min={0}
                                step="0.0001"
                                value={factorForm.iofRate}
                                onChange={(event) => setFactorForm((prev) => ({ ...prev, iofRate: event.target.value }))}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Outros custos (%)</Label>
                            <Input
                                type="number"
                                min={0}
                                step="0.0001"
                                value={factorForm.otherRate}
                                onChange={(event) => setFactorForm((prev) => ({ ...prev, otherRate: event.target.value }))}
                            />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                            <Label>Notas</Label>
                            <Textarea
                                value={factorForm.notes}
                                onChange={(event) => setFactorForm((prev) => ({ ...prev, notes: event.target.value }))}
                                rows={3}
                            />
                        </div>
                    </div>
                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setNewFactorOpen(false)}>Cancelar</Button>
                        <Button onClick={() => void handleCreateFactor()} disabled={creatingFactor}>
                            {creatingFactor ? "Salvando..." : "Salvar factor"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
