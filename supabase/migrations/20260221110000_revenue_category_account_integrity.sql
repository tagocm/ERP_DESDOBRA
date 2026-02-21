-- Revenue Category <-> Chart of Accounts integrity baseline

-- 1) Remove duplicated unique left from legacy migrations (keep one canonical unique)
ALTER TABLE public.gl_accounts
  DROP CONSTRAINT IF EXISTS gl_accounts_company_id_code_key;

-- 2) Per-company monotonic sequence state for 1.1.xx revenue children
CREATE TABLE IF NOT EXISTS public.revenue_category_sequences (
  company_id uuid PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  last_suffix integer NOT NULL DEFAULT 0 CHECK (last_suffix >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_revenue_category_sequences_updated_at ON public.revenue_category_sequences;
CREATE TRIGGER trg_revenue_category_sequences_updated_at
BEFORE UPDATE ON public.revenue_category_sequences
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 3) One category must map to exactly one account in same company context
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_categories_company_revenue_account_unique
ON public.product_categories (company_id, revenue_account_id)
WHERE company_id IS NOT NULL AND revenue_account_id IS NOT NULL;

-- 4) One PRODUCT_CATEGORY account must map back to exactly one category
CREATE UNIQUE INDEX IF NOT EXISTS idx_gl_accounts_company_origin_id_product_category_unique
ON public.gl_accounts (company_id, origin_id)
WHERE origin = 'PRODUCT_CATEGORY' AND origin_id IS NOT NULL;

-- 5) Tenant categories must always have a linked revenue account
ALTER TABLE public.product_categories
  DROP CONSTRAINT IF EXISTS product_categories_tenant_requires_revenue_account;

ALTER TABLE public.product_categories
  ADD CONSTRAINT product_categories_tenant_requires_revenue_account
  CHECK (company_id IS NULL OR revenue_account_id IS NOT NULL)
  NOT VALID;

ALTER TABLE public.product_categories
  VALIDATE CONSTRAINT product_categories_tenant_requires_revenue_account;
