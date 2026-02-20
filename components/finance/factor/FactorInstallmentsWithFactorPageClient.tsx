"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCcw, Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { CardHeaderStandard } from "@/components/ui/CardHeaderStandard";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { getFactorApiErrorMessage, listInstallmentsWithFactor } from "@/lib/data/finance/factor/factor-client";
import type { EligibleInstallment } from "@/lib/data/finance/factor/types";
import { formatCurrency, formatDate } from "@/lib/utils";

export function FactorInstallmentsWithFactorPageClient() {
    const router = useRouter();
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [search, setSearch] = useState("");
    const [installments, setInstallments] = useState<EligibleInstallment[]>([]);

    const loadData = useCallback(async (isReload = false) => {
        if (isReload) setRefreshing(true);
        else setLoading(true);
        try {
            const data = await listInstallmentsWithFactor();
            setInstallments(data);
        } catch (error: unknown) {
            toast({
                title: "Erro ao carregar títulos",
                description: getFactorApiErrorMessage(error),
                variant: "destructive",
            });
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [toast]);

    useEffect(() => {
        void loadData();
    }, [loadData]);

    const filteredInstallments = useMemo(() => {
        const term = search.trim().toLowerCase();
        if (!term) return installments;
        return installments.filter((item) => {
            const docNumber = String(item.ar_title.document_number ?? "").toLowerCase();
            return docNumber.includes(term);
        });
    }, [installments, search]);

    return (
        <div className="px-6 pb-8">
            <Card>
                <CardHeaderStandard
                    title="Títulos na Factor"
                    description="Visão diária dos títulos sob custody da factor (aberto ou vencido)."
                    actions={(
                        <div className="flex items-center gap-2">
                            <Button variant="outline" onClick={() => router.push("/app/financeiro/desconto-duplicatas")}>
                                Voltar para Operações
                            </Button>
                            <Button variant="outline" onClick={() => void loadData(true)} disabled={refreshing}>
                                <RefreshCcw className={`w-4 h-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
                                Atualizar
                            </Button>
                        </div>
                    )}
                />
                <CardContent className="space-y-4">
                    <div className="relative max-w-md">
                        <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                        <Input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Filtrar por número do título..."
                            className="pl-9"
                        />
                    </div>

                    <div className="rounded-2xl border border-gray-100 overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Título</TableHead>
                                    <TableHead>Parcela</TableHead>
                                    <TableHead>Vencimento</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Saldo aberto</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-20 text-center text-gray-500">
                                            Carregando títulos...
                                        </TableCell>
                                    </TableRow>
                                ) : filteredInstallments.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-20 text-center text-gray-500">
                                            Nenhum título encontrado.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredInstallments.map((item) => (
                                        <TableRow key={item.id}>
                                            <TableCell>{String(item.ar_title.document_number ?? "-")}</TableCell>
                                            <TableCell>{item.installment_number}</TableCell>
                                            <TableCell>{formatDate(item.due_date)}</TableCell>
                                            <TableCell>{item.status}</TableCell>
                                            <TableCell className="text-right">{formatCurrency(item.amount_open)}</TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
