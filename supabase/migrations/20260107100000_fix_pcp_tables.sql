-- Ensure PCP tables exist (Route A fix)
-- Fixing missing tables reported in PROD audit

-- 1. BOM HEADERS
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

-- Indexes for bom_headers
CREATE INDEX IF NOT EXISTS bom_headers_company_idx ON public.bom_headers(company_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS bom_headers_item_idx ON public.bom_headers(item_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS bom_headers_active_idx ON public.bom_headers(company_id, is_active) WHERE deleted_at IS NULL;

-- 2. BOM LINES
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

-- Indexes for bom_lines
CREATE INDEX IF NOT EXISTS bom_lines_bom_idx ON public.bom_lines(bom_id);
CREATE INDEX IF NOT EXISTS bom_lines_component_idx ON public.bom_lines(component_item_id);

-- 3. WORK ORDERS
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

-- Indexes for work_orders
CREATE INDEX IF NOT EXISTS work_orders_company_status_idx ON public.work_orders(company_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS work_orders_item_idx ON public.work_orders(item_id) WHERE deleted_at IS NULL;

-- 4. WORK ORDER CONSUMPTIONS
CREATE TABLE IF NOT EXISTS public.work_order_consumptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    work_order_id UUID NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
    component_item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE RESTRICT,
    qty NUMERIC NOT NULL,
    uom TEXT NOT NULL,
    CHECK (qty > 0)
);

-- Indexes for work_order_consumptions
CREATE INDEX IF NOT EXISTS work_order_consumptions_wo_idx ON public.work_order_consumptions(work_order_id);

-- Enable RLS everywhere
ALTER TABLE public.bom_headers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bom_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_order_consumptions ENABLE ROW LEVEL SECURITY;

-- Grants (if needed, usually handled by roles but explicit grant to authenticated good practice if missing)
GRANT ALL ON public.bom_headers TO authenticated;
GRANT ALL ON public.bom_lines TO authenticated;
GRANT ALL ON public.work_orders TO authenticated;
GRANT ALL ON public.work_order_consumptions TO authenticated;

-- Policies (Simplified basic access for company members)
CREATE POLICY "Enable all for members" ON public.bom_headers FOR ALL USING (public.is_member_of(company_id));
CREATE POLICY "Enable all for members" ON public.bom_lines FOR ALL USING (public.is_member_of(company_id));
CREATE POLICY "Enable all for members" ON public.work_orders FOR ALL USING (public.is_member_of(company_id));
CREATE POLICY "Enable all for members" ON public.work_order_consumptions FOR ALL USING (public.is_member_of(company_id));
