export const INVENTORY_REFERENCE_TYPES = {
  WORK_ORDER: 'work_order',
  PRODUCTION_ENTRY: 'production_entry',
  INVENTORY_COUNT: 'inventory_count',
  DELIVERY_ITEM: 'delivery_item',
} as const

export type InventoryReferenceType =
  (typeof INVENTORY_REFERENCE_TYPES)[keyof typeof INVENTORY_REFERENCE_TYPES]

export const LEGACY_WORK_ORDER_REFERENCE_TYPES = ['WORK_ORDER', 'work_order'] as const

export const INVENTORY_MOVEMENT_TYPES = {
  ENTRY: 'ENTRADA',
  EXIT: 'SAIDA',
  ADJUST: 'AJUSTE',
  PRODUCTION_CONSUMPTION: 'PRODUCTION_CONSUMPTION',
  PRODUCTION_OUTPUT: 'PRODUCTION_OUTPUT',
  PRODUCTION_BYPRODUCT_OUTPUT: 'PRODUCTION_BYPRODUCT_OUTPUT',
} as const

export type InventoryMovementType =
  (typeof INVENTORY_MOVEMENT_TYPES)[keyof typeof INVENTORY_MOVEMENT_TYPES]

export function normalizeReferenceType(value: string | null | undefined): InventoryReferenceType | null {
  if (!value) return null
  const normalized = value.trim().toLowerCase()

  if (normalized === 'work_order') return INVENTORY_REFERENCE_TYPES.WORK_ORDER
  if (normalized === 'production_entry') return INVENTORY_REFERENCE_TYPES.PRODUCTION_ENTRY
  if (normalized === 'inventory_count') return INVENTORY_REFERENCE_TYPES.INVENTORY_COUNT
  if (normalized === 'delivery_item') return INVENTORY_REFERENCE_TYPES.DELIVERY_ITEM

  return null
}

