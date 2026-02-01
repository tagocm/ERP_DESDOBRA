"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabaseBrowser";
import { ArTitle, ArInstallment } from "@/types/financial";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/use-toast";
import { formatCurrency, cn } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import {
    Save,
    AlertTriangle,
    CheckCircle,
    Trash2,
    Plus,
    Coins,
    Link2Off,
    Loader2
} from "lucide-react";
import { PaymentMethodSelect } from "./PaymentMethodSelect";
import { InstallmentPaymentManager } from "./InstallmentPaymentManager";
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
    onDeleteTitle: (id: string) => void;
}

// Helper to format currency input (0,00)
const handleCurrencyInput = (val: string, setter: (num: number, str: string) => void) => {
    const numbers = val.replace(/\D/g, "");
    const amount = Number(numbers) / 100;
    const str = amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    setter(amount, str);
};

// Helper for initial format
const formatToInput = (val: number) => val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function ApprovalRowExpanded({ title, onRefresh, onApprove, onDeleteTitle }: Props) {
    const [installments, setInstallments] = useState<(ArInstallment & { _amountInput?: string, _overridden?: boolean })[]>([]);
    const [loading, setLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [generalPaymentMethod, setGeneralPaymentMethod] = useState(title.payment_method_snapshot || "");
    const [showDeleteTitleDialog, setShowDeleteTitleDialog] = useState(false);
    const { toast } = useToast();
    const supabase = createClient();
    const [payingInstId, setPayingInstId] = useState<string | null>(null);

    // Fetch Installments
    const fetchInstallments = async () => {
        setLoading(true);
        const { data } = await supabase
            .from('ar_installments')
            .select('*')
            .eq('ar_title_id', title.id)
            .order('installment_number', { ascending: true });

        if (data) {
            // Map to state with input helpers
            const mapped = data.map((d: ArInstallment) => ({
                ...d,
                _amountInput: formatToInput(d.amount_original),
                _overridden: false // Reset on fetch
            }));
            setInstallments(mapped);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchInstallments();
        setGeneralPaymentMethod(title.payment_method_snapshot || "");
    }, [title.id]);

    // --- Logic Functions ---

    const handleGeneralMethodChange = (newVal: string) => {
        setGeneralPaymentMethod(newVal);
        const newInsts = installments.map(i => {
            if (!i._overridden && i.status === 'OPEN') { // Only update if not overridden and open
                return { ...i, payment_method: newVal };
            }
            return i;
        });
        setInstallments(newInsts);
    };

    const handleInstallmentChange = (index: number, field: keyof ArInstallment | '_amountInput', value: any) => {
        const newInstallments = [...installments];
        const current = newInstallments[index];

        if (field === '_amountInput') {
            // Handle Currency Logic
            handleCurrencyInput(value, (num, str) => {
                newInstallments[index] = { ...current, amount_original: num, _amountInput: str };
            });
        } else if (field === 'payment_method') {
            // Mark as overridden
            newInstallments[index] = { ...current, payment_method: value, _overridden: true };
        } else {
            // Standard field
            newInstallments[index] = { ...current, [field]: value };
        }
        setInstallments(newInstallments);
    };

    const handleAddInstallment = () => {
        const lastInst = installments[installments.length - 1];
        let nextDate = new Date().toISOString().split('T')[0];
        if (lastInst) {
            const date = new Date(lastInst.due_date);
            date.setDate(date.getDate() + 30);
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
            _amountInput: "0,00",
            _overridden: false
        };

        setInstallments([...installments, newInst]);
    };

    const handleRemoveInstallment = (index: number) => {
        const inst = installments[index];
        if (inst.amount_paid > 0) {
            toast({ title: "Esta parcela possui pagamentos e não pode ser removida.", variant: "destructive" });
            return;
        }
        const filtered = installments.filter((_, i) => i !== index);
        // Renumber
        const renumbered = filtered.map((inst, i) => ({ ...inst, installment_number: i + 1 }));
        setInstallments(renumbered);
    };

    const totalInstallments = installments.reduce((acc, curr) => acc + Number(curr.amount_original || 0), 0);
    const diff = totalInstallments - (title.amount_total || 0);
    const isSumValid = Math.abs(diff) < 0.05;

    const handleSave = async () => {
        if (!isSumValid) {
            toast({ title: "A soma das parcelas não confere com o total. Ajuste os valores.", variant: "destructive" });
            return;
        }

        setIsSaving(true);
        try {
            // Update Title Config if changed
            if (generalPaymentMethod !== title.payment_method_snapshot) {
                await fetch(`/api/finance/titles/${title.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ payment_method_snapshot: generalPaymentMethod })
                });
            }

            // Upsert Installments (PUT assumes replacement or smart update)
            const response = await fetch(`/api/finance/titles/${title.id}/installments`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(installments.map(i => ({
                    id: i.id,
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

    if (loading) return (
        <div className="p-10 text-center">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500 mx-auto" />
            <span className="text-xs font-medium text-gray-400 mt-2 block">Carregando detalhes...</span>
        </div>
    );

    return (
        <Card className="border-gray-100 shadow-sm bg-white overflow-hidden">
            {/* Simple Summary Header */}
            <div className="px-6 py-4 bg-gray-50 flex flex-wrap gap-6 items-center border-b border-gray-100/50">
                <div className="flex gap-8">
                    <div className="flex flex-col">
                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Valor do Título</span>
                        <span className="text-lg font-bold text-gray-900">{formatCurrency(title.amount_total)}</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Soma Parcelas</span>
                        <div className={`flex items-center gap-2 text-lg font-bold ${isSumValid ? 'text-emerald-600' : 'text-red-600'}`}>
                            {formatCurrency(totalInstallments)}
                            {!isSumValid && <AlertTriangle className="w-4 h-4 text-red-500" />}
                        </div>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">A Receber</span>
                        <span className="text-lg font-bold text-blue-600">{formatCurrency(title.amount_open)}</span>
                    </div>
                </div>

                <div className="ml-auto">
                    <div className="flex flex-col items-end">
                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Aplicação Global</span>
                        <PaymentMethodSelect
                            value={generalPaymentMethod}
                            onChange={handleGeneralMethodChange}
                            className="h-8 text-xs border-gray-200 w-[200px]"
                        />
                    </div>
                </div>
            </div>

            <CardContent className="p-0">
                {/* Actions Bar */}
                <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100">
                    <h4 className="font-bold text-sm text-gray-700">Cronograma Financeiro ({installments.length} parcelas)</h4>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleAddInstallment}
                        disabled={title.status !== 'PENDING_APPROVAL'}
                        className="h-8 text-xs font-bold text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                    >
                        <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar Parcela
                    </Button>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50/50">
                            <tr>
                                <th className="px-6 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider w-12">#</th>
                                <th className="px-6 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider w-36">Vencimento</th>
                                <th className="px-6 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider w-36">Valor</th>
                                <th className="px-6 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider w-32">Pago</th>
                                <th className="px-6 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider w-32">Saldo</th>
                                <th className="px-6 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider">Modalidade</th>
                                <th className="px-6 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider w-24">Status</th>
                                <th className="px-6 py-3 text-right text-[10px] font-bold text-gray-400 uppercase tracking-wider w-28">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {installments.map((inst, index) => {
                                const isOverride = inst._overridden;
                                const isEditable = title.status === 'PENDING_APPROVAL' && inst.status === 'OPEN';

                                return (
                                    <tr key={index} className="group hover:bg-gray-50/50 transition-colors">
                                        <td className="px-6 py-3 font-bold text-gray-500 text-xs">{inst.installment_number}</td>
                                        <td className="px-6 py-3">
                                            {isEditable ? (
                                                <Input
                                                    type="date"
                                                    className="h-8 text-xs border-transparent bg-transparent hover:border-gray-200 focus:bg-white focus:border-blue-300 w-full"
                                                    value={inst.due_date}
                                                    onChange={(e) => handleInstallmentChange(index, 'due_date', e.target.value)}
                                                />
                                            ) : (
                                                <span className="text-xs text-gray-700 font-medium">{new Date(inst.due_date).toLocaleDateString('pt-BR')}</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-3">
                                            {isEditable ? (
                                                <div className="relative">
                                                    <Input
                                                        type="text"
                                                        className="h-8 text-xs pl-6 border-transparent bg-transparent hover:border-gray-200 focus:bg-white focus:border-blue-300 w-full font-bold text-gray-900"
                                                        value={inst._amountInput}
                                                        onChange={(e) => handleInstallmentChange(index, '_amountInput', e.target.value)}
                                                    />
                                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">R$</span>
                                                </div>
                                            ) : (
                                                <span className="text-xs font-bold text-gray-900">{formatCurrency(inst.amount_original)}</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-3 text-xs font-bold text-emerald-600">
                                            {formatCurrency(inst.amount_paid)}
                                        </td>
                                        <td className="px-6 py-3 text-xs font-bold text-blue-600">
                                            {formatCurrency(inst.amount_open)}
                                        </td>
                                        <td className="px-6 py-3">
                                            <div className="flex items-center gap-2">
                                                {isEditable ? (
                                                    <PaymentMethodSelect
                                                        value={inst.payment_method}
                                                        onChange={(val) => handleInstallmentChange(index, 'payment_method', val)}
                                                        className="h-8 text-xs border-transparent bg-transparent hover:border-gray-200 focus:bg-white"
                                                    />
                                                ) : (
                                                    <span className="text-xs text-gray-600 font-medium">{inst.payment_method}</span>
                                                )}
                                                {isOverride && <span title="Manual"><Link2Off className="w-3 h-3 text-orange-400" /></span>}
                                            </div>
                                        </td>
                                        <td className="px-6 py-3">
                                            <Badge variant="outline" className={cn(
                                                "text-[9px] font-bold px-2 py-0.5 uppercase",
                                                inst.status === 'PAID' ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
                                                    inst.status === 'PARTIAL' ? "bg-indigo-50 text-indigo-700 border-indigo-100" : "bg-gray-50 text-gray-600"
                                            )}>
                                                {inst.status === 'OPEN' ? 'Aberto' : inst.status === 'PAID' ? 'Pago' : 'Parcial'}
                                            </Badge>
                                        </td>
                                        <td className="px-6 py-3">
                                            <div className="flex justify-end gap-1">
                                                <Popover open={payingInstId === inst.id} onOpenChange={(o) => {
                                                    if (!o) setPayingInstId(null);
                                                    else {
                                                        setPayingInstId(inst.id);
                                                    }
                                                }}>
                                                    <PopoverTrigger asChild>
                                                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-emerald-600 hover:bg-emerald-50" title="Registrar Pagamento">
                                                            <Coins className="w-3.5 h-3.5" />
                                                        </Button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-auto p-0 border-none shadow-xl bg-white rounded-xl" align="end" sideOffset={5}>
                                                        <InstallmentPaymentManager
                                                            installment={inst}
                                                            onUpdate={() => {
                                                                fetchInstallments();
                                                                onRefresh(); // Refresh parent status
                                                            }}
                                                            onClose={() => setPayingInstId(null)}
                                                        />
                                                    </PopoverContent>
                                                </Popover>

                                                {isEditable && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-7 w-7 p-0 text-red-400 hover:text-red-600 hover:bg-red-50"
                                                        onClick={() => handleRemoveInstallment(index)}
                                                        title="Remover Parcela"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </Button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Footer Actions */}
                <div className="bg-gray-50 p-4 border-t border-gray-100 flex justify-between items-center">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-400 hover:text-red-600 hover:bg-red-50 text-xs font-bold"
                        onClick={() => setShowDeleteTitleDialog(true)}
                        disabled={title.amount_paid > 0}
                    >
                        <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Excluir Lançamento
                    </Button>

                    <div className="flex items-center gap-3">
                        {!isSumValid && <span className="text-xs text-red-500 font-bold mr-2">Soma inválida!</span>}
                        <Button
                            variant="outline"
                            className="bg-white text-xs font-bold h-9"
                            onClick={handleSave}
                            disabled={isSaving}
                        >
                            {isSaving ? <Loader2 className="w-3 h-3 animate-spin mr-1.5" /> : <Save className="w-3.5 h-3.5 mr-1.5 text-blue-600" />}
                            Salvar Alterações
                        </Button>
                        <Button
                            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold h-9"
                            onClick={() => onApprove(title.id)}
                            disabled={!isSumValid || isSaving || title.status !== 'PENDING_APPROVAL'}
                        >
                            <CheckCircle className="w-3.5 h-3.5 mr-1.5" />
                            Aprovar Lançamento
                        </Button>
                    </div>
                </div>
            </CardContent>

            <AlertDialog open={showDeleteTitleDialog} onOpenChange={setShowDeleteTitleDialog}>
                <AlertDialogContent className="rounded-xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Excluir Lançamento?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta ação cancelará o lançamento financeiro. O histórico do pedido (Em Rota) não será alterado automaticamente (verifique o status logístico).
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => onDeleteTitle(title.id)} className="bg-red-600 hover:bg-red-700">
                            Confirmar Exclusão
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Card>
    );
}
