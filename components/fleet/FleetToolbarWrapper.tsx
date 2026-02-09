"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { FleetToolbar } from "./FleetToolbar";

interface FleetToolbarWrapperProps {
    initialSearch: string;
    initialStatus: string;
    initialType: string;
}

export function FleetToolbarWrapper({
    initialSearch,
    initialStatus,
    initialType
}: FleetToolbarWrapperProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [isPending, startTransition] = useTransition();

    const updateFilter = (name: string, value: string) => {
        const params = new URLSearchParams(searchParams.toString());
        if (value && value !== 'all') {
            params.set(name, value);
        } else {
            params.delete(name);
        }

        startTransition(() => {
            router.push(`/app/frota?${params.toString()}`);
        });
    };

    return (
        <div className={isPending ? "opacity-50 pointer-events-none transition-opacity duration-200" : "transition-opacity duration-200"}>
            <FleetToolbar
                search={initialSearch}
                onSearchChange={(val) => updateFilter('q', val)}
                status={initialStatus}
                onStatusChange={(val) => updateFilter('status', val)}
                type={initialType}
                onTypeChange={(val) => updateFilter('type', val)}
            />
        </div>
    );
}
