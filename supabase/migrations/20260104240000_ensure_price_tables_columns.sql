-- Migration: Ensure All Price Table Columns
-- Description: Adds any missing columns to price_tables to fix schema cache/missing column errors.

DO $$
BEGIN
    -- 1. name
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'price_tables' AND column_name = 'name') THEN
        ALTER TABLE public.price_tables ADD COLUMN name TEXT NOT NULL DEFAULT 'Nova Tabela';
    END IF;

    -- 2. effective_date
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'price_tables' AND column_name = 'effective_date') THEN
        ALTER TABLE public.price_tables ADD COLUMN effective_date DATE NOT NULL DEFAULT current_date;
    END IF;

    -- 3. is_active
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'price_tables' AND column_name = 'is_active') THEN
        ALTER TABLE public.price_tables ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;
        CREATE INDEX IF NOT EXISTS idx_price_tables_active_fix ON public.price_tables(is_active);
    END IF;

    -- 4. valid_from
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'price_tables' AND column_name = 'valid_from') THEN
        ALTER TABLE public.price_tables ADD COLUMN valid_from DATE;
    END IF;

    -- 5. valid_to
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'price_tables' AND column_name = 'valid_to') THEN
        ALTER TABLE public.price_tables ADD COLUMN valid_to DATE;
    END IF;

    -- 6. commission_pct
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'price_tables' AND column_name = 'commission_pct') THEN
        ALTER TABLE public.price_tables ADD COLUMN commission_pct NUMERIC(5,2);
    END IF;

    -- 7. freight_included
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'price_tables' AND column_name = 'freight_included') THEN
        ALTER TABLE public.price_tables ADD COLUMN freight_included BOOLEAN NOT NULL DEFAULT false;
    END IF;

    -- 8. min_order_value
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'price_tables' AND column_name = 'min_order_value') THEN
        ALTER TABLE public.price_tables ADD COLUMN min_order_value NUMERIC(12,2) DEFAULT 0;
    END IF;

    -- 9. states
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'price_tables' AND column_name = 'states') THEN
        ALTER TABLE public.price_tables ADD COLUMN states TEXT[];
    END IF;

    -- 10. customer_profiles
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'price_tables' AND column_name = 'customer_profiles') THEN
        ALTER TABLE public.price_tables ADD COLUMN customer_profiles TEXT[];
    END IF;

    -- 11. internal_notes
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'price_tables' AND column_name = 'internal_notes') THEN
        ALTER TABLE public.price_tables ADD COLUMN internal_notes TEXT;
    END IF;

END $$;

-- Refresh Schema
NOTIFY pgrst, 'reload schema';
