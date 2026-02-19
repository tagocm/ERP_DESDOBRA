import { PageHeader } from "@/components/ui/PageHeader";
import { AccountsTable } from "@/components/finance/AccountsTable";
import { Suspense } from "react";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";

export default async function AccountsPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) redirect("/login");

    // Fetch company_id
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
            <div className="p-10 text-center text-red-600 font-bold">
                Erro: Nenhuma empresa associada ao seu usuário.
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-10 animate-in fade-in duration-500">
            <PageHeader
                title="Contas"
                subtitle="Gerencie suas contas a receber e a pagar em um único lugar."
            />

            <main className="px-6">
                <Suspense fallback={<div className="p-10 text-center text-gray-500">Carregando dados financeiros...</div>}>
                    <AccountsTable companyId={companyId} />
                </Suspense>
            </main>
        </div>
    );
}
