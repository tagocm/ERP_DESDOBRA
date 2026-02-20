import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { FactorOperationsPageClient } from "@/components/finance/factor/FactorOperationsPageClient";
import { createClient } from "@/utils/supabase/server";

export const metadata: Metadata = {
    title: "Desconto de Duplicatas | Financeiro",
    description: "Gestão de operações com factor",
};

export default async function FactorDiscountOperationsPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        redirect("/login");
    }

    return (
        <div className="space-y-6 pb-8 animate-in fade-in duration-500">
            <PageHeader
                title="Desconto de Duplicatas"
                subtitle="Fluxo completo: rascunho, envio, retorno da factor, ajuste e conclusão."
            />
            <FactorOperationsPageClient />
        </div>
    );
}
