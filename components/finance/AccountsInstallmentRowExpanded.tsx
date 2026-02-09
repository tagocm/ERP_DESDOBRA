"use client";

import { useState, useEffect } from "react";
import { ArInstallmentDTO } from "@/lib/types/financial-dto";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Plus, Info } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { createClient } from "@/lib/supabaseBrowser";

interface AccountsInstallmentRowExpandedProps {
    installment: ArInstallmentDTO;
    onRefresh: () => void;
}

export function AccountsInstallmentRowExpanded({ installment, onRefresh }: AccountsInstallmentRowExpandedProps) {
    const allocations = installment.ar_payment_allocations || [];
    const { toast } = useToast();

    // Form State
    const [amount, setAmount] = useState(installment.amount_open);
    const [amountStr, setAmountStr] = useState(installment.amount_open.toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
    const [method, setMethod] = useState("DINHEIRO");
    const [walletId, setWalletId] = useState("");

    // Additional Fields
    const [interest, setInterest] = useState(0);
    const [interestStr, setInterestStr] = useState("0,00");
    const [penalty, setPenalty] = useState(0);
    const [penaltyStr, setPenaltyStr] = useState("0,00");
    const [discount, setDiscount] = useState(0);
    const [discountStr, setDiscountStr] = useState("0,00");
    const [notes, setNotes] = useState("");

    // Smart Distribution State
    const [targetTotal, setTargetTotal] = useState<number | null>(null);

    const [isSaving, setIsSaving] = useState(false);
    const [financialAccounts, setFinancialAccounts] = useState<{ id: string, name: string }[]>([]);

    useEffect(() => {
        const fetchAccounts = async () => {
            const supabase = createClient();
            const { data, error } = await supabase.from('financial_accounts').select('id, name').eq('active', true);
            if (!error && data && data.length > 0) {
                setFinancialAccounts(data);
                setWalletId(data[0].id);
            } else {
                // Fallback
                const mocks = [
                    { id: 'cx-principal', name: 'Caixa Principal' },
                    { id: 'bb-gondolas', name: 'Banco do Brasil' },
                    { id: 'sicredi', name: 'Sicredi' }
                ];
                setFinancialAccounts(mocks);
                setWalletId(mocks[0].id);
            }
        };
        fetchAccounts();
    }, []);

    const parseCurrency = (val: string) => {
        const numbers = val.replace(/\D/g, "");
        return Number(numbers) / 100;
    };

    const formatBRL = (num: number) => {
        return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const handleAmountChange = (val: string) => {
        const newAmount = parseCurrency(val);

        if (newAmount > installment.amount_open) {
            // Spillover Logic
            const diff = newAmount - installment.amount_open;

            setAmount(installment.amount_open);
            setAmountStr(formatBRL(installment.amount_open));

            setInterest(diff);
            setInterestStr(formatBRL(diff));

            setPenalty(0);
            setPenaltyStr("0,00");

            setTargetTotal(newAmount); // Remember the user's intended total
        } else {
            setAmount(newAmount);
            setAmountStr(formatBRL(newAmount));
            setTargetTotal(null); // Reset if normal amount
        }
    };

    const handleInterestChange = (val: string) => {
        const newInterest = parseCurrency(val);
        setInterest(newInterest);
        setInterestStr(formatBRL(newInterest));

        // If we have a target total (implied overflow), and user reduces interest, 
        // spill remainder to penalty.
        if (targetTotal !== null) {
            // Check if (Open + NewInterest) < TargetTotal
            // We use installment.amount_open because Amount is clamped to open in overflow mode
            const currentTotal = installment.amount_open + newInterest;

            if (currentTotal < targetTotal) {
                const remaining = targetTotal - currentTotal;
                setPenalty(remaining);
                setPenaltyStr(formatBRL(remaining));
            }
            // If currentTotal >= targetTotal, we don't reduce penalty automatically (user might be increasing interest)
            // But we might want to update targetTotal if they explicitly increase it?
            // For now, let's strictly follow "if ... still smaller ... add to penalty".
        }
    };

    // Generic handler for others
    const handleCurrencyChange = (val: string, setterNum: (n: number) => void, setterStr: (s: string) => void) => {
        const num = parseCurrency(val);
        setterNum(num);
        setterStr(formatBRL(num));
    };

    const handleRegisterPayment = async () => {
        if (amount <= 0) {
            toast({ title: "Valor deve ser maior que zero", variant: "destructive" });
            return;
        }
        setIsSaving(true);
        try {
            const response = await fetch(`/api/finance/installments/${installment.id}/pay`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    amount,
                    method,
                    interest_amount: interest,
                    penalty_amount: penalty,
                    discount_amount: discount,
                    notes,
                    financial_account_id: walletId
                })
            });

            if (!response.ok) throw new Error('Falha ao registrar pagamento');

            toast({ title: "Pagamento registrado com sucesso" });

            setInterest(0); setInterestStr("0,00");
            setPenalty(0); setPenaltyStr("0,00");
            setDiscount(0); setDiscountStr("0,00");
            setNotes("");
            setTargetTotal(null);
            onRefresh();

        } catch (error) {
            toast({ title: "Erro ao salvar", variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="animate-in slide-in-from-top-2">

            {/* Compact Summary Strip */}
            <div className="flex items-center gap-6 mb-4 px-1 text-sm bg-gray-50/50 p-2 rounded-2xl border border-gray-100 w-fit">
                <div className="flex items-baseline gap-2">
                    <span className="text-[10px] font-bold text-gray-400 uppercase">Original:</span>
                    <span className="font-bold text-gray-900">{formatCurrency(installment.amount_original)}</span>
                </div>
                <div className="h-3 w-px bg-gray-300"></div>
                <div className="flex items-baseline gap-2">
                    <span className="text-[10px] font-bold text-gray-400 uppercase">Pago:</span>
                    <span className="font-bold text-green-700">{formatCurrency(installment.amount_paid)}</span>
                </div>
                <div className="h-3 w-px bg-gray-300"></div>
                <div className="flex items-baseline gap-2">
                    <span className="text-[10px] font-bold text-gray-400 uppercase">Aberto:</span>
                    <span className="font-bold text-blue-700">{formatCurrency(installment.amount_open)}</span>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

                {/* Left Column (2/3): Payment History */}
                <div className="lg:col-span-2 flex flex-col">
                    <Card className="overflow-hidden flex-1 flex flex-col h-full">
                        <div className="bg-gray-50/50 border-b border-gray-100 px-3 py-2 flex justify-between items-center shrink-0">
                            <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Histórico de Pagamentos</h4>
                        </div>
                        {allocations.length === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 min-h-52">
                                <span className="text-xs italic">Nenhum pagamento registrado</span>
                            </div>
                        ) : (
                            <div className="overflow-y-auto flex-1 p-0">
                                <table className="w-full text-xs">
                                    <thead className="bg-gray-50/30 text-gray-500 uppercase font-medium sticky top-0">
                                        <tr>
                                            <th className="px-3 py-2 text-left">Data</th>
                                            <th className="px-3 py-2 text-left">Método</th>
                                            <th className="px-3 py-2 text-right">Valor</th>
                                            <th className="px-3 py-2 text-left w-1/3">Obs</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {allocations.map((alloc) => (
                                            <tr key={alloc.id} className="hover:bg-gray-50/50">
                                                <td className="px-3 py-2 text-gray-900 font-medium">
                                                    {alloc.ar_payments?.paid_at ? new Date(alloc.ar_payments.paid_at).toLocaleDateString('pt-BR', {
                                                        day: '2-digit', month: '2-digit', year: '2-digit'
                                                    }) : '-'}
                                                </td>
                                                <td className="px-3 py-2 text-gray-600 uppercase text-[10px] font-bold">
                                                    {alloc.ar_payments?.method || 'N/A'}
                                                </td>
                                                <td className="px-3 py-2 text-right font-bold text-green-700">
                                                    {formatCurrency(alloc.amount_allocated)}
                                                </td>
                                                <td className="px-3 py-2 text-gray-400 text-[10px] truncate max-w-40">
                                                    {alloc.ar_payments?.notes || '-'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </Card>
                </div>

                {/* Right Column (1/3): Payment Form */}
                <div className="h-full">
                    <Card className="p-3 h-full flex flex-col justify-start">
                        {/* Header with Title and Button */}
                        <div className="mb-4 pb-2 border-b border-gray-50 flex justify-between items-center">
                            <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Novo Pagamento</h4>
                            <Button
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-7 text-xs shadow-card px-3"
                                onClick={handleRegisterPayment}
                                disabled={isSaving || installment.status === 'PAID'}
                            >
                                {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : "Registrar"}
                            </Button>
                        </div>

                        {installment.status === 'PAID' ? (
                            <div className="flex-1 flex flex-col items-center justify-center gap-2 text-green-600 py-4">
                                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                                    <Plus className="w-4 h-4" />
                                </div>
                                <span className="text-sm font-bold">Totalmente Pago</span>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {/* Row 1: Valor + Método */}
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <Label className="text-[10px] text-gray-400 uppercase">Valor</Label>
                                        <div className="relative">
                                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-bold">R$</span>
                                            <Input
                                                value={amountStr}
                                                onChange={e => handleAmountChange(e.target.value)}
                                                className="h-8 text-xs font-bold pl-6 bg-gray-50/50"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <Label className="text-[10px] text-gray-400 uppercase">Método</Label>
                                        <Input
                                            value={method}
                                            onChange={e => setMethod(e.target.value.toUpperCase())}
                                            className="h-8 text-xs font-bold bg-gray-50/50 uppercase"
                                            placeholder="PIX"
                                        />
                                    </div>
                                </div>

                                {/* Row 2: Juros, Multa, Desconto (With Labels) */}
                                <div className="grid grid-cols-3 gap-2">
                                    <div>
                                        <Label className="text-[10px] text-gray-400 uppercase">Juros</Label>
                                        <Input
                                            value={interestStr}
                                            onChange={e => handleInterestChange(e.target.value)}
                                            className="h-8 text-[10px] text-red-600 bg-gray-50/30 px-1 text-center font-bold"
                                            placeholder="0,00"
                                        />
                                    </div>
                                    <div>
                                        <Label className="text-[10px] text-gray-400 uppercase">Multa</Label>
                                        <Input
                                            value={penaltyStr}
                                            onChange={e => handleCurrencyChange(e.target.value, setPenalty, setPenaltyStr)}
                                            className="h-8 text-[10px] text-red-600 bg-gray-50/30 px-1 text-center font-bold"
                                            placeholder="0,00"
                                        />
                                    </div>
                                    <div>
                                        <Label className="text-[10px] text-gray-400 uppercase">Desconto</Label>
                                        <Input
                                            value={discountStr}
                                            onChange={e => handleCurrencyChange(e.target.value, setDiscount, setDiscountStr)}
                                            className="h-8 text-[10px] text-emerald-600 bg-gray-50/30 px-1 text-center font-bold"
                                            placeholder="0,00"
                                        />
                                    </div>
                                </div>

                                {/* Row 3: Carteira + Obs */}
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <Label className="text-[10px] text-gray-400 uppercase">Carteira</Label>
                                        <Select value={walletId} onValueChange={setWalletId}>
                                            <SelectTrigger className="h-8 text-xs bg-gray-50/50">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {financialAccounts.map(acc => (
                                                    <SelectItem key={acc.id} value={acc.id} className="text-xs">{acc.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div>
                                        <Label className="text-[10px] text-gray-400 uppercase">Observação</Label>
                                        <Input
                                            value={notes}
                                            onChange={e => setNotes(e.target.value)}
                                            className="h-8 text-xs bg-gray-50/50"
                                            placeholder="..."
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </Card>
                </div>

            </div>
        </div>
    );
}
