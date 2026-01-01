import { PageHeader } from "@/components/ui/PageHeader";
import { ApprovalTable } from "@/components/finance/ApprovalTable";
import { Metadata } from "next";

export const metadata: Metadata = {
    title: "Aprovação de Lançamentos | Financeiro",
    description: "Gerenciamento de lançamentos pendentes de aprovação",
};

export default function FinancialApprovalsPage() {
    return (
        <div className="flex flex-col min-h-screen bg-gray-50/50 animate-in fade-in duration-500">
            <PageHeader
                title="Aprovação de Lançamentos"
                description="Lançamentos gerados automaticamente por pedidos que entraram em rota."
            />

            <main className="flex-1 p-6 md:p-8 pt-0 space-y-6 max-w-[1600px] w-full mx-auto">
                <ApprovalTable />
            </main>
        </div>
    );
}
