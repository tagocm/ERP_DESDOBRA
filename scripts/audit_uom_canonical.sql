-- UOM Canonical Audit
-- Source of truth: uom_id -> uoms.abbrev

-- 1) Items with missing uom_id
SELECT i.id, i.company_id, i.name, i.sku, i.uom
FROM public.items i
WHERE i.deleted_at IS NULL
  AND i.uom_id IS NULL
ORDER BY i.name;

-- 2) Items with legacy text diverging from canonical uom_id
SELECT i.id, i.company_id, i.name, i.sku, i.uom AS legacy_uom, u.abbrev AS canonical_uom
FROM public.items i
JOIN public.uoms u ON u.id = i.uom_id
WHERE i.deleted_at IS NULL
  AND COALESCE(i.uom, '') IS DISTINCT FROM COALESCE(u.abbrev, '')
ORDER BY i.name;

-- 3) Purchase profile divergence
SELECT p.id, p.company_id, p.item_id, p.purchase_uom AS legacy_uom, u.abbrev AS canonical_uom
FROM public.item_purchase_profiles p
JOIN public.uoms u ON u.id = p.purchase_uom_id
WHERE COALESCE(p.purchase_uom, '') IS DISTINCT FROM COALESCE(u.abbrev, '')
ORDER BY p.id;

-- 4) Production profile divergence
SELECT p.id, p.company_id, p.item_id, p.production_uom AS legacy_uom, u.abbrev AS canonical_uom
FROM public.item_production_profiles p
JOIN public.uoms u ON u.id = p.production_uom_id
WHERE COALESCE(p.production_uom, '') IS DISTINCT FROM COALESCE(u.abbrev, '')
ORDER BY p.id;

-- 5) BOM line divergence (component item UOM x bom_lines.uom)
SELECT bl.id, bl.company_id, bl.bom_id, bl.component_item_id, bl.uom AS legacy_uom, u.abbrev AS canonical_uom
FROM public.bom_lines bl
JOIN public.items i ON i.id = bl.component_item_id
JOIN public.uoms u ON u.id = i.uom_id
WHERE COALESCE(bl.uom, '') IS DISTINCT FROM COALESCE(u.abbrev, '')
ORDER BY bl.id;

-- 6) BOM header divergence (header item UOM x yield_uom)
SELECT bh.id, bh.company_id, bh.item_id, bh.yield_uom AS legacy_uom, u.abbrev AS canonical_uom
FROM public.bom_headers bh
JOIN public.items i ON i.id = bh.item_id
JOIN public.uoms u ON u.id = i.uom_id
WHERE bh.deleted_at IS NULL
  AND COALESCE(bh.yield_uom, '') IS DISTINCT FROM COALESCE(u.abbrev, '')
ORDER BY bh.id;
