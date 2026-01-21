-- Migration: Create Packaging Types Management
-- Description: Creates a table for managing packaging types and removes the hardcoded check constraint on item_packaging.

-- 1. Create packaging_types table
CREATE TABLE IF NOT EXISTS public.packaging_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Ensure unique name/code per company (treating NULL as a value needs partial index or just logic)
    -- We'll rely on partial indexes for uniqueness
    CONSTRAINT valid_code CHECK (char_length(code) >= 2)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_packaging_types_company ON public.packaging_types(company_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_packaging_types_code_company ON public.packaging_types(company_id, code) WHERE company_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_packaging_types_code_global ON public.packaging_types(code) WHERE company_id IS NULL;

-- 2. Seed Default Types (matching existing hardcoded values)
-- PACKAGING_TYPES = [
--     { value: 'BOX', label: 'Caixa' },
--     { value: 'PACK', label: 'Pacote' },
--     { value: 'BALE', label: 'Fardo' },
--     { value: 'PALLET', label: 'Pallet' },
--     { value: 'OTHER', label: 'Outro' }
-- ];

INSERT INTO public.packaging_types (company_id, code, name, sort_order) VALUES
    (NULL, 'BOX', 'Caixa', 10),
    (NULL, 'PACK', 'Pacote', 20),
    (NULL, 'BALE', 'Fardo', 30),
    (NULL, 'PALLET', 'Pallet', 40),
    (NULL, 'OTHER', 'Outro', 99)
ON CONFLICT (code) WHERE company_id IS NULL DO NOTHING;


-- 3. Modify item_packaging table
-- Remove the hardcoded check constraint
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.check_constraints 
        WHERE constraint_name = 'item_packaging_type_check' 
    ) THEN
        ALTER TABLE public.item_packaging DROP CONSTRAINT item_packaging_type_check;
    END IF;
    
    -- Also checking for auto-generated name if the above manual name wasn't used
    -- Usually postgres names it "item_packaging_type_check" if defined inline, or we check by definition.
    -- However, the previous migration defined it inline: CHECK (type IN (...))
    -- So we just try to drop the constraint on the column.
    
    -- We can't easily guess the name if it wasn't named explicitly. 
    -- But in the previous migration viewed:
    -- type TEXT NOT NULL CHECK (type IN ('BOX', 'PACK', 'BALE', 'PALLET', 'OTHER'))
    
    -- If it was unnamed, we need to find it.
    -- Dynamic drop:
    DECLARE r record;
    BEGIN
        FOR r IN 
            SELECT con.constraint_name
            FROM information_schema.constraint_column_usage ccu
            JOIN information_schema.check_constraints con ON ccu.constraint_name = con.constraint_name
            WHERE ccu.table_name = 'item_packaging' AND ccu.column_name = 'type'
        LOOP
            EXECUTE 'ALTER TABLE public.item_packaging DROP CONSTRAINT ' || quote_ident(r.constraint_name);
        END LOOP;
    END;
END $$;


-- 4. RLS Policies for packaging_types
ALTER TABLE public.packaging_types ENABLE ROW LEVEL SECURITY;

-- Allow reading all relevant types (Global + Company)
CREATE POLICY packaging_types_select ON public.packaging_types FOR SELECT
    USING (
        company_id IS NULL 
        OR 
        public.is_member_of(company_id)
    );

-- Allow modifying only company types
CREATE POLICY packaging_types_insert ON public.packaging_types FOR INSERT
    WITH CHECK (public.is_member_of(company_id));

CREATE POLICY packaging_types_update ON public.packaging_types FOR UPDATE
    USING (public.is_member_of(company_id));

CREATE POLICY packaging_types_delete ON public.packaging_types FOR DELETE
    USING (public.is_member_of(company_id));


-- 5. Trigger for updated_at
CREATE TRIGGER update_packaging_types_updated_at
    BEFORE UPDATE ON public.packaging_types
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

-- Refresh Schema
NOTIFY pgrst, 'reload schema';
