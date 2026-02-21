import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { CardHeaderStandard } from "@/components/ui/CardHeaderStandard";
import { Button } from "@/components/ui/Button";
import { Plus, History } from "lucide-react";
import { RecurringRulesToolbar } from "@/components/finance/recurring/RecurringRulesToolbar";
import { RecurringRulesTable } from "@/components/finance/recurring/RecurringRulesTable";
import { getRecurringRules, GetRecurringRulesFilters } from "@/lib/data/finance/recurring-rules";
import { RecurringRuleStatus, AmountType } from "@/types/recurring-rules";
import Link from "next/link";
import { Metadata } from "next";

export const metadata: Metadata = {
    title: "Fatos Geradores | Financeiro",
    description: "Gerenciamento de despesas recorrentes e contratos",
};

interface PageProps {
    searchParams: Promise<{
        q?: string;
        status?: string;
        type?: string;
        sort?: string;
    }>;
}

export default async function RecurringRulesPage({ searchParams }: PageProps) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) redirect("/login");

    const params = await searchParams;

    // Build filters
    const filters: GetRecurringRulesFilters = {
        search: params.q,
        status: (params.status as RecurringRuleStatus) || "ALL",
        type: (params.type as AmountType) || "ALL",
        sortBy: (params.sort as any) || "recent",
    };

    // Fetch data
    const rules = await getRecurringRules(filters);

    return (
        <div className="flex flex-col min-h-screen bg-gray-50/50 animate-in fade-in duration-500">
            <PageHeader
                title="Fatos Geradores"
                description="Gestão de despesas recorrentes, assinaturas e contratos de manutenção."
                actions={
                    <Link href="/app/financeiro/fatos-geradores/novo">
                        <Button variant="pill">
                            <Plus className="w-4 h-4 mr-2" /> Novo Fato Gerador
                        </Button>
                    </Link>
                }
            />

            <main className="flex-1 p-6 w-full">
                <Card className="border-none shadow-card overflow-hidden">
                    <CardHeaderStandard
                        title="Lista de Regras"
                        description="Visualize e gerencie as regras de geração automática de lançamentos."
                        icon={<History className="w-5 h-5" />}
                    />

                    <RecurringRulesToolbar />
                    <RecurringRulesTable rules={rules} />
                </Card>
            </main>
        </div>
    );
}
