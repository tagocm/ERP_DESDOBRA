
"use client";

import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { CompanySettings, BankAccount, PaymentTerm, getBankAccounts, upsertBankAccount, deleteBankAccount, getPaymentTerms, upsertPaymentTerm, deletePaymentTerm } from "@/lib/data/company-settings";
import { useState, useEffect } from "react";
import { useCompany } from "@/contexts/CompanyContext";
import { createClient } from "@/lib/supabaseBrowser";
import { Plus, Trash2, Landmark, CreditCard, Loader2, Edit2, Search, Save, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription } from "@/components/ui/Dialog";
import { PaymentTermModal } from "./PaymentTermModal";
import { useToast } from "@/components/ui/use-toast";
import { formatCurrency } from "@/lib/utils";
import { DecimalInput } from "@/components/ui/DecimalInput";
import { BankSelector } from "@/components/ui/BankSelector";
import { Bank } from "@/lib/constants/banks";
import { ConfirmDialogDesdobra } from "@/components/ui/ConfirmDialogDesdobra";

import { Card, CardContent } from "@/components/ui/Card";
import { CardHeaderStandard } from "@/components/ui/CardHeaderStandard";

interface TabFinancialProps {
    data: Partial<CompanySettings>;
    onChange: (field: keyof CompanySettings, value: any) => void;
    isAdmin: boolean;
}

