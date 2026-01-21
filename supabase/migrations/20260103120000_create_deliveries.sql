-- Migration: Create Deliveries Module (MVP)
-- Description: Creates tables for the new Deliveries model and adds a feature flag for controlled rollout.

BEGIN;

-- 1. Create Enum for Delivery Status
CREATE TYPE delivery_status AS ENUM (
    'draft',
    'in_preparation',
    'in_route',
    'delivered',
    'delivered_partial',
    'returned_partial',
    'returned_total',
    'cancelled'
);

-- 2. Create Deliveries Table
CREATE TABLE IF NOT EXISTS public.deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    sales_document_id UUID NOT NULL REFERENCES public.sales_documents(id) ON DELETE CASCADE,
    
    number INT NOT NULL, -- Sequential number per order (1, 2, 3...)
    
    status delivery_status NOT NULL DEFAULT 'draft',
    route_id UUID REFERENCES public.delivery_routes(id) ON DELETE SET NULL, -- Nullable initially
    
    notes TEXT,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES auth.users(id),
    
    -- Constraint: Unique number per sales order
    CONSTRAINT uq_deliveries_order_number UNIQUE (sales_document_id, number)
);

-- Indexes
CREATE INDEX idx_deliveries_company ON public.deliveries(company_id);
CREATE INDEX idx_deliveries_sales_doc ON public.deliveries(sales_document_id);
CREATE INDEX idx_deliveries_route ON public.deliveries(route_id);
CREATE INDEX idx_deliveries_status ON public.deliveries(status);

-- 3. Create Delivery Items Table
CREATE TABLE IF NOT EXISTS public.delivery_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE, -- Denormalized for RLS
    delivery_id UUID NOT NULL REFERENCES public.deliveries(id) ON DELETE CASCADE,
    sales_document_item_id UUID NOT NULL REFERENCES public.sales_document_items(id) ON DELETE CASCADE,
    
    -- Quantities
    qty_planned NUMERIC(15, 4) NOT NULL DEFAULT 0, -- Snapshot of order qty at creation
    qty_loaded NUMERIC(15, 4) NOT NULL DEFAULT 0,
    qty_delivered NUMERIC(15, 4) NOT NULL DEFAULT 0,
    qty_returned NUMERIC(15, 4) NOT NULL DEFAULT 0,
    
    notes TEXT,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    -- Constraint: Each order item appears only once per delivery
    CONSTRAINT uq_delivery_items_item UNIQUE (delivery_id, sales_document_item_id),
    
    -- Basic Sanity Checks
    CONSTRAINT chk_qty_planned_positive CHECK (qty_planned >= 0),
    CONSTRAINT chk_qty_loaded_positive CHECK (qty_loaded >= 0),
    CONSTRAINT chk_qty_delivered_positive CHECK (qty_delivered >= 0),
    CONSTRAINT chk_qty_returned_positive CHECK (qty_returned >= 0)
);

-- Indexes
CREATE INDEX idx_delivery_items_delivery ON public.delivery_items(delivery_id);
CREATE INDEX idx_delivery_items_sales_item ON public.delivery_items(sales_document_item_id);

-- 4. RLS Policies
ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_items ENABLE ROW LEVEL SECURITY;

-- Deliveries Policies
CREATE POLICY "Users can view deliveries for their company" ON public.deliveries
    FOR SELECT USING (public.is_member_of(company_id));

CREATE POLICY "Users can insert deliveries for their company" ON public.deliveries
    FOR INSERT WITH CHECK (public.is_member_of(company_id));

CREATE POLICY "Users can update deliveries for their company" ON public.deliveries
    FOR UPDATE USING (public.is_member_of(company_id));

CREATE POLICY "Users can delete deliveries for their company" ON public.deliveries
    FOR DELETE USING (public.is_member_of(company_id));

-- Delivery Items Policies
CREATE POLICY "Users can view delivery items for their company" ON public.delivery_items
    FOR SELECT USING (public.is_member_of(company_id));

CREATE POLICY "Users can insert delivery items for their company" ON public.delivery_items
    FOR INSERT WITH CHECK (public.is_member_of(company_id));

CREATE POLICY "Users can update delivery items for their company" ON public.delivery_items
    FOR UPDATE USING (public.is_member_of(company_id));

CREATE POLICY "Users can delete delivery items for their company" ON public.delivery_items
    FOR DELETE USING (public.is_member_of(company_id));


-- 5. Feature Flag in Company Settings
-- Assuming 'company_settings' table exists from previous migrations.
-- We add 'use_deliveries_model' column if it doesn't exist.

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'company_settings' AND column_name = 'use_deliveries_model') THEN
        ALTER TABLE public.company_settings ADD COLUMN use_deliveries_model BOOLEAN DEFAULT false;
    END IF;
END $$;

COMMIT;
