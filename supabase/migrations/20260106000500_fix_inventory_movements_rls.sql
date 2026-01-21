-- Fix Inventory Movements: Create Table if missing, Fix RLS, Disable Legacy Trigger

-- 0. Ensure Table Exists (Previous migration might have failed or been skipped)
CREATE TABLE IF NOT EXISTS public.inventory_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE RESTRICT,
    movement_type TEXT CHECK (movement_type IN ('ENTRADA', 'SAIDA', 'AJUSTE')),
    qty_base NUMERIC(15, 4) NOT NULL DEFAULT 0,
    reference_type TEXT,
    reference_id UUID,
    qty_display NUMERIC(15, 4),
    uom_label TEXT,
    conversion_factor NUMERIC(15, 4),
    notes TEXT,
    source_ref TEXT,
    reason TEXT,
    qty_in NUMERIC(15, 4) DEFAULT 0,
    qty_out NUMERIC(15, 4) DEFAULT 0,

    -- Fix: Reference user_profiles explicitly for PostgREST embedding
    created_by UUID REFERENCES public.user_profiles(auth_user_id),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- If table already existed with wrong FK, we might need to alter it.
-- But since user likely failed to create it (or it's empty/broken), let's ensure the FK constraint is correct.
DO $$
BEGIN
    -- Check if FK exists and points to auth.users. If so, drop and recreate pointing to user_profiles.
    -- Finding the constraint name is hard dynamically without knowing it.
    -- But we can try to add the correct one if it doesn't exist.
    -- Or we can assume 'inventory_movements_created_by_fkey'.

    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'inventory_movements_created_by_fkey') THEN
       -- Check filtering. For now, let's just DROP and ADD to be safe/sure.
       ALTER TABLE public.inventory_movements DROP CONSTRAINT inventory_movements_created_by_fkey;
    END IF;

    ALTER TABLE public.inventory_movements
    ADD CONSTRAINT inventory_movements_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES public.user_profiles(auth_user_id);

END $$;


-- 1. Enable RLS
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies to start fresh
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.inventory_movements;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.inventory_movements;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.inventory_movements;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON public.inventory_movements;

-- 3. Create permissive policies for authenticated users
CREATE POLICY "Enable read access for authenticated users"
  ON public.inventory_movements FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Enable insert for authenticated users"
  ON public.inventory_movements FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users"
  ON public.inventory_movements FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 4. Disable the legacy trigger that deducts full order quantity
DROP TRIGGER IF EXISTS trg_sales_order_logistic_change_stock ON public.sales_documents;

-- 5. Helper Function to deduct stock based on DELIVERIES (Effective Delivery)
CREATE OR REPLACE FUNCTION public.deduct_stock_from_route(p_route_id UUID)
RETURNS VOID AS $$
DECLARE
    r_delivery RECORD;
    r_item RECORD;
    v_source_ref TEXT;
BEGIN
    FOR r_delivery IN
        SELECT * FROM public.deliveries WHERE route_id = p_route_id
    LOOP
        v_source_ref := concat('Entrega #', r_delivery.number);

        FOR r_item IN
            SELECT * FROM public.delivery_items WHERE delivery_id = r_delivery.id
        LOOP
            IF NOT EXISTS (
                SELECT 1 FROM public.inventory_movements
                WHERE reference_type = 'delivery_item'
                AND reference_id = r_item.id
                AND movement_type = 'SAIDA'
            ) THEN
                INSERT INTO public.inventory_movements (
                    company_id,
                    item_id,
                    movement_type,
                    qty_base,
                    reference_type,
                    reference_id,
                    source_ref,
                    notes,
                    created_by,
                    created_at,
                    updated_at,
                    reason,
                    qty_in,
                    qty_out
                ) 
                SELECT
                    d.company_id,
                    r_item.item_id,
                    'SAIDA',
                    r_item.qty_loaded, 
                    'delivery_item',
                    r_item.id,
                    v_source_ref,
                    'Baixa por entrega em rota',
                    d.created_by, -- Assuming d.created_by also matches user_profiles(auth_user_id) or is auth.uid
                    NOW(),
                    NOW(),
                    'sale_out',
                    0,
                    r_item.qty_loaded
                FROM public.deliveries d
                WHERE d.id = r_delivery.id;
            END IF;
        END LOOP;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
