"use client";


import { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { PcpModuleTabs } from "@/components/pcp/PcpModuleTabs";

export default function PcpLayout({ children }: { children: ReactNode }) {
    const pathname = usePathname();
    const pagesWithInlineTabs = [
        "/app/producao/ordens",
        "/app/producao/fichas-tecnicas",
        "/app/producao/apontamentos",
    ];
    const hideGlobalTabs = pagesWithInlineTabs.some(
        (basePath) => pathname === basePath || pathname.startsWith(`${basePath}/`)
    );

    return (
        <div className="h-full w-full flex flex-col">
            {!hideGlobalTabs && (
                <div className="px-6 pt-4 border-b border-gray-200 bg-white">
                    <PcpModuleTabs />
                </div>
            )}
            <div className="flex-1 min-h-0">
                {children}
            </div>
        </div>
    );
}
