"use client";

import { ModuleTabs } from "@/components/app/ModuleTabs";

const inventoryTabs = [
  { name: "Movimentações", href: "/app/estoque/movimentacoes" },
  { name: "Inventários", href: "/app/estoque/inventarios" },
  { name: "Saldos", href: "/app/estoque/saldos" },
];

export function InventoryModuleTabs() {
  return <ModuleTabs items={inventoryTabs} />;
}
