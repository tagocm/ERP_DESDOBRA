import { InventoryCountDetailClient } from "@/components/inventory/InventoryCountDetailClient";

interface InventoryCountDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function InventoryCountDetailPage({ params }: InventoryCountDetailPageProps) {
  const { id } = await params;
  return <InventoryCountDetailClient inventoryCountId={id} />;
}

