-- PCP (Production Planning and Control) Module
-- Tables: items, bom_headers, bom_lines, work_orders, work_order_consumptions, inventory_movements
-- Author: Agente 3
-- Date: 2025-12-21

-- =====================================================
-- 1. ITEMS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    sku TEXT,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('raw_material', 'packaging', 'wip', 'finished_good', 'service')),
    uom TEXT NOT NULL, -- KG, G, UN, L, ML, etc
    is_active BOOLEAN NOT NULL DEFAULT true,
    avg_cost NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
    
    -- Constraints handled by unique indexes

);

-- Indexes
CREATE INDEX IF NOT EXISTS items_company_name_idx ON public.items(company_id, name) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS items_company_type_idx ON public.items(company_id, type) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS items_company_active_idx ON public.items(company_id, is_active) WHERE deleted_at IS NULL;
-- Unique SKU index
CREATE UNIQUE INDEX IF NOT EXISTS items_company_sku_unique ON public.items(company_id, sku) 
    WHERE sku IS NOT NULL AND deleted_at IS NULL;

-- Comments
COMMENT ON TABLE public.items IS 'Inventory items: raw materials, packaging, WIP, finished goods, services';
COMMENT ON COLUMN public.items.type IS 'Item type: raw_material, packaging, wip, finished_good, service';
COMMENT ON COLUMN public.items.uom IS 'Unit of measure: KG, G, UN, L, ML, etc';
COMMENT ON COLUMN public.items.avg_cost IS 'Current average cost per unit';

-- =====================================================
-- 2. BOM HEADERS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.bom_headers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
    version INT NOT NULL DEFAULT 1,
    yield_qty NUMERIC NOT NULL DEFAULT 1,
    yield_uom TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS bom_headers_company_idx ON public.bom_headers(company_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS bom_headers_item_idx ON public.bom_headers(item_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS bom_headers_active_idx ON public.bom_headers(company_id, is_active) WHERE deleted_at IS NULL;
-- Unique BOM version index
CREATE UNIQUE INDEX IF NOT EXISTS bom_headers_company_item_version_unique ON public.bom_headers(company_id, item_id, version)
    WHERE deleted_at IS NULL;

-- Comments
COMMENT ON TABLE public.bom_headers IS 'Bill of Materials headers for finished goods';
COMMENT ON COLUMN public.bom_headers.item_id IS 'The finished product this BOM produces';
COMMENT ON COLUMN public.bom_headers.version IS 'BOM version number';
COMMENT ON COLUMN public.bom_headers.yield_qty IS 'Quantity produced by this BOM';

-- =====================================================
-- 3. BOM LINES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.bom_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    bom_id UUID NOT NULL REFERENCES public.bom_headers(id) ON DELETE CASCADE,
    component_item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE RESTRICT,
    qty NUMERIC NOT NULL,
    uom TEXT NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    
    CHECK (qty > 0)
);

-- Indexes
CREATE INDEX bom_lines_bom_idx ON public.bom_lines(bom_id);
CREATE INDEX bom_lines_component_idx ON public.bom_lines(component_item_id);
CREATE INDEX bom_lines_company_idx ON public.bom_lines(company_id);

-- Comments
COMMENT ON TABLE public.bom_lines IS 'Components/ingredients for each BOM';
COMMENT ON COLUMN public.bom_lines.component_item_id IS 'The component/ingredient item';
COMMENT ON COLUMN public.bom_lines.qty IS 'Quantity of component needed';
COMMENT ON COLUMN public.bom_lines.sort_order IS 'Display order in BOM';

-- =====================================================
-- 4. WORK ORDERS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.work_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE RESTRICT,
    bom_id UUID REFERENCES public.bom_headers(id) ON DELETE SET NULL,
    planned_qty NUMERIC NOT NULL,
    produced_qty NUMERIC NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'done', 'cancelled')),
    notes TEXT,
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    
    CHECK (planned_qty > 0),
    CHECK (produced_qty >= 0)
);

-- Indexes
CREATE INDEX work_orders_company_status_idx ON public.work_orders(company_id, status) WHERE deleted_at IS NULL;
CREATE INDEX work_orders_item_idx ON public.work_orders(item_id) WHERE deleted_at IS NULL;
CREATE INDEX work_orders_bom_idx ON public.work_orders(bom_id) WHERE deleted_at IS NULL;
CREATE INDEX work_orders_created_idx ON public.work_orders(company_id, created_at DESC) WHERE deleted_at IS NULL;

-- Comments
COMMENT ON TABLE public.work_orders IS 'Production orders';
COMMENT ON COLUMN public.work_orders.item_id IS 'Product to be produced';
COMMENT ON COLUMN public.work_orders.bom_id IS 'BOM used for this production';
COMMENT ON COLUMN public.work_orders.status IS 'planned, in_progress, done, cancelled';

-- =====================================================
-- 5. WORK ORDER CONSUMPTIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.work_order_consumptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    work_order_id UUID NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
    component_item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE RESTRICT,
    qty NUMERIC NOT NULL,
    uom TEXT NOT NULL,
    
    CHECK (qty > 0)
);

-- Indexes
CREATE INDEX work_order_consumptions_wo_idx ON public.work_order_consumptions(work_order_id);
CREATE INDEX work_order_consumptions_item_idx ON public.work_order_consumptions(component_item_id);
CREATE INDEX work_order_consumptions_company_idx ON public.work_order_consumptions(company_id);

-- Comments
COMMENT ON TABLE public.work_order_consumptions IS 'Actual consumption per work order (optional, overrides BOM)';

