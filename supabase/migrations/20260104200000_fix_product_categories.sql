-- Migration: Secure and Multi-tenant Product Categories
-- Description: Adds company_id, fixes unique constraints, and enables RLS.

DO $$
BEGIN

    -- 1. Add company_id if not exists
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'product_categories' AND column_name = 'company_id') THEN
        ALTER TABLE public.product_categories ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
    END IF;

    -- 2. Drop old unique constraint (global)
    -- We try to find the constraint name dynamically or try standard names
    -- Standard naming convention for unique constraint on creation: product_categories_normalized_name_key
    BEGIN
        ALTER TABLE public.product_categories DROP CONSTRAINT IF EXISTS product_categories_normalized_name_key;
    EXCEPTION WHEN OTHERS THEN
        -- Ignore if it doesn't exist or name mismatch (we'll rely on dropping index if constraint was index-backed)
        NULL;
    END;

    -- 3. Drop any index on normalized_name that might be enforcing uniqueness globally
    DROP INDEX IF EXISTS public.product_categories_normalized_name_key;
    DROP INDEX IF EXISTS public.product_categories_normalized_name_company; -- Drop purely to recreate safely

    -- 4. Create new unique composite index (company_id, normalized_name)
    -- This allows "Granola" for Company A and "Granola" for Company B
    CREATE UNIQUE INDEX idx_product_categories_normalized_name_company 
    ON public.product_categories (normalized_name, company_id)
    where company_id is not null; 

    -- Also handle case where company_id might be null (Global categories), 
    -- if we want global "Granola" to be unique among globals.
    CREATE UNIQUE INDEX idx_product_categories_normalized_name_global
    ON public.product_categories (normalized_name)
    WHERE company_id IS NULL;

    -- 5. Enable RLS
    ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;

    -- 6. Clean up old policies to avoid conflicts
    DROP POLICY IF EXISTS "Enable read access for all users" ON public.product_categories;
    DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.product_categories;
    DROP POLICY IF EXISTS "Users can view their company categories" ON public.product_categories;
    DROP POLICY IF EXISTS "Users can manage their company categories" ON public.product_categories;

    -- 7. Create Policies

    -- Read: Visible if company_id matches user's companies OR is NULL (Global)
    CREATE POLICY "Users can view their company categories" 
    ON public.product_categories 
    FOR SELECT 
    USING (
      company_id IS NULL OR 
      public.is_member_of(company_id)
    );

    -- Write: Only if company_id matches user's companies
    CREATE POLICY "Users can manage their company categories" 
    ON public.product_categories 
    FOR ALL 
    USING ( public.is_member_of(company_id) )
    WITH CHECK ( public.is_member_of(company_id) );

END $$;

-- Force schema reload
NOTIFY pgrst, 'reload schema';
