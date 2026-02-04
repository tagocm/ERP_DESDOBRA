"use client";

import { useEffect, useState } from "react";
import { useCompany } from "@/contexts/CompanyContext";
import { createClient } from "@/lib/supabaseBrowser";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Plus, ArrowLeft, Calendar, Edit2, Trash2, CreditCard } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { PaymentTerm, getPaymentTerms, deletePaymentTerm, upsertPaymentTerm } from "@/lib/data/company-settings";
import { PaymentTermModal } from "@/components/settings/company/PaymentTermModal";
import { useToast } from "@/components/ui/use-toast";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

export default function PaymentTermsPage() {
    const { selectedCompany } = useCompany();
    const supabase = createClient();
    const { toast } = useToast();
    const [terms, setTerms] = useState<PaymentTerm[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [modalOpen, setModalOpen] = useState(false);
    const [termToEdit, setTermToEdit] = useState<PaymentTerm | null>(null);

    useEffect(() => {
        if (selectedCompany) {
            loadTerms();
        }
    }, [selectedCompany]);

    const loadTerms = async () => {
        if (!selectedCompany) return;
        setIsLoading(true);
        try {
            const data = await getPaymentTerms(supabase, selectedCompany.id);
            setTerms(data || []);
        } catch (error) {
            console.error(error);
            toast({
                title: "Erro ao carregar prazos",
                variant: "destructive"
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async (term: Partial<PaymentTerm>) => {
        if (!selectedCompany) return false;
        try {
            await upsertPaymentTerm(supabase, {
                ...term,
                company_id: selectedCompany.id
            });
            loadTerms();
            return true;
        } catch (error) {
            console.error(error);
            throw error;
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Tem certeza que deseja excluir este prazo?")) return;
        try {
            await deletePaymentTerm(supabase, id);
            toast({ title: "Prazo excluído" });
            loadTerms();
        } catch (error) {
            console.error(error);
            toast({ title: "Erro ao excluir", variant: "destructive" });
        }
    };

    const openNew = () => {
        setTermToEdit(null);
        setModalOpen(true);
    };

    const openEdit = (term: PaymentTerm) => {
        setTermToEdit(term);
        setModalOpen(true);
    };

    return (
        <div className="max-w-screen-2xl mx-auto px-6">
            <Link
                href="/app/settings/master-data"
                className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-6"
            >
                <ArrowLeft className="w-4 h-4 mr-1" />
                Voltar para Cadastros Básicos
            </Link>

            <PageHeader
                title="Prazos de Pagamento"
                subtitle="Configure as regras de parcelamento para vendas e compras."
                actions={
                    <Button onClick={openNew}>
                        <Plus className="w-4 h-4 mr-2" />
                        Novo Prazo
                    </Button>
                }
            />

            {isLoading ? (
                <div className="text-center py-12 text-gray-500">Carregando...</div>
            ) : terms.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-gray-200 rounded-2xl bg-gray-50/50">
                    <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3 opacity-50" />
                    <p className="text-sm font-semibold text-gray-500">Nenhum prazo cadastrado</p>
                    <p className="text-xs text-gray-400 mt-1">Crie opções de parcelamento para seus clientes.</p>
                </div>
            ) : (
                <Card className="overflow-hidden">
                    <Table>
                        <TableHeader className="bg-gray-50/50">
                            <TableRow className="hover:bg-transparent border-gray-100">
                                <TableHead className="px-6 h-11 text-xs font-bold text-gray-500 uppercase tracking-wider w-full">Nome (Regra)</TableHead>
                                <TableHead className="px-6 h-11 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Parcela Mínima</TableHead>
                                <TableHead className="px-6 h-11 text-xs font-bold text-gray-500 uppercase tracking-wider text-right pr-6">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {terms.map((term) => (
                                <TableRow key={term.id} className="group border-gray-50 hover:bg-gray-50/50 transition-colors">
                                    <TableCell className="px-6 py-4">
                                        <div className="flex items-center">
                                            <Card className="flex-shrink-0 h-9 w-9 bg-brand-50 flex items-center justify-center text-brand-600 border-brand-100/50">
                                                <CreditCard className="w-5 h-5" />
                                            </Card>
                                            <div className="ml-4">
                                                <div className="text-sm font-bold text-gray-900 leading-tight">
                                                    {term.name}
                                                </div>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="px-6 py-4 text-right">
                                        <span className="text-sm font-medium text-gray-600">
                                            {term.min_installment_amount
                                                ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(term.min_installment_amount)
                                                : '-'}
                                        </span>
                                    </TableCell>
                                    <TableCell className="px-6 py-4 text-right pr-6">
                                        <div className="flex justify-end gap-1">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 rounded-2xl hover:bg-blue-50 hover:text-blue-600 text-gray-400 transition-colors"
                                                onClick={() => openEdit(term)}
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 rounded-2xl hover:bg-red-50 hover:text-red-600 text-gray-400 transition-colors"
                                                onClick={() => handleDelete(term.id)}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </Card>
            )}

            <PaymentTermModal
                open={modalOpen}
                onOpenChange={setModalOpen}
                termToEdit={termToEdit}
                onSave={handleSave}
            />
        </div>
    );
}
