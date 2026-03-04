"use client";

import { InventoryModuleTabs } from "@/components/inventory/InventoryModuleTabs";
import { ItemsListView } from "@/components/products/ItemsListView";

export default function StockBalancesPage() {
  return (
    <ItemsListView
      title="Saldos"
      subtitle="Consulte saldos de produtos, materia-primas e insumos"
      showCreateButton={false}
      showActions={false}
      paginationLabel="itens"
      headerContent={<InventoryModuleTabs />}
      showBalanceDateFilter
    />
  );
}
