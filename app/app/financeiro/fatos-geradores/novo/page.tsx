import { PageHeader } from "@/components/ui/PageHeader";
import { RecurringRuleForm } from "@/components/finance/recurring/RecurringRuleForm";
import { Metadata } from "next";

export const metadata: Metadata = {
    title: "Novo Fato Gerador | Financeiro",
    description: "Cadastro de contrato de despesa recorrente",
};

export default function NewRecurringRulePage() {
    return (
        <div className="flex flex-col min-h-screen bg-gray-50/50 animate-in fade-in duration-500">
            <PageHeader
                title="Cadastrar Fato Gerador"
                description="Crie um contrato recorrente para gerar lançamentos automaticamente."
            />

            <main className="flex-1 p-6 w-full">
                <RecurringRuleForm />
            </main>
        </div>
    );
}
