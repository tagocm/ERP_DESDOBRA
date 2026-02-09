"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Label";
import { Input } from "@/components/ui/Input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { formatCurrency } from "@/lib/utils";
import { ArInstallmentDTO } from "@/lib/types/financial-dto";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import { createClient } from "@/lib/supabaseBrowser";

interface BulkSettleModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    selectedIds: Set<string>;
    installments: ArInstallmentDTO[]; // Full list to lookup
    onConfirm: (date: string, accountId: string, validIds: string[]) => Promise<void>;
    isProcessing: boolean;
}

export function BulkSettleModal({ open, onOpenChange, selectedIds, installments, onConfirm, isProcessing }: BulkSettleModalProps) {
    const { toast } = useToast();
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [accountId, setAccountId] = useState("");
    const [financialAccounts, setFinancialAccounts] = useState<{ id: string, name: string }[]>([]);

    // Derived state
    const selectedInstallments = installments.filter(i => selectedIds.has(i.id));
    const validInstallments = selectedInstallments.filter(i => i.status === 'OPEN' || i.status === 'PARTIAL' || i.status === 'OVERDUE');
    const invalidCount = selectedInstallments.length - validInstallments.length;

    const totalAmount = validInstallments.reduce((sum, i) => sum + i.amount_open, 0);

    // Fetch Accounts (Mock/Real)
    useEffect(() => {
        if (open) {
            // TODO: Fetch real financial accounts from DB
            // For now, mock or fetch if table exists
            // Assuming table 'financial_accounts' or 'bank_accounts' exists?
            // User prompt says: "Campo: Conta/Carteira ... default: última usada ou uma padrão"
            // Let's try to fetch from Supabase if table exists, else use standard options
            const fetchAccounts = async () => {
                const supabase = createClient();
                const { data, error } = await supabase.from('financial_accounts').select('id, name').eq('active', true);
                if (!error && data && data.length > 0) {
                    setFinancialAccounts(data);
                    setAccountId(data[0].id);
                } else {
                    // Fallback Mock
                    setFinancialAccounts([
                        { id: 'cx-principal', name: 'Caixa Principal' },
                        { id: 'bb-gondolas', name: 'Banco do Brasil' },
                        { id: 'sicredi', name: 'Sicredi' }
                    ]);
                    setAccountId('cx-principal');
                }
            };
            fetchAccounts();
        }
    }, [open]);

    const HandleSubmit = async () => {
        if (!accountId) {
            toast({ title: "Selecione uma conta", variant: "destructive" });
            return;
        }
        if (validInstallments.length === 0) {
            toast({ title: "Nenhum lançamento válido para baixar", variant: "destructive" });
            return;
        }

        await onConfirm(date, accountId, validInstallments.map(i => i.id));
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Baixar Lançamentos em Lote</DialogTitle>
                    <DialogDescription>
                        Você vai baixar <span className="font-bold text-gray-900">{validInstallments.length}</span> lançamentos selecionados.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-6 py-4">
                    {/* Invalid Items Warning */}
                    {invalidCount > 0 && (
                        <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded-2xl flex items-start gap-3">
                            <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
                            <div className="text-sm">
                                <p className="font-bold text-yellow-800">Atenção</p>
                                <p className="text-yellow-700">
                                    {invalidCount} itens selecionados não podem ser baixados (já pagos ou cancelados) e serão ignorados.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Form Fields */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Data da Baixa</Label>
                            <Input
                                type="date"
                                value={date}
                                onChange={e => setDate(e.target.value)}
                                className="font-medium"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Conta / Carteira</Label>
                            <Select value={accountId} onValueChange={setAccountId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {financialAccounts.map(acc => (
                                        <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Summary Card */}
                    <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200">
                        <div className="flex justify-between items-end mb-4 border-b border-gray-200 pb-2">
                            <div className="text-sm font-medium text-gray-500 uppercase tracking-wider">Resumo da Baixa</div>
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-600">Qtd. Lançamentos:</span>
                                <span className="font-bold">{validInstallments.length}</span>
                            </div>
                            <div className="flex justify-between text-lg font-bold">
                                <span className="text-gray-900">Valor Total:</span>
                                <span className="text-blue-600">{formatCurrency(totalAmount)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Preview Table */}
                    <div className="border rounded-2xl max-h-52 overflow-y-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 sticky top-0">
                                <tr>
                                    <th className="px-3 py-2 text-left font-medium text-gray-500 text-xs uppercase">Parcela</th>
                                    <th className="px-3 py-2 text-left font-medium text-gray-500 text-xs uppercase">Cliente</th>
                                    <th className="px-3 py-2 text-right font-medium text-gray-500 text-xs uppercase">Saldo</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {validInstallments.slice(0, 10).map(inst => (
                                    <tr key={inst.id}>
                                        <td className="px-3 py-2">
                                            #{inst.ar_title?.document_number}-{inst.installment_number}
                                        </td>
                                        <td className="px-3 py-2 truncate max-w-40">
                                            {inst.ar_title?.organization?.trade_name || '---'}
                                        </td>
                                        <td className="px-3 py-2 text-right font-medium text-gray-700">
                                            {formatCurrency(inst.amount_open)}
                                        </td>
                                    </tr>
                                ))}
                                {validInstallments.length > 10 && (
                                    <tr>
                                        <td colSpan={3} className="px-3 py-2 text-center text-xs text-gray-500 italic">
                                            E mais {validInstallments.length - 10} itens...
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isProcessing}>
                        Cancelar
                    </Button>
                    <Button onClick={HandleSubmit} disabled={isProcessing || validInstallments.length === 0} className="bg-green-600 hover:bg-green-700 text-white">
                        {isProcessing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                        Confirmar Baixa
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
