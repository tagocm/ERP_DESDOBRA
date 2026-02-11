
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
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        // redirect('/login'); // Let middleware handle this ideally
    }

    // Parse Filters
    const page = Number(params.page) || 1;
    const pageSize = 100;
    const filters: FilterType = {
        page,
        limit: pageSize,
        search: (params.search as string) || undefined,
        docType: (params.docType as string) || 'all',
        dateFrom: (params.dateFrom as string) || undefined,
        dateTo: (params.dateTo as string) || undefined,
        statusCommercial: (params.statusCommercial as string) || undefined,
        statusLogistic: (params.statusLogistic as string) || undefined,
        financialStatus: (params.financialStatus as string) || undefined,
        clientSearch: (params.clientSearch as string) || undefined,
        routeFilter: (params.routeFilter as 'all' | 'no_route' | 'with_route') || 'all',
        showCancelled: params.showCancelled === 'true'
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

    const totalPages = Math.max(1, Math.ceil((count || 0) / pageSize));
    const pageWindowStart = Math.max(1, page - 2);
    const pageWindowEnd = Math.min(totalPages, pageWindowStart + 4);

    const buildPageHref = (targetPage: number) => {
        const search = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
            if (value === undefined) return;
            if (Array.isArray(value)) {
                value.forEach((item) => search.append(key, String(item)));
                return;
            }
            search.set(key, String(value));
        });
        search.set("page", String(targetPage));
        return `?${search.toString()}`;
    };

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
                        Mostrando {(page - 1) * pageSize + 1} a {Math.min(page * pageSize, count || 0)} de {count} resultados
                    </div>
                    <div className="flex items-center gap-2">
                        <Link href={buildPageHref(Math.max(1, page - 1))} className={page <= 1 ? "pointer-events-none opacity-50" : ""}>
                            <Button variant="outline" size="sm" disabled={page <= 1}>Anterior</Button>
                        </Link>
                        <div className="flex items-center gap-1">
                            {Array.from({ length: Math.max(0, pageWindowEnd - pageWindowStart + 1) }).map((_, index) => {
                                const pageNumber = pageWindowStart + index;
                                const isActive = pageNumber === page;
                                return (
                                    <Link key={pageNumber} href={buildPageHref(pageNumber)}>
                                        <Button variant={isActive ? "primary" : "outline"} size="sm" className="min-w-9">
                                            {pageNumber}
                                        </Button>
                                    </Link>
                                );
                            })}
                        </div>
                        <Link href={buildPageHref(page + 1)} className={pageSize * page >= (count || 0) ? "pointer-events-none opacity-50" : ""}>
                            <Button variant="outline" size="sm" disabled={pageSize * page >= (count || 0)}>Próxima</Button>
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
