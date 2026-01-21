-- Migration: Inventory Ledger
-- Description: Creates the single source of truth for stock movements.

-- 1. Create inventory_movements table (Safe check)
CREATE TABLE IF NOT EXISTS public.inventory_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Ensure columns exist (Idempotent updates)
DO $$
BEGIN
    -- movement_type
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory_movements' AND column_name = 'movement_type') THEN
        ALTER TABLE public.inventory_movements ADD COLUMN movement_type TEXT CHECK (movement_type IN ('ENTRADA', 'SAIDA', 'AJUSTE'));
    END IF;

    -- qty_base
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory_movements' AND column_name = 'qty_base') THEN
        ALTER TABLE public.inventory_movements ADD COLUMN qty_base NUMERIC(15, 4) NOT NULL DEFAULT 0;
    END IF;

    -- reference_type
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory_movements' AND column_name = 'reference_type') THEN
        ALTER TABLE public.inventory_movements ADD COLUMN reference_type TEXT;
    END IF;

    -- reference_id
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory_movements' AND column_name = 'reference_id') THEN
        ALTER TABLE public.inventory_movements ADD COLUMN reference_id UUID;
    END IF;

    -- qty_display
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory_movements' AND column_name = 'qty_display') THEN
        ALTER TABLE public.inventory_movements ADD COLUMN qty_display NUMERIC(15, 4);
    END IF;

    -- uom_label
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory_movements' AND column_name = 'uom_label') THEN
        ALTER TABLE public.inventory_movements ADD COLUMN uom_label TEXT;
    END IF;

    -- conversion_factor
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory_movements' AND column_name = 'conversion_factor') THEN
        ALTER TABLE public.inventory_movements ADD COLUMN conversion_factor NUMERIC(15, 4);
    END IF;

    -- notes
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory_movements' AND column_name = 'notes') THEN
        ALTER TABLE public.inventory_movements ADD COLUMN notes TEXT;
    END IF;

    -- occurred_at
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory_movements' AND column_name = 'occurred_at') THEN
        ALTER TABLE public.inventory_movements ADD COLUMN occurred_at TIMESTAMPTZ NOT NULL DEFAULT now();
    END IF;

    -- created_by
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory_movements' AND column_name = 'created_by') THEN
        ALTER TABLE public.inventory_movements ADD COLUMN created_by UUID REFERENCES auth.users(id);
    END IF;

    -- created_at (Ensure exists if table was extremely old and basic)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory_movements' AND column_name = 'created_at') THEN
        ALTER TABLE public.inventory_movements ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT now();
    END IF;

     -- updated_at
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory_movements' AND column_name = 'updated_at') THEN
        ALTER TABLE public.inventory_movements ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
    END IF;
END $$;

-- 3. Indexes (Safe)
CREATE INDEX IF NOT EXISTS idx_inventory_movements_company_date ON public.inventory_movements(company_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_item ON public.inventory_movements(item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_ref ON public.inventory_movements(reference_type, reference_id);

-- 4. RLS (Safe)
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'inventory_movements' AND policyname = 'Users can view inventory movements of their company') THEN
        CREATE POLICY "Users can view inventory movements of their company" ON public.inventory_movements
            FOR SELECT USING (public.is_member_of(company_id));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'inventory_movements' AND policyname = 'Users can insert inventory movements for their company') THEN
        CREATE POLICY "Users can insert inventory movements for their company" ON public.inventory_movements
            FOR INSERT WITH CHECK (public.is_member_of(company_id));
    END IF;
END $$;

-- 5. View for Balances (Helper)
CREATE OR REPLACE VIEW public.inventory_balances AS
SELECT 
    company_id,
    item_id,
    SUM(qty_base) as balance
FROM 
    public.inventory_movements
GROUP BY 
    company_id, 
    item_id;

-- 6. Trigger for updated_at (Safe drop/create)
DROP TRIGGER IF EXISTS update_inventory_movements_updated_at ON public.inventory_movements;
CREATE TRIGGER update_inventory_movements_updated_at
    BEFORE UPDATE ON public.inventory_movements
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();