export function TabFinancial({ data, onChange, isAdmin }: TabFinancialProps) {
    const { selectedCompany } = useCompany();
    const supabase = createClient();
    const { toast } = useToast();

    // Sub-lists state
    const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
    const [terms, setTerms] = useState<PaymentTerm[]>([]);
    const [loadingLists, setLoadingLists] = useState(false);

    // Modal State
    const [termModalOpen, setTermModalOpen] = useState(false);
    const [termToEdit, setTermToEdit] = useState<PaymentTerm | null>(null);

    // Delete Confirmation State
    const [deleteState, setDeleteState] = useState<{
        open: boolean;
        type: 'term' | 'bank' | null;
        id: string | null;
        title: string;
        description: string;
    }>({ open: false, type: null, id: null, title: "", description: "" });
    const [isDeleting, setIsDeleting] = useState(false);

    // Refresh lists
    useEffect(() => {
        if (!selectedCompany) return;
        const load = async () => {
            setLoadingLists(true);
            try {
                const [banks, paymentTerms] = await Promise.all([
                    getBankAccounts(supabase, selectedCompany.id),
                    getPaymentTerms(supabase, selectedCompany.id)
                ]);
                setBankAccounts(banks);
                setTerms(paymentTerms);
            } catch (e) {
                console.error("Load Error:", JSON.stringify(e, null, 2));
            } finally {
                setLoadingLists(false);
            }
        };
        load();
    }, [selectedCompany]);

    // Handlers for Terms
    const handleOpenTermModal = (term?: PaymentTerm) => {
        setTermToEdit(term || null);
        setTermModalOpen(true);
    };

    const handleSaveTerm = async (termData: Partial<PaymentTerm>): Promise<boolean> => {
        if (!selectedCompany) return false;

        // Check for duplicates
        const isDuplicate = terms.some(t =>
            t.name === termData.name && t.id !== termData.id
        );

        if (isDuplicate) {
            toast({ title: "Erro", description: "Já existe um prazo com este nome (regra).", variant: "destructive" });
            return false;
        }
        try {
            await upsertPaymentTerm(supabase, {
                ...termData,
                company_id: selectedCompany.id
            });
            // Refresh
            const updated = await getPaymentTerms(supabase, selectedCompany.id);
            setTerms(updated);
            // Toast removed - now handled by PaymentTermModal
            return true;
        } catch (e: any) {
            console.error("Save Error:", JSON.stringify(e, null, 2));
            toast({ title: "Erro", description: "Erro ao salvar prazo.", variant: "destructive" });
            return false;
        }
    };

    const handleDeleteTerm = (id: string) => {
        setDeleteState({
            open: true,
            type: 'term',
            id,
            title: "Excluir Prazo?",
            description: "Tem certeza que deseja remover este prazo de pagamento? Essa ação não pode ser desfeita."
        });
    };

    // Handlers for Banks
    const handleAddBank = async (account: Partial<BankAccount>) => {
        if (!selectedCompany) return;
        try {
            await upsertBankAccount(supabase, {
                ...account,
                company_id: selectedCompany.id,
                is_active: true
            });
            const banks = await getBankAccounts(supabase, selectedCompany.id);
            setBankAccounts(banks);
        } catch (e) {
            toast({ title: "Erro", description: "Erro ao salvar conta bancária.", variant: "destructive" });
        }
    };

    const handleDeleteBank = (id: string) => {
        setDeleteState({
            open: true,
            type: 'bank',
            id,
            title: "Excluir Conta Bancária?",
            description: "Tem certeza que deseja remover esta conta bancária? O histórico financeiro não será afetado, mas a conta não aparecerá para novos pagamentos."
        });
    };

    const confirmDelete = async () => {
        if (!deleteState.id || !deleteState.type) return;
        setIsDeleting(true);
        try {
            if (deleteState.type === 'term') {
                await deletePaymentTerm(supabase, deleteState.id);
                setTerms(prev => prev.filter(t => t.id !== deleteState.id));
                toast({ title: "Sucesso", description: "Prazo removido." });
            } else if (deleteState.type === 'bank') {
                await deleteBankAccount(supabase, deleteState.id);
                setBankAccounts(prev => prev.filter(b => b.id !== deleteState.id));
                toast({ title: "Sucesso", description: "Conta removida." });
            }
            setDeleteState(prev => ({ ...prev, open: false }));
        } catch (e) {
            toast({ title: "Erro", description: "Erro ao excluir.", variant: "destructive" });
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="space-y-8">
            {/* PAYMENT TERMS CARD */}
            <Card>
                <CardHeaderStandard
                    icon={<CreditCard className="w-5 h-5 text-brand-600" />}
                    title="Condições de Pagamento"
                    actions={
                        <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleOpenTermModal()}
                            className="h-8 font-semibold"
                        >
                            <Plus className="w-4 h-4 mr-1.5" />
                            Adicionar Prazo
                        </Button>
                    }
                />

                <div className="p-6 pt-0 space-y-8">
                    {/* SECTION A: DEFAULTS */}
                    <div className="bg-gray-50/50 border border-gray-100 rounded-xl p-5">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-tight">Multa Padrão</label>
                                <div className="relative">
                                    <DecimalInput
                                        value={data.default_penalty_percent}
                                        onChange={v => onChange('default_penalty_percent', v)}
                                        className="w-full h-10 text-right pr-8 font-medium"
                                        precision={2}
                                        disabled={!isAdmin}
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium">%</span>
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-tight">Juros ao Mês</label>
                                <div className="relative">
                                    <DecimalInput
                                        value={data.default_interest_percent}
                                        onChange={v => onChange('default_interest_percent', v)}
                                        className="w-full h-10 text-right pr-8 font-medium"
                                        precision={2}
                                        disabled={!isAdmin}
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium">%</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* SECTION B: LIST OF TERMS */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2">
                            <Search className="w-4 h-4 text-gray-400" />
                            <h4 className="text-sm font-bold text-gray-900 tracking-tight">Prazos e Regras</h4>
                        </div>

                        <div className="overflow-hidden border border-gray-200 rounded-lg">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nome (Regra)</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Parcela Mínima</th>
                                        <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {terms.length === 0 && (
                                        <tr>
                                            <td colSpan={3} className="px-6 py-12 text-center text-sm text-gray-400 italic">
                                                Nenhum prazo cadastrado.
                                            </td>
                                        </tr>
                                    )}
                                    {terms.map((term) => (
                                        <tr key={term.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center">
                                                    <div className="flex-shrink-0 h-8 w-8 bg-brand-50 rounded flex items-center justify-center text-brand-600">
                                                        <CreditCard className="w-4 h-4" />
                                                    </div>
                                                    <div className="ml-4">
                                                        <div className="text-sm font-medium text-gray-900">{term.name}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {term.min_installment_amount ? formatCurrency(term.min_installment_amount) : '-'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                <button
                                                    onClick={() => handleOpenTermModal(term)}
                                                    className="text-brand-600 hover:text-brand-900 mr-4"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteTerm(term.id)}
                                                    className="text-red-600 hover:text-red-900"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </Card>

            {/* CARD: CONTAS BANCÁRIAS */}
            <Card>
                <CardHeaderStandard
                    icon={<Landmark className="w-5 h-5 text-brand-600" />}
                    title="Contas Bancárias"
                    actions={
                        isAdmin && (
                            <NewBankAccountDialog onSave={handleAddBank} />
                        )
                    }
                />
                <div className="p-6 pt-0">
                    {loadingLists ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-8 h-8 animate-spin text-brand-200" />
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {bankAccounts.length === 0 && (
                                <div className="col-span-full py-12 text-center border-2 border-dashed border-gray-100 rounded-xl">
                                    <p className="text-sm text-gray-400 italic">Nenhuma conta cadastrada.</p>
                                </div>
                            )}
                            {bankAccounts.map(acc => (
                                <div key={acc.id} className="flex items-center justify-between p-5 border border-gray-100 rounded-xl bg-white shadow-sm hover:border-brand-100 hover:shadow-md transition-all group">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-full bg-brand-50 flex items-center justify-center text-brand-600 border border-brand-100 group-hover:bg-brand-100 transition-colors">
                                            <Landmark className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <p className="font-bold text-gray-900 text-base leading-tight">{acc.bank_name}</p>
                                                <span className="text-[10px] font-black text-gray-400 border border-gray-200 px-1.5 py-0.5 rounded leading-none">{acc.bank_code}</span>
                                            </div>
                                            <p className="text-xs font-bold text-gray-500 mt-0.5 tracking-tight">
                                                Ag: <span className="text-gray-900 font-black">{acc.agency}</span> | CC: <span className="text-gray-900 font-black">{acc.account_number}</span>
                                                {acc.pix_key && (
                                                    <span className="ml-2 text-gray-400 font-normal">| PIX: <span className="text-gray-900 font-black">{acc.pix_key}</span></span>
                                                )}
                                                {acc.is_default && (
                                                    <span className="ml-2 bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-[9px] uppercase font-black tracking-wider shadow-sm">Padrão</span>
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                    {isAdmin && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-9 w-9 text-gray-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                                            onClick={() => handleDeleteBank(acc.id)}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </Card>

            <PaymentTermModal
                open={termModalOpen}
                onOpenChange={setTermModalOpen}
                onSave={handleSaveTerm}
                termToEdit={termToEdit}
            />

            <ConfirmDialogDesdobra
                open={deleteState.open}
                onOpenChange={(val) => setDeleteState(prev => ({ ...prev, open: val }))}
                title={deleteState.title}
                description={deleteState.description}
                onConfirm={confirmDelete}
                isLoading={isDeleting}
                variant="danger"
                confirmText="Excluir"
                cancelText="Cancelar"
            />
        </div>
    );
}



// Dialog for New Bank Account
function NewBankAccountDialog({ onSave }: { onSave: (acc: Partial<BankAccount>) => Promise<void> }) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [acc, setAcc] = useState({ bank_name: "", bank_code: "", agency: "", account_number: "", is_default: false, pix_key: "" });

    // Reset state when opening
    useEffect(() => {
        if (open) {
            setAcc({ bank_name: "", bank_code: "", agency: "", account_number: "", is_default: false, pix_key: "" });
        }
    }, [open]);

    const handleSave = async () => {
        if (!acc.bank_name || !acc.agency || !acc.account_number) return;
        setLoading(true);
        try {
            await onSave(acc);
            setOpen(false);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="sm" variant="secondary" className="h-8 font-semibold">
                    <Plus className="w-4 h-4 mr-1.5" />
                    Nova Conta
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[500px] w-full p-0 gap-0 bg-gray-50 overflow-hidden rounded-2xl border-none shadow-2xl">
                {/* Header */}
                <div className="bg-white px-6 py-4 border-b border-gray-100 flex justify-between items-center sticky top-0 z-10">
                    <div>
                        <DialogTitle className="text-xl font-bold text-gray-900 leading-tight">
                            Nova Conta Bancária
                        </DialogTitle>
                        <DialogDescription className="text-xs text-gray-500 mt-0.5 font-normal">
                            Cadastre uma nova conta para movimentações.
                        </DialogDescription>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-gray-400 hover:text-gray-600 rounded-full"
                        onClick={() => setOpen(false)}
                    >
                        <X className="w-4 h-4" />
                    </Button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto">
                    <div className="space-y-5">
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Banco</label>
                            <BankSelector
                                value={acc.bank_code || acc.bank_name}
                                onSelect={(bank: Bank) => setAcc({ ...acc, bank_name: bank.name, bank_code: bank.code })}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Agência</label>
                                <Input
                                    value={acc.agency}
                                    onChange={e => setAcc({ ...acc, agency: e.target.value })}
                                    className="h-9 rounded-lg border-gray-200 bg-white focus:border-brand-500 focus:ring-brand-500 transition-all font-medium"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Conta</label>
                                <Input
                                    value={acc.account_number}
                                    onChange={e => {
                                        const raw = e.target.value.replace(/\D/g, "");
                                        let formatted = raw;
                                        if (raw.length > 0) {
                                            if (raw.length === 1) {
                                                formatted = raw;
                                            } else {
                                                formatted = `${raw.slice(0, -1)}-${raw.slice(-1)}`;
                                            }
                                        }
                                        setAcc({ ...acc, account_number: formatted });
                                    }}
                                    className="h-9 rounded-lg border-gray-200 bg-white focus:border-brand-500 focus:ring-brand-500 transition-all font-medium"
                                    maxLength={20}
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Chave PIX (Opcional)</label>
                            <Input
                                value={acc.pix_key}
                                onChange={e => setAcc({ ...acc, pix_key: e.target.value })}
                                placeholder="CPF, CNPJ, Email, Celular ou Aleatória"
                                className="h-9 rounded-lg border-gray-200 bg-white focus:border-brand-500 focus:ring-brand-500 transition-all font-medium"
                            />
                        </div>

                        <div className="flex items-center gap-3 p-3 bg-white border border-gray-100 rounded-lg shadow-sm">
                            <input
                                type="checkbox"
                                checked={acc.is_default}
                                onChange={e => setAcc({ ...acc, is_default: e.target.checked })}
                                id="is_def"
                                className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                            />
                            <label htmlFor="is_def" className="text-sm font-medium text-gray-700 cursor-pointer select-none">
                                Definir como Conta Padrão
                            </label>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="bg-white px-6 py-3 border-t border-gray-100 flex gap-3 sticky bottom-0 z-10">
                    <Button
                        variant="ghost"
                        onClick={() => setOpen(false)}
                        className="flex-1 h-10 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-600 font-semibold transition-all"
                    >
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={loading || !acc.bank_name || !acc.agency || !acc.account_number}
                        className="flex-[2] h-10 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-bold shadow-lg shadow-brand-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Salvar Conta
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
