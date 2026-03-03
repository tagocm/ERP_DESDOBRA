"use client";


import { ReactNode } from "react";
import { ModuleTabs } from "@/components/app/ModuleTabs";

const tabs = [
    { name: "Planejamento", href: "/app/producao/planejamento" },
    { name: "Ordens", href: "/app/producao/ordens" },
    { name: "Fichas Técnicas", href: "/app/producao/fichas-tecnicas" },
    { name: "Apontamentos", href: "/app/producao/apontamentos" },
    { name: "Setores de Produção", href: "/app/producao/setores" },
];

export default function PcpLayout({ children }: { children: ReactNode }) {
    return (
        <div className="h-full w-full flex flex-col">
            <div className="px-6 pt-4 border-b border-gray-200 bg-white">
                <ModuleTabs items={tabs} />
            </div>
            <div className="flex-1 min-h-0">
                {children}
            </div>
        </div>
    );
}