-- =====================================================
-- 6. INVENTORY MOVEMENTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.inventory_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE RESTRICT,
    qty_in NUMERIC NOT NULL DEFAULT 0,
    qty_out NUMERIC NOT NULL DEFAULT 0,
    unit_cost NUMERIC NOT NULL DEFAULT 0,
    total_cost NUMERIC NOT NULL DEFAULT 0,
    reason TEXT NOT NULL CHECK (reason IN ('purchase_in', 'adjustment_in', 'adjustment_out', 'production_in', 'production_out', 'sale_out', 'return_in')),
    ref_type TEXT,
    ref_id UUID,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    CHECK (
        (qty_in > 0 AND qty_out = 0) OR (qty_out > 0 AND qty_in = 0)
    )
);

-- Indexes
CREATE INDEX inventory_movements_company_item_idx ON public.inventory_movements(company_id, item_id, created_at DESC);
CREATE INDEX inventory_movements_company_reason_idx ON public.inventory_movements(company_id, reason);
CREATE INDEX inventory_movements_ref_idx ON public.inventory_movements(ref_type, ref_id) WHERE ref_type IS NOT NULL;

-- Comments
COMMENT ON TABLE public.inventory_movements IS 'All inventory movements for tracking and costing';
COMMENT ON COLUMN public.inventory_movements.reason IS 'purchase_in, adjustment_in, adjustment_out, production_in, production_out, sale_out, return_in';
COMMENT ON COLUMN public.inventory_movements.unit_cost IS 'Cost per unit (used for entries)';
COMMENT ON COLUMN public.inventory_movements.total_cost IS 'Total cost of movement';
COMMENT ON COLUMN public.inventory_movements.ref_type IS 'Reference type (e.g., work_order, purchase_order)';
COMMENT ON COLUMN public.inventory_movements.ref_id IS 'Reference ID';

-- =====================================================
-- TRIGGERS FOR UPDATED_AT
-- =====================================================
CREATE TRIGGER items_updated_at BEFORE UPDATE ON public.items
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER bom_headers_updated_at BEFORE UPDATE ON public.bom_headers
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER work_orders_updated_at BEFORE UPDATE ON public.work_orders
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- RLS POLICIES
-- =====================================================

-- Enable RLS
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bom_headers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bom_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_order_consumptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;

-- Items policies
CREATE POLICY items_select ON public.items FOR SELECT
    USING (public.is_member_of(company_id));

CREATE POLICY items_insert ON public.items FOR INSERT
    WITH CHECK (public.is_member_of(company_id));

CREATE POLICY items_update ON public.items FOR UPDATE
    USING (public.is_member_of(company_id));

CREATE POLICY items_delete ON public.items FOR DELETE
    USING (public.is_member_of(company_id));

-- BOM Headers policies
CREATE POLICY bom_headers_select ON public.bom_headers FOR SELECT
    USING (public.is_member_of(company_id));

CREATE POLICY bom_headers_insert ON public.bom_headers FOR INSERT
    WITH CHECK (public.is_member_of(company_id));

CREATE POLICY bom_headers_update ON public.bom_headers FOR UPDATE
    USING (public.is_member_of(company_id));

CREATE POLICY bom_headers_delete ON public.bom_headers FOR DELETE
    USING (public.is_member_of(company_id));

-- BOM Lines policies
CREATE POLICY bom_lines_select ON public.bom_lines FOR SELECT
    USING (public.is_member_of(company_id));

CREATE POLICY bom_lines_insert ON public.bom_lines FOR INSERT
    WITH CHECK (public.is_member_of(company_id));

CREATE POLICY bom_lines_update ON public.bom_lines FOR UPDATE
    USING (public.is_member_of(company_id));

CREATE POLICY bom_lines_delete ON public.bom_lines FOR DELETE
    USING (public.is_member_of(company_id));

-- Work Orders policies
CREATE POLICY work_orders_select ON public.work_orders FOR SELECT
    USING (public.is_member_of(company_id));

CREATE POLICY work_orders_insert ON public.work_orders FOR INSERT
    WITH CHECK (public.is_member_of(company_id));

CREATE POLICY work_orders_update ON public.work_orders FOR UPDATE
    USING (public.is_member_of(company_id));

CREATE POLICY work_orders_delete ON public.work_orders FOR DELETE
    USING (public.is_member_of(company_id));

-- Work Order Consumptions policies
CREATE POLICY work_order_consumptions_select ON public.work_order_consumptions FOR SELECT
    USING (public.is_member_of(company_id));

CREATE POLICY work_order_consumptions_insert ON public.work_order_consumptions FOR INSERT
    WITH CHECK (public.is_member_of(company_id));

CREATE POLICY work_order_consumptions_update ON public.work_order_consumptions FOR UPDATE
    USING (public.is_member_of(company_id));

CREATE POLICY work_order_consumptions_delete ON public.work_order_consumptions FOR DELETE
    USING (public.is_member_of(company_id));

-- Inventory Movements policies
CREATE POLICY inventory_movements_select ON public.inventory_movements FOR SELECT
    USING (public.is_member_of(company_id));

CREATE POLICY inventory_movements_insert ON public.inventory_movements FOR INSERT
    WITH CHECK (public.is_member_of(company_id));

CREATE POLICY inventory_movements_update ON public.inventory_movements FOR UPDATE
    USING (public.is_member_of(company_id));

CREATE POLICY inventory_movements_delete ON public.inventory_movements FOR DELETE
    USING (public.is_member_of(company_id));
