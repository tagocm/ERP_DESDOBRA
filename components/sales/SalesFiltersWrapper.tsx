
"use client";

import { SalesFilters } from "./SalesFilters";
import { SalesFilters as FilterType } from "@/lib/data/sales-orders";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback } from "react";

export function SalesFiltersWrapper({ initialFilters }: { initialFilters: FilterType }) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const handleFilterChange = useCallback((newFilters: FilterType) => {
        const params = new URLSearchParams(searchParams?.toString() || '');

        if (newFilters.search) params.set('search', newFilters.search);
        else params.delete('search');

        if (newFilters.docType && newFilters.docType !== 'all') params.set('docType', newFilters.docType);
        else params.delete('docType');

        if (newFilters.dateFrom) params.set('dateFrom', newFilters.dateFrom);
        else params.delete('dateFrom');

        if (newFilters.dateTo) params.set('dateTo', newFilters.dateTo);
        else params.delete('dateTo');

        if (newFilters.statusCommercial) params.set('statusCommercial', newFilters.statusCommercial);
        else params.delete('statusCommercial');

        if (newFilters.statusLogistic) params.set('statusLogistic', newFilters.statusLogistic);
        else params.delete('statusLogistic');

        if (newFilters.showCancelled) params.set('showCancelled', 'true');
        else params.delete('showCancelled');

        // Reset page on filter change
        params.set('page', '1');

        router.push(pathname + '?' + params.toString());
    }, [pathname, router, searchParams]);

    return <SalesFilters filters={initialFilters} onChange={handleFilterChange} />;
}
