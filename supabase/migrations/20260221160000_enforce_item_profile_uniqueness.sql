-- Ensure one profile row per tenant/item for each item profile table.
-- This prevents >1 row scenarios that can break maybeSingle/single semantics.

-- 1) Cleanup duplicates (keep the most recently updated row).
WITH ranked AS (
    SELECT id,
           ROW_NUMBER() OVER (
               PARTITION BY company_id, item_id
               ORDER BY updated_at DESC, created_at DESC, id DESC
           ) AS rn
    FROM public.item_inventory_profiles
)
DELETE FROM public.item_inventory_profiles p
USING ranked r
WHERE p.id = r.id
  AND r.rn > 1;

WITH ranked AS (
    SELECT id,
           ROW_NUMBER() OVER (
               PARTITION BY company_id, item_id
               ORDER BY updated_at DESC, created_at DESC, id DESC
           ) AS rn
    FROM public.item_purchase_profiles
)
DELETE FROM public.item_purchase_profiles p
USING ranked r
WHERE p.id = r.id
  AND r.rn > 1;

WITH ranked AS (
    SELECT id,
           ROW_NUMBER() OVER (
               PARTITION BY company_id, item_id
               ORDER BY updated_at DESC, created_at DESC, id DESC
           ) AS rn
    FROM public.item_sales_profiles
)
DELETE FROM public.item_sales_profiles p
USING ranked r
WHERE p.id = r.id
  AND r.rn > 1;

WITH ranked AS (
    SELECT id,
           ROW_NUMBER() OVER (
               PARTITION BY company_id, item_id
               ORDER BY updated_at DESC, created_at DESC, id DESC
           ) AS rn
    FROM public.item_fiscal_profiles
)
DELETE FROM public.item_fiscal_profiles p
USING ranked r
WHERE p.id = r.id
  AND r.rn > 1;

WITH ranked AS (
    SELECT id,
           ROW_NUMBER() OVER (
               PARTITION BY company_id, item_id
               ORDER BY updated_at DESC, created_at DESC, id DESC
           ) AS rn
    FROM public.item_production_profiles
)
DELETE FROM public.item_production_profiles p
USING ranked r
WHERE p.id = r.id
  AND r.rn > 1;

-- 2) Enforce uniqueness by tenant/item.
CREATE UNIQUE INDEX IF NOT EXISTS uq_item_inventory_profiles_company_item
    ON public.item_inventory_profiles (company_id, item_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_item_purchase_profiles_company_item
    ON public.item_purchase_profiles (company_id, item_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_item_sales_profiles_company_item
    ON public.item_sales_profiles (company_id, item_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_item_fiscal_profiles_company_item
    ON public.item_fiscal_profiles (company_id, item_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_item_production_profiles_company_item
    ON public.item_production_profiles (company_id, item_id);

