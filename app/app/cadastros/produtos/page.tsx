"use client";

import { ItemsListView } from "@/components/products/ItemsListView";

export default function ItemsPage() {
  return (
    <ItemsListView
      title="Produtos"
      subtitle="Gerencie produtos, materia-primas e insumos"
      showCreateButton
      showActions
      rowHrefBase="/app/cadastros/produtos"
      createHref="/app/cadastros/produtos/novo"
      paginationLabel="produtos"
      enableSuccessToast
    />
  );
}

