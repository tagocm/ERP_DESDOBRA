-- Financial Categories <-> Chart of Accounts linkage (Operational Expenses / Item 4)
--
-- Goal:
-- - financial_categories must be linked 1:1 with a final (ANALITICA) gl_accounts row
-- - The linked accounts live under the "4.* DESPESAS OPERACIONAIS" subtree
-- - New categories are created atomically via RPC (see later migration)

-- 1) Expand gl_accounts.origin CHECK to include FINANCIAL_CATEGORY
DO $$
DECLARE
  v_constraint text;
BEGIN
  -- Drop the existing origin check constraint (name may vary across environments).
  SELECT c.conname
    INTO v_constraint
  FROM pg_constraint c
  WHERE c.conrelid = 'public.gl_accounts'::regclass
    AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) ILIKE '%origin%'
    AND pg_get_constraintdef(c.oid) ILIKE '%SYSTEM%'
    AND pg_get_constraintdef(c.oid) ILIKE '%PRODUCT_CATEGORY%'
    AND pg_get_constraintdef(c.oid) ILIKE '%MANUAL%';

  IF v_constraint IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.gl_accounts DROP CONSTRAINT %I', v_constraint);
  END IF;
END $$;

DO $$
BEGIN
  ALTER TABLE public.gl_accounts
    ADD CONSTRAINT gl_accounts_origin_check
    CHECK (origin IN ('SYSTEM', 'PRODUCT_CATEGORY', 'FINANCIAL_CATEGORY', 'MANUAL'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2) Per-company + per-parent monotonic sequence state for 4.x.xx children
CREATE TABLE IF NOT EXISTS public.financial_category_sequences (
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  parent_account_id uuid NOT NULL REFERENCES public.gl_accounts(id) ON DELETE CASCADE,
  last_suffix integer NOT NULL DEFAULT 0 CHECK (last_suffix >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, parent_account_id)
);

DROP TRIGGER IF EXISTS trg_financial_category_sequences_updated_at ON public.financial_category_sequences;
CREATE TRIGGER trg_financial_category_sequences_updated_at
BEFORE UPDATE ON public.financial_category_sequences
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Link financial_categories to an expense account
ALTER TABLE public.financial_categories
  ADD COLUMN IF NOT EXISTS expense_account_id uuid REFERENCES public.gl_accounts(id);

-- 4) One category maps to exactly one account in the same tenant context
CREATE UNIQUE INDEX IF NOT EXISTS idx_financial_categories_company_expense_account_unique
ON public.financial_categories (company_id, expense_account_id)
WHERE expense_account_id IS NOT NULL;

-- 5) One FINANCIAL_CATEGORY account maps back to exactly one category
CREATE UNIQUE INDEX IF NOT EXISTS idx_gl_accounts_company_origin_id_financial_category_unique
ON public.gl_accounts (company_id, origin_id)
WHERE origin = 'FINANCIAL_CATEGORY' AND origin_id IS NOT NULL;

-- 6) Active categories must have a linked expense account (validated after backfill)
ALTER TABLE public.financial_categories
  DROP CONSTRAINT IF EXISTS financial_categories_active_requires_expense_account;

ALTER TABLE public.financial_categories
  ADD CONSTRAINT financial_categories_active_requires_expense_account
  CHECK (deleted_at IS NOT NULL OR expense_account_id IS NOT NULL)
  NOT VALID;

