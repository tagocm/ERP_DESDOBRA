"use client";

import { PurchasesFilters, PurchasesFiltersType } from "./PurchasesFilters";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback } from "react";

export function PurchasesFiltersWrapper({ initialFilters }: { initialFilters: PurchasesFiltersType }) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const handleFilterChange = useCallback((newFilters: PurchasesFiltersType) => {
        const params = new URLSearchParams(searchParams.toString());

        if (newFilters.search) params.set('search', newFilters.search);
        else params.delete('search');

        if (newFilters.status && newFilters.status !== 'all') params.set('status', newFilters.status);
        else params.delete('status');

        if (newFilters.dateFrom) params.set('dateFrom', newFilters.dateFrom);
        else params.delete('dateFrom');

        if (newFilters.dateTo) params.set('dateTo', newFilters.dateTo);
        else params.delete('dateTo');

        if (newFilters.showArchived) params.set('showArchived', 'true');
        else params.delete('showArchived');

        router.push(pathname + '?' + params.toString());
    }, [pathname, router, searchParams]);

    return <PurchasesFilters filters={initialFilters} onChange={handleFilterChange} />;
}
