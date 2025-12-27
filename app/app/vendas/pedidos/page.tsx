
import { createClient } from "@/utils/supabase/server";
import { getSalesDocuments, SalesFilters as FilterType } from "@/lib/data/sales-orders";
import { PageHeader } from "@/components/ui/PageHeader"; // Assuming this exists or I'll use a local header
import { SalesFiltersWrapper } from "@/components/sales/SalesFiltersWrapper";
import { SalesTable } from "@/components/sales/SalesTable";
import { Button } from "@/components/ui/Button";
import { Plus, Download } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function SalesOrdersPage({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
    const params = await searchParams;
    const supabase = await createClient();

    // Auth Check
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        // redirect('/login'); // Let middleware handle this ideally
    }

    // Parse Filters
    const page = Number(params.page) || 1;
    const filters: FilterType = {
        page,
        limit: 20,
        search: (params.search as string) || undefined,
        docType: (params.docType as string) || 'all',
        dateFrom: (params.dateFrom as string) || undefined,
        dateTo: (params.dateTo as string) || undefined,
        statusCommercial: (params.statusCommercial as string) || undefined,
        statusLogistic: (params.statusLogistic as string) || undefined,
        financialStatus: (params.financialStatus as string) || undefined,
        clientSearch: (params.clientSearch as string) || undefined,
        routeFilter: (params.routeFilter as 'all' | 'no_route' | 'with_route') || 'all',
    };

    let data: any[] = [];
    let count = 0;
    let error = null;

    try {
        const result = await getSalesDocuments(supabase, filters);
        data = result.data;
        count = result.count || 0;
    } catch (e) {
        console.error("Error loading sales orders:", e);
        error = e;
    }

    return (
        <div className="space-y-6">
            <PageHeader
                title="Pedidos"
                subtitle="Gerencie pedidos e propostas, acompanhe status comercial, fiscal e logístico."
                actions={
                    <div className="flex gap-2">
                        <Button variant="secondary" className="font-medium">
                            <Download className="w-4 h-4 mr-2" /> Exportar
                        </Button>
                        <Link href="/app/vendas/pedidos/novo">
                            <Button>
                                <Plus className="w-4 h-4 mr-2" /> Novo Pedido
                            </Button>
                        </Link>
                    </div>
                }
            />

            <div className="px-6">
                <SalesFiltersWrapper initialFilters={filters} />

                <div className="mt-6">
                    <SalesTable data={data} isLoading={false} />
                </div>

                {/* Pagination (Simple Implementation) */}
                <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
                    <div>
                        Mostrando {(page - 1) * 20 + 1} a {Math.min(page * 20, count || 0)} de {count} resultados
                    </div>
                    <div className="flex gap-2">
                        <Link href={`?page=${Math.max(1, page - 1)}`} className={page <= 1 ? "pointer-events-none opacity-50" : ""}>
                            <Button variant="outline" size="sm" disabled={page <= 1}>Anterior</Button>
                        </Link>
                        <Link href={`?page=${page + 1}`} className={20 * page >= (count || 0) ? "pointer-events-none opacity-50" : ""}>
                            <Button variant="outline" size="sm" disabled={20 * page >= (count || 0)}>Próxima</Button>
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}