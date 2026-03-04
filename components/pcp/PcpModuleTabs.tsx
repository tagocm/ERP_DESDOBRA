"use client";

import { ModuleTabs } from "@/components/app/ModuleTabs";

const pcpTabs = [
    { name: "Planejamento", href: "/app/producao/planejamento" },
    { name: "Ordens", href: "/app/producao/ordens" },
    { name: "Fichas Técnicas", href: "/app/producao/fichas-tecnicas" },
    { name: "Apontamentos", href: "/app/producao/apontamentos" },
];

export function PcpModuleTabs() {
    return <ModuleTabs items={pcpTabs} />;
}
