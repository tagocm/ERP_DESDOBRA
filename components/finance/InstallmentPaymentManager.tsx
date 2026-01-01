"use client";

import { useState, useEffect } from "react";
import { ArInstallment } from "@/types/financial";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { formatCurrency } from "@/lib/utils";
import { Loader2, Plus, Trash2, X } from "lucide-react";
import { createClient } from "@/lib/supabaseBrowser";
import { useToast } from "@/components/ui/use-toast";

interface Props {
    installment: ArInstallment;
    onUpdate: () => void;
    onClose: () => void;
}

const formatDate = (date: string) => new Date(date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: '2-digit', minute: '2-digit' });

export function InstallmentPaymentManager({ installment, onUpdate, onClose }: Props) {
    const [payments, setPayments] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    // New Payment Form
    const [amount, setAmount] = useState(0);
    const [amountStr, setAmountStr] = useState("0,00");
    const [method, setMethod] = useState("DINHEIRO");

    // Additional Fields
    const [interest, setInterest] = useState(0);
    const [interestStr, setInterestStr] = useState("0,00");

    const [penalty, setPenalty] = useState(0);
    const [penaltyStr, setPenaltyStr] = useState("0,00");

    const [discount, setDiscount] = useState(0);
    const [discountStr, setDiscountStr] = useState("0,00");

    const [notes, setNotes] = useState("");

    const [isSaving, setIsSaving] = useState(false);
    const { toast } = useToast();
    const supabase = createClient();

    const fetchPayments = async () => {
        setLoading(true);
        const { data } = await supabase
            .from('ar_payment_allocations')
            .select(`
                id, amount, created_at,
                payment:ar_payments(id, method, notes, interest_amount, penalty_amount, discount_amount, date_paid)
            `)
            .eq('installment_id', installment.id)
            .order('created_at', { ascending: false });

        if (data) setPayments(data);
        setLoading(false);
    };

    useEffect(() => {
        fetchPayments();
        // Prefill with open amount
        const open = Number(installment.amount_open);
        setAmount(open);
        setAmountStr(open.toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
    }, [installment]);

    const handleCurrencyChange = (val: string, setterNum: any, setterStr: any) => {
        const numbers = val.replace(/\D/g, "");
        const num = Number(numbers) / 100;
        setterNum(num);
        setterStr(num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    };

    // Calculate Total Final
    const totalFinal = amount + interest + penalty - discount;

    const handleAdd = async () => {
        if (amount <= 0) {
            toast({ title: "Valor deve ser maior que zero", variant: "destructive" });
            return;
        }
        setIsSaving(true);
        try {
            // Updated Endpoint usage
            const response = await fetch(`/api/finance/installments/${installment.id}/pay`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    amount,
                    method,
                    interest_amount: interest,
                    penalty_amount: penalty,
                    discount_amount: discount,
                    notes
                })
            });

            if (!response.ok) throw new Error('Falha ao registrar pagamento');

            toast({ title: "Pagamento registrado com sucesso" });

            // Reset form
            setInterest(0); setInterestStr("0,00");
            setPenalty(0); setPenaltyStr("0,00");
            setDiscount(0); setDiscountStr("0,00");
            setNotes("");

            await fetchPayments();
            onUpdate();
            // Don't close immediately, let user see it added
        } catch (error) {
            toast({ title: "Erro ao salvar", variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (allocationId: string, paymentId: string) => {
        if (!confirm("Excluir este pagamento?")) return;
        try {
            const response = await fetch(`/api/finance/payments/${paymentId}`, {
                method: 'DELETE'
            });
            if (!response.ok) throw new Error('Erro ao excluir');

            toast({ title: "Pagamento excluído" });
            fetchPayments();
            onUpdate();
        } catch (e) {
            toast({ title: "Erro", variant: "destructive" });
        }
    };

    return (
        <div className="w-[400px] flex flex-col bg-white rounded-xl overflow-hidden border border-gray-100 shadow-2xl">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                <h4 className="font-bold text-sm text-gray-700">Gerenciar Pagamentos</h4>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onClose}>
                    <X className="w-4 h-4 text-gray-400" />
                </Button>
            </div>

            <div className="max-h-[300px] overflow-y-auto">
                {loading ? (
                    <div className="p-4 text-center"><Loader2 className="animate-spin w-4 h-4 mx-auto" /></div>
                ) : payments.length === 0 ? (
                    <div className="p-6 text-center text-xs text-gray-400 italic">Nenhum pagamento registrado</div>
                ) : (
                    <table className="w-full text-left">
                        <thead className="bg-gray-50/50 sticky top-0">
                            <tr>
                                <th className="px-4 py-2 text-[10px] uppercase text-gray-400 font-bold">Data</th>
                                <th className="px-4 py-2 text-[10px] uppercase text-gray-400 font-bold">Método</th>
                                <th className="px-4 py-2 text-[10px] uppercase text-gray-400 font-bold text-right">Valor</th>
                                <th className="w-8"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {payments.map(p => (
                                <tr key={p.id} className="group hover:bg-red-50/10 transition-colors">
                                    <td className="px-4 py-2 text-xs text-gray-600 font-medium">
                                        {formatDate(p.payment?.date_paid || p.created_at)}
                                    </td>
                                    <td className="px-4 py-2 text-xs text-gray-600">
                                        {p.payment?.method}
                                        {p.payment?.notes && <span className="block text-[9px] text-gray-400 truncate max-w-[100px]">{p.payment.notes}</span>}
                                    </td>
                                    <td className="px-4 py-2 text-xs font-bold text-gray-900 text-right">
                                        {formatCurrency(p.amount)}
                                    </td>
                                    <td className="px-2">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 w-6 p-0 text-gray-300 hover:text-red-500"
                                            onClick={() => handleDelete(p.id, p.payment?.id)}
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            <div className="bg-gray-50 p-4 border-t border-gray-100 space-y-3">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-2">Novo Pagamento</span>

                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                        <Label className="text-[10px] text-gray-500">Valor Principal</Label>
                        <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">R$</span>
                            <Input
                                value={amountStr}
                                onChange={e => handleCurrencyChange(e.target.value, setAmount, setAmountStr)}
                                className="h-8 text-xs font-bold pl-7 bg-white"
                            />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <Label className="text-[10px] text-gray-500">Método</Label>
                        <Input
                            value={method}
                            onChange={e => setMethod(e.target.value.toUpperCase())}
                            className="h-8 text-xs font-bold bg-white"
                            placeholder="Ex: PIX"
                        />
                    </div>
                </div>

                {/* Advanced Fields Row */}
                <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                        <Label className="text-[10px] text-gray-500">Juros (+)</Label>
                        <Input
                            value={interestStr}
                            onChange={e => handleCurrencyChange(e.target.value, setInterest, setInterestStr)}
                            className="h-7 text-[10px] font-medium bg-white text-red-600"
                        />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-[10px] text-gray-500">Multa (+)</Label>
                        <Input
                            value={penaltyStr}
                            onChange={e => handleCurrencyChange(e.target.value, setPenalty, setPenaltyStr)}
                            className="h-7 text-[10px] font-medium bg-white text-red-600"
                        />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-[10px] text-gray-500">Desconto (-)</Label>
                        <Input
                            value={discountStr}
                            onChange={e => handleCurrencyChange(e.target.value, setDiscount, setDiscountStr)}
                            className="h-7 text-[10px] font-medium bg-white text-emerald-600"
                        />
                    </div>
                </div>

                <div className="space-y-1">
                    <Label className="text-[10px] text-gray-500">Observações</Label>
                    <Input
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        className="h-7 text-xs bg-white"
                        placeholder="Info adicional..."
                    />
                </div>

                <div className="pt-2 flex justify-between items-center">
                    <div className="flex flex-col">
                        <span className="text-[9px] text-gray-400 font-bold uppercase">Total Final</span>
                        <span className="text-sm font-black text-gray-900">{formatCurrency(totalFinal)}</span>
                    </div>

                    <Button className="h-8 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleAdd} disabled={isSaving}>
                        {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3.5 h-3.5 mr-1.5" />}
                        Registrar
                    </Button>
                </div>
            </div>
        </div>
    );
}
