import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { FactorOperationDetailPageClient } from "@/components/finance/factor/FactorOperationDetailPageClient";
import { createClient } from "@/utils/supabase/server";

export const metadata: Metadata = {
    title: "Operação de Factor | Financeiro",
    description: "Detalhe da operação de desconto de duplicatas",
};

export default async function FactorOperationDetailPage(
    { params }: { params: Promise<{ id: string }> },
) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        redirect("/login");
    }

    const resolved = await params;

    return (
        <div className="space-y-6 pb-8 animate-in fade-in duration-500">
            <PageHeader
                title="Operação de Desconto"
                subtitle="Gerencie pacote, retorno da factor e conclusão financeira."
            />
            <FactorOperationDetailPageClient operationId={resolved.id} />
        </div>
    );
}
