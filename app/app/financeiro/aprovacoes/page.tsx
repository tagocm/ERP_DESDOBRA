import { PageHeader } from "@/components/ui/PageHeader";
import { UnifiedApprovalTable } from "@/components/finance/UnifiedApprovalTable";
import { Metadata } from "next";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
    title: "Aprovação de Lançamentos | Financeiro",
    description: "Gerenciamento de lançamentos pendentes de aprovação",
};

export default async function FinancialApprovalsPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) redirect("/login");

    // Fetch company_id (metadata or member table)
    let companyId = user.user_metadata?.company_id;

    if (!companyId) {
        const { data: member } = await supabase
            .from('company_members')
            .select('company_id')
            .eq('auth_user_id', user.id)
            .limit(1)
            .single();

        if (member) {
            companyId = member.company_id;
        }
    }

    if (!companyId) {
        return (
            <div className="p-8 text-center text-red-600">
                Empresa não identificada.
            </div>
        );
    }

    return (
        <div className="flex flex-col min-h-screen bg-gray-50/50 animate-in fade-in duration-500">
            <PageHeader
                title="Aprovação de Lançamentos"
                description="Lançamentos gerados automaticamente por pedidos que entraram em rota."
            />

            <main className="flex-1 p-6 md:p-8 pt-0 space-y-6 w-full">
                <UnifiedApprovalTable companyId={companyId} />
            </main>
        </div>
    );
}
