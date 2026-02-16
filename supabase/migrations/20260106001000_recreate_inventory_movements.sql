-- FORCE RECREATE Inventory Movements to fix FK and Cache Issues

-- 1. Drop old table and dependents
DROP TABLE IF EXISTS public.inventory_movements CASCADE;

-- 2. Recreate Table with Correct FK
CREATE TABLE IF NOT EXISTS public.inventory_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE RESTRICT,
    movement_type TEXT CHECK (movement_type IN ('ENTRADA', 'SAIDA', 'AJUSTE')),
    qty_base NUMERIC(15, 4) NOT NULL DEFAULT 0,
    reference_type TEXT, -- 'delivery_item', 'pedido', 'AJUSTE_MANUAL'
    reference_id UUID,
    qty_display NUMERIC(15, 4),
    uom_label TEXT,
    conversion_factor NUMERIC(15, 4),
    notes TEXT,
    source_ref TEXT,
    reason TEXT,
    qty_in NUMERIC(15, 4) DEFAULT 0,
    qty_out NUMERIC(15, 4) DEFAULT 0,

    -- Correct FK for PostgREST embedding:
    created_by UUID REFERENCES public.user_profiles(auth_user_id),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Indexes
CREATE INDEX idx_inventory_movements_company_date ON public.inventory_movements(company_id, occurred_at DESC);
CREATE INDEX idx_inventory_movements_item ON public.inventory_movements(item_id);
CREATE INDEX idx_inventory_movements_ref ON public.inventory_movements(reference_type, reference_id);

-- 4. RLS
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;

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

-- 5. Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_inventory_movements_updated_at
    BEFORE UPDATE ON public.inventory_movements
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

-- 6. Disable the legacy trigger (Safe to run again)
DROP TRIGGER IF EXISTS trg_sales_order_logistic_change_stock ON public.sales_documents;

-- 7. Helper Function (Safe replace)
DROP FUNCTION IF EXISTS public.deduct_stock_from_route(UUID);

CREATE OR REPLACE FUNCTION public.deduct_stock_from_route(p_route_id UUID, p_user_id UUID)
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
            SELECT di.*, sdi.item_id 
            FROM public.delivery_items di
            JOIN public.sales_document_items sdi ON sdi.id = di.sales_document_item_id
            WHERE di.delivery_id = r_delivery.id
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
                    occurred_at,
                    reason,
                    qty_in,
                    qty_out
                ) 
                SELECT
                    d.company_id,
                    r_item.item_id,
                    'SAIDA',
                    -1 * r_item.qty_loaded, 
                    'delivery_item',
                    r_item.id,
                    v_source_ref,
                    'Baixa por entrega em rota',
                    p_user_id,
                    NOW(),
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


-- 8. Force Schema Reload
NOTIFY pgrst, 'reload';
