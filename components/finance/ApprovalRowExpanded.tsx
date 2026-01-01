"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabaseBrowser";
import { ArTitle, ArInstallment } from "@/types/financial";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { useToast } from "@/components/ui/use-toast";
import { formatCurrency } from "@/lib/utils";
import {
    Save,
    AlertTriangle,
    CheckCircle,
    PauseCircle,
    Trash2,
    Plus,
    DollarSign,
    Link2,
    Link2Off,
    Loader2,
    Coins,
    X
} from "lucide-react";
import { PaymentMethodSelect } from "./PaymentMethodSelect";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Props {
    title: ArTitle;
    onRefresh: () => void;
    onApprove: (id: string) => void;
    onHold: (id: string) => void;
    onDeleteTitle: (id: string) => void;
}

export function ApprovalRowExpanded({ title, onRefresh, onApprove, onHold, onDeleteTitle }: Props) {
    const [installments, setInstallments] = useState<ArInstallment[]>([]);
    const [loading, setLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [generalPaymentMethod, setGeneralPaymentMethod] = useState(title.payment_method_snapshot || "");
    const [showDeleteTitleDialog, setShowDeleteTitleDialog] = useState(false);
    const { toast } = useToast();
    const supabase = createClient();

    // Fetch Installments
    const fetchInstallments = async () => {
        setLoading(true);
        const { data } = await supabase
            .from('ar_installments')
            .select('*')
            .eq('ar_title_id', title.id)
            .order('installment_number', { ascending: true });
        if (data) setInstallments(data as any);
        setLoading(false);
    };

    useEffect(() => {
        fetchInstallments();
        setGeneralPaymentMethod(title.payment_method_snapshot || "");
    }, [title.id]);

    // --- Logic Functions ---

    const handleGeneralMethodChange = (newVal: string) => {
        setGeneralPaymentMethod(newVal);
        // Apply to all installments that are not overrides? 
        // User said "Aplicar a nova modalidade em todas as parcelas automaticamente. Marcar que a parcela está sincronizada"
        // This implies forcing all.
        const newInsts = installments.map(i => ({ ...i, payment_method: newVal }));
        setInstallments(newInsts);
    };

    const handleInstallmentChange = (index: number, field: keyof ArInstallment, value: any) => {
        const newInstallments = [...installments];
        newInstallments[index] = { ...newInstallments[index], [field]: value };
        setInstallments(newInstallments);
    };

    const redistributeValues = (insts: ArInstallment[]) => {
        const count = insts.length;
        if (count === 0) return insts;
        const total = title.amount_total;
        const base = Math.floor((total / count) * 100) / 100;
        const remainder = Math.round((total - base * count) * 100) / 100;

        return insts.map((inst, idx) => ({
            ...inst,
            amount_original: idx === count - 1 ? Math.round((base + remainder) * 100) / 100 : base,
            amount_open: idx === count - 1 ? Math.round((base + remainder) * 100) / 100 : base, // Simplified, should account for paid
        }));
    };

    const handleAddInstallment = () => {
        const lastInst = installments[installments.length - 1];
        let nextDate = new Date().toISOString().split('T')[0];
        if (lastInst) {
            const date = new Date(lastInst.due_date);
            date.setDate(date.getDate() + 30); // Default 30 days or cadence
            nextDate = date.toISOString().split('T')[0];
        }

        const newInst: any = {
            installment_number: installments.length + 1,
            due_date: nextDate,
            amount_original: 0,
            amount_paid: 0,
            amount_open: 0,
            status: 'OPEN',
            payment_method: generalPaymentMethod,
            interest_amount: 0,
            penalty_amount: 0,
            discount_amount: 0
        };

        const newInsts = redistributeValues([...installments, newInst]);
        setInstallments(newInsts as ArInstallment[]);
    };

    const handleRemoveInstallment = (index: number) => {
        const inst = installments[index];
        if (inst.amount_paid > 0) {
            toast({ title: "Esta parcela possui pagamentos e não pode ser removida.", variant: "destructive" });
            return;
        }

        const filtered = installments.filter((_, i) => i !== index);
        // Correct numbers
        const renumbered = filtered.map((inst, i) => ({ ...inst, installment_number: i + 1 }));
        const redistributed = redistributeValues(renumbered);
        setInstallments(redistributed);
    };

    const totalInstallments = installments.reduce((acc, curr) => acc + Number(curr.amount_original || 0), 0);
    const diff = totalInstallments - (title.amount_total || 0);
    const isSumValid = Math.abs(diff) < 0.05;

    const handleSave = async () => {
        if (!isSumValid) {
            toast({ title: "A soma das parcelas não bate com o total", variant: "destructive" });
            return;
        }

        setIsSaving(true);
        try {
            // 1. Update Title Info if changed
            if (generalPaymentMethod !== title.payment_method_snapshot) {
                await fetch(`/api/finance/titles/${title.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ payment_method_snapshot: generalPaymentMethod })
                });
            }

            // 2. Sync Installments
            const response = await fetch(`/api/finance/titles/${title.id}/installments`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(installments.map(i => ({
                    id: i.id, // existings have ID, new ones don't
                    installment_number: i.installment_number,
                    due_date: i.due_date,
                    amount_original: i.amount_original,
                    payment_method: i.payment_method
                })))
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Erro ao salvar parcelas');
            }

            toast({ title: "Alterações salvas com sucesso" });
            onRefresh();
        } catch (error: any) {
            toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };

    const [payingInstId, setPayingInstId] = useState<string | null>(null);
    const [payAmount, setPayAmount] = useState("");
    const [payMethod, setPayMethod] = useState("");
    const [isProcessingPayment, setIsProcessingPayment] = useState(false);

    const handleRegisterPayment = async (inst: ArInstallment) => {
        if (!payAmount || Number(payAmount) <= 0) {
            toast({ title: "Valor inválido", variant: "destructive" });
            return;
        }
        setIsProcessingPayment(true);
        try {
            const response = await fetch(`/api/finance/installments/${inst.id}/pay`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    amount: payAmount,
                    method: payMethod || inst.payment_method,
                    paid_at: new Date().toISOString()
                })
            });
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Erro ao processar pagamento');
            }
            toast({ title: "Pagamento registrado!" });
            setPayingInstId(null);
            setPayAmount("");
            fetchInstallments();
            onRefresh();
        } catch (error: any) {
            toast({ title: "Erro no pagamento", description: error.message, variant: "destructive" });
        } finally {
            setIsProcessingPayment(false);
        }
    };

    if (loading) return <div className="p-12 text-center text-gray-500 flex flex-col items-center gap-2">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        Carregando detalhes...
    </div>;

    return (
        <div className="bg-white border-x border-b p-6 space-y-6 shadow-md animate-in fade-in slide-in-from-top-4 duration-300">

            {/* Header: Global Settings & Summary */}
            <div className="flex flex-col md:flex-row gap-6 justify-between items-start">
                <div className="flex gap-8">
                    <div className="space-y-1">
                        <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Total Título</span>
                        <div className="text-2xl font-black text-gray-900">{formatCurrency(title.amount_total)}</div>
                    </div>
                    <div className="space-y-1">
                        <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Soma Parcelas</span>
                        <div className={`text-2xl font-black ${isSumValid ? 'text-green-600' : 'text-red-600'}`}>
                            {formatCurrency(totalInstallments)}
                            {!isSumValid && (
                                <span className="text-xs font-medium ml-2 opacity-70">
                                    ({diff > 0 ? '+' : ''}{formatCurrency(diff)})
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="space-y-1">
                        <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Saldo em Aberto</span>
                        <div className="text-2xl font-black text-blue-600 font-mono">{formatCurrency(title.amount_open)}</div>
                    </div>
                </div>

                <div className="flex flex-col gap-1 w-full md:w-64">
                    <Label className="text-[10px] text-gray-500 uppercase font-bold">Modalidade Geral</Label>
                    <PaymentMethodSelect
                        value={generalPaymentMethod}
                        onChange={handleGeneralMethodChange}
                        className="h-10 border-gray-200 shadow-sm"
                    />
                    <p className="text-[10px] text-gray-400 italic">Mudar gera replicação em massa.</p>
                </div>
            </div>

            {/* Installments Table */}
            <div className="space-y-3">
                <div className="flex justify-between items-end">
                    <h4 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                        Parcelas <Badge variant="outline" className="text-blue-600 border-blue-100 bg-blue-50/50">{installments.length}</Badge>
                    </h4>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleAddInstallment}
                        className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 h-8 gap-1 font-bold text-xs"
                    >
                        <Plus className="w-4 h-4" /> Adicionar Parcela
                    </Button>
                </div>

                <div className="border rounded-xl bg-white shadow-sm overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-gray-50/50 text-gray-400 text-[10px] uppercase font-bold border-b">
                                <th className="px-4 py-3 text-left w-12">#</th>
                                <th className="px-4 py-3 text-left w-44">Vencimento</th>
                                <th className="px-4 py-3 text-left w-40">Valor</th>
                                <th className="px-4 py-3 text-left">Modalidade</th>
                                <th className="px-4 py-3 text-left w-32">Pago</th>
                                <th className="px-4 py-3 text-left w-32">Saldo</th>
                                <th className="px-4 py-3 text-center">Status</th>
                                <th className="px-4 py-3 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {installments.map((inst, index) => {
                                const isOverride = inst.payment_method !== generalPaymentMethod && generalPaymentMethod !== "";
                                return (
                                    <tr key={index} className="hover:bg-gray-50/30 transition-colors group">
                                        <td className="px-4 py-4 font-black text-gray-400">{inst.installment_number}</td>
                                        <td className="px-4 py-4">
                                            <Input
                                                type="date"
                                                className="h-9 border-transparent group-hover:border-gray-200 transition-all focus:bg-white"
                                                value={inst.due_date}
                                                onChange={(e) => handleInstallmentChange(index, 'due_date', e.target.value)}
                                            />
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="relative group/val">
                                                <Input
                                                    type="number"
                                                    className="h-9 font-bold bg-transparent border-transparent group-hover:border-gray-200 pl-6"
                                                    value={inst.amount_original}
                                                    onChange={(e) => handleInstallmentChange(index, 'amount_original', e.target.value)}
                                                />
                                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-300 text-xs">R$</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="flex items-center gap-2">
                                                <PaymentMethodSelect
                                                    value={inst.payment_method}
                                                    onChange={(val) => handleInstallmentChange(index, 'payment_method', val)}
                                                    className="h-8 py-0 px-2 text-xs border-transparent hover:border-gray-100"
                                                />
                                                {isOverride ? (
                                                    <span title="Diverge do geral (Override)" className="text-orange-500"><Link2Off className="w-3 h-3" /></span>
                                                ) : (
                                                    <span title="Seguindo o geral" className="text-blue-300"><Link2 className="w-3 h-3" /></span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 text-xs font-medium text-green-600">
                                            {formatCurrency(inst.amount_paid)}
                                        </td>
                                        <td className="px-4 py-4 text-xs font-bold text-gray-700">
                                            {formatCurrency(inst.amount_open)}
                                        </td>
                                        <td className="px-4 py-4 text-center">
                                            <Badge
                                                variant="outline"
                                                className={
                                                    inst.status === 'PAID' ? "bg-green-50 text-green-600 border-green-100" :
                                                        inst.status === 'PARTIAL' ? "bg-orange-50 text-orange-600 border-orange-100" :
                                                            "bg-blue-50 text-blue-600 border-blue-100"
                                                }
                                            >
                                                {inst.status}
                                            </Badge>
                                        </td>
                                        <td className="px-4 py-4 text-right">
                                            <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">

                                                {/* Add Payment Popover */}
                                                <Popover open={payingInstId === inst.id} onOpenChange={(o) => {
                                                    if (!o) setPayingInstId(null);
                                                    else {
                                                        setPayingInstId(inst.id);
                                                        setPayAmount(String(inst.amount_open));
                                                        setPayMethod(inst.payment_method || "");
                                                    }
                                                }}>
                                                    <PopoverTrigger asChild>
                                                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50" title="Registrar Pagamento">
                                                            <Coins className="w-4 h-4" />
                                                        </Button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-64 p-4 space-y-4" align="end">
                                                        <div className="flex justify-between items-center">
                                                            <h5 className="font-bold text-xs uppercase tracking-tight">Baixa de Parcela #{inst.installment_number}</h5>
                                                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setPayingInstId(null)}><X className="w-3 h-3" /></Button>
                                                        </div>
                                                        <div className="space-y-3">
                                                            <div className="space-y-1">
                                                                <Label className="text-[10px]">Valor Recebido</Label>
                                                                <Input
                                                                    type="number"
                                                                    value={payAmount}
                                                                    onChange={e => setPayAmount(e.target.value)}
                                                                    className="h-8 font-bold"
                                                                />
                                                            </div>
                                                            <div className="space-y-1">
                                                                <Label className="text-[10px]">Modalidade</Label>
                                                                <PaymentMethodSelect
                                                                    value={payMethod}
                                                                    onChange={setPayMethod}
                                                                    className="h-8"
                                                                />
                                                            </div>
                                                            <Button
                                                                className="w-full bg-green-600 hover:bg-green-700 h-8 text-xs font-bold"
                                                                onClick={() => handleRegisterPayment(inst)}
                                                                disabled={isProcessingPayment}
                                                            >
                                                                {isProcessingPayment ? <Loader2 className="w-3 h-3 animate-spin" /> : "Confirmar Recebimento"}
                                                            </Button>
                                                        </div>
                                                    </PopoverContent>
                                                </Popover>

                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-8 w-8 p-0 text-red-400 hover:text-red-700 hover:bg-red-50"
                                                    onClick={() => handleRemoveInstallment(index)}
                                                    title="Remover Parcela"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Footer Actions */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 pt-4 border-t border-gray-100">
                <div className="flex gap-2 items-center">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:bg-red-50 gap-2 h-9 font-bold text-xs"
                        onClick={() => setShowDeleteTitleDialog(true)}
                        disabled={title.amount_paid > 0}
                    >
                        <Trash2 className="w-4 h-4" /> Excluir Lançamento Completo
                    </Button>
                </div>

                <div className="flex gap-3">
                    <Button
                        variant="outline"
                        className="h-10 px-6 font-bold border-gray-300 hover:bg-gray-50 flex gap-2"
                        onClick={handleSave}
                        disabled={isSaving}
                    >
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Salvar Alterações
                    </Button>

                    <div className="w-px bg-gray-200 h-10 hidden md:block" />

                    <Button
                        variant="secondary"
                        className="h-10 px-6 font-bold text-orange-700 bg-orange-100 hover:bg-orange-200 border-orange-200 gap-2"
                        onClick={() => onHold(title.id)}
                    >
                        <PauseCircle className="w-4 h-4" />
                        Segurar
                    </Button>

                    <Button
                        className="h-10 px-8 font-black bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-200 gap-2 disabled:bg-gray-200 disabled:shadow-none transition-all active:scale-95"
                        onClick={() => onApprove(title.id)}
                        disabled={!isSumValid || isSaving}
                    >
                        <CheckCircle className="w-5 h-5" />
                        {title.status === 'PENDING_APPROVAL' ? 'Aprovar Definitivo' : 'Confirmar Aprovação'}
                    </Button>
                </div>
            </div>

            {/* Delete Dialog */}
            <AlertDialog open={showDeleteTitleDialog} onOpenChange={setShowDeleteTitleDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Excluir Lançamento?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Isso removerá o título financeiro e todas as parcelas associadas.
                            Essa ação não pode ser desfeita.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => onDeleteTitle(title.id)}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            Confirmar Exclusão
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
