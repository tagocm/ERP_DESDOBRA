-- Enable uuid-ossp extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create purchase_orders table
CREATE TABLE IF NOT EXISTS public.purchase_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    supplier_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'received', 'cancelled')),
    ordered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expected_at DATE,
    notes TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Create purchase_order_items table
CREATE TABLE IF NOT EXISTS public.purchase_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    purchase_order_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE RESTRICT,
    qty_display NUMERIC NOT NULL CHECK (qty_display > 0),
    uom_label TEXT NOT NULL,
    conversion_factor NUMERIC NOT NULL DEFAULT 1 CHECK (conversion_factor > 0),
    qty_base NUMERIC NOT NULL CHECK (qty_base > 0),
    unit_cost NUMERIC CHECK (unit_cost >= 0),
    total_cost NUMERIC CHECK (total_cost >= 0),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_purchase_orders_company_id ON public.purchase_orders(company_id);
CREATE INDEX idx_purchase_orders_supplier_id ON public.purchase_orders(supplier_id);
CREATE INDEX idx_purchase_orders_status ON public.purchase_orders(status);
CREATE INDEX idx_purchase_orders_ordered_at ON public.purchase_orders(ordered_at);
CREATE INDEX idx_purchase_order_items_company_id ON public.purchase_order_items(company_id);
CREATE INDEX idx_purchase_order_items_purchase_order_id ON public.purchase_order_items(purchase_order_id);
CREATE INDEX idx_purchase_order_items_item_id ON public.purchase_order_items(item_id);

-- RLS Policies for purchase_orders
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view purchase orders from their company"
    ON public.purchase_orders FOR SELECT
    USING (
        company_id IN (
            SELECT company_id FROM public.company_members
            WHERE auth_user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert purchase orders for their company"
    ON public.purchase_orders FOR INSERT
    WITH CHECK (
        company_id IN (
            SELECT company_id FROM public.company_members
            WHERE auth_user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update purchase orders from their company"
    ON public.purchase_orders FOR UPDATE
    USING (
        company_id IN (
            SELECT company_id FROM public.company_members
            WHERE auth_user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete purchase orders from their company"
    ON public.purchase_orders FOR DELETE
    USING (
        company_id IN (
            SELECT company_id FROM public.company_members
            WHERE auth_user_id = auth.uid()
        )
    );

-- RLS Policies for purchase_order_items
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view purchase order items from their company"
    ON public.purchase_order_items FOR SELECT
    USING (
        company_id IN (
            SELECT company_id FROM public.company_members
            WHERE auth_user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert purchase order items for their company"
    ON public.purchase_order_items FOR INSERT
    WITH CHECK (
        company_id IN (
            SELECT company_id FROM public.company_members
            WHERE auth_user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update purchase order items from their company"
    ON public.purchase_order_items FOR UPDATE
    USING (
        company_id IN (
            SELECT company_id FROM public.company_members
            WHERE auth_user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete purchase order items from their company"
    ON public.purchase_order_items FOR DELETE
    USING (
        company_id IN (
            SELECT company_id FROM public.company_members
            WHERE auth_user_id = auth.uid()
        )
    );

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_purchase_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER purchase_orders_updated_at
    BEFORE UPDATE ON public.purchase_orders
    FOR EACH ROW
    EXECUTE FUNCTION update_purchase_orders_updated_at();

CREATE OR REPLACE FUNCTION update_purchase_order_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER purchase_order_items_updated_at
    BEFORE UPDATE ON public.purchase_order_items
    FOR EACH ROW
    EXECUTE FUNCTION update_purchase_order_items_updated_at();
