import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { FactorInstallmentsWithFactorPageClient } from "@/components/finance/factor/FactorInstallmentsWithFactorPageClient";
import { createClient } from "@/utils/supabase/server";

export const metadata: Metadata = {
    title: "Títulos na Factor | Financeiro",
    description: "Títulos em aberto/vencidos sob custody de factor",
};

export default async function FactorInstallmentsWithFactorPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        redirect("/login");
    }

    return (
        <div className="space-y-6 pb-8 animate-in fade-in duration-500">
            <PageHeader
                title="Títulos na Factor"
                subtitle="Acompanhamento diário dos títulos descontados e pendentes."
            />
            <FactorInstallmentsWithFactorPageClient />
        </div>
    );
}
