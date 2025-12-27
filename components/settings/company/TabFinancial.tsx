
"use client";

import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { CompanySettings, BankAccount, PaymentTerm, getBankAccounts, upsertBankAccount, deleteBankAccount, getPaymentTerms, upsertPaymentTerm, deletePaymentTerm } from "@/lib/data/company-settings";
import { useState, useEffect } from "react";
import { useCompany } from "@/contexts/CompanyContext";
import { createClient } from "@/lib/supabaseBrowser";
import { Plus, Trash2, Landmark, CreditCard, Loader2, Edit2, Search } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/Dialog";
import { PaymentTermModal } from "./PaymentTermModal";
import { useToast } from "@/components/ui/use-toast";
import { formatCurrency } from "@/lib/utils";
import { DecimalInput } from "@/components/ui/DecimalInput";
import { BankSelector } from "@/components/ui/BankSelector";
import { Bank } from "@/lib/constants/banks";

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

    const handleDeleteTerm = async (id: string) => {
        if (!confirm("Tem certeza que deseja excluir este prazo?")) return;
        try {
            await deletePaymentTerm(supabase, id);
            setTerms(prev => prev.filter(t => t.id !== id));
            toast({ title: "Sucesso", description: "Prazo removido." });
        } catch (e) {
            toast({ title: "Erro", description: "Erro ao excluir.", variant: "destructive" });
        }
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

    const handleDeleteBank = async (id: string) => {
        if (!confirm("Excluir conta?")) return;
        try {
            await deleteBankAccount(supabase, id);
            setBankAccounts(prev => prev.filter(b => b.id !== id));
        } catch (e) {
            toast({ title: "Erro", description: "Erro ao excluir.", variant: "destructive" });
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
        </div>
    );
}



// Dialog for New Bank Account
function NewBankAccountDialog({ onSave }: { onSave: (acc: Partial<BankAccount>) => Promise<void> }) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [acc, setAcc] = useState({ bank_name: "", bank_code: "", agency: "", account_number: "", is_default: false });

    const handleSave = async () => {
        if (!acc.bank_name || !acc.agency || !acc.account_number) return;
        setLoading(true);
        await onSave(acc);
        setLoading(false);
        setOpen(false);
        setAcc({ bank_name: "", bank_code: "", agency: "", account_number: "", is_default: false }); // Reset
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="sm" variant="secondary" className="h-8 font-semibold">
                    <Plus className="w-4 h-4 mr-1.5" />
                    Nova Conta
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Nova Conta Bancária</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Banco</label>
                        <BankSelector
                            value={acc.bank_code || acc.bank_name}
                            onSelect={(bank: Bank) => setAcc({ ...acc, bank_name: bank.name, bank_code: bank.code })}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Agência</label>
                            <Input value={acc.agency} onChange={e => setAcc({ ...acc, agency: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Conta</label>
                            <Input value={acc.account_number} onChange={e => setAcc({ ...acc, account_number: e.target.value })} />
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <input type="checkbox" checked={acc.is_default} onChange={e => setAcc({ ...acc, is_default: e.target.checked })} id="is_def" />
                        <label htmlFor="is_def" className="text-sm">Conta Padrão</label>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                    <Button onClick={handleSave} disabled={loading}>{loading ? "Salvando..." : "Salvar"}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
