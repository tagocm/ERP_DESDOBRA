import { PageHeader } from "@/components/ui/PageHeader";
import { RecurringRuleForm } from "@/components/finance/recurring/RecurringRuleForm";
import { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Save } from "lucide-react";

export const metadata: Metadata = {
    title: "Novo Fato Gerador | Financeiro",
    description: "Cadastro de contrato de despesa recorrente",
};

export default function NewRecurringRulePage() {
    return (
        <div className="flex flex-col min-h-screen bg-gray-50/50 animate-in fade-in duration-500">
            <PageHeader
                title="Cadastrar Fato Gerador"
                description="Crie uma regra recorrente para gerar lançamentos automaticamente."
                actions={
                    <div className="flex items-center gap-3">
                        <Link href="/app/financeiro/fatos-geradores">
                            <Button variant="ghost" type="button" className="text-gray-500 hover:text-gray-900">
                                Cancelar
                            </Button>
                        </Link>
                        <Button type="submit" form="recurring-rule-form" variant="pill" size="lg" className="bg-brand-600 hover:bg-brand-700 text-white min-w-40">
                            <Save className="w-4 h-4 mr-2" />
                            Salvar
                        </Button>
                    </div>
                }
            />

            <main className="flex-1 w-full">
                <div className="max-w-screen-2xl mx-auto px-6 pb-6">
                    <RecurringRuleForm />
                </div>
            </main>
        </div>
    );
}
