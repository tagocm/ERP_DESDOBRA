-- Migration: Expedition Module (Routes & Logistics)
-- Description: Creates tables for delivery routes and assigning orders to routes.

-- 1. delivery_routes
CREATE TABLE IF NOT EXISTS delivery_routes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL REFERENCES companies(id),
    name text NOT NULL,
    route_date date NOT NULL DEFAULT current_date,
    status text NOT NULL DEFAULT 'planned', -- planned | closed | in_transit | done
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid REFERENCES auth.users(id)
);

-- 2. delivery_route_orders
CREATE TABLE IF NOT EXISTS delivery_route_orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL REFERENCES companies(id),
    route_id uuid NOT NULL REFERENCES delivery_routes(id) ON DELETE CASCADE,
    sales_document_id uuid NOT NULL REFERENCES sales_documents(id) ON DELETE CASCADE,
    position int NOT NULL DEFAULT 0,
    assigned_at timestamptz NOT NULL DEFAULT now(),
    assigned_by uuid REFERENCES auth.users(id),
    UNIQUE (route_id, sales_document_id)
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_delivery_routes_company_date ON delivery_routes(company_id, route_date);
CREATE INDEX IF NOT EXISTS idx_delivery_route_orders_route_pos ON delivery_route_orders(route_id, position);
CREATE INDEX IF NOT EXISTS idx_delivery_route_orders_sales_doc ON delivery_route_orders(sales_document_id);

-- 4. RLS Policies

-- delivery_routes
ALTER TABLE delivery_routes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view routes for their company"
    ON delivery_routes FOR SELECT
    USING (company_id IN (SELECT company_id FROM company_members WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can insert routes for their company"
    ON delivery_routes FOR INSERT
    WITH CHECK (company_id IN (SELECT company_id FROM company_members WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can update routes for their company"
    ON delivery_routes FOR UPDATE
    USING (company_id IN (SELECT company_id FROM company_members WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can delete routes for their company"
    ON delivery_routes FOR DELETE
    USING (company_id IN (SELECT company_id FROM company_members WHERE auth_user_id = auth.uid()));

-- delivery_route_orders
ALTER TABLE delivery_route_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view route orders for their company"
    ON delivery_route_orders FOR SELECT
    USING (company_id IN (SELECT company_id FROM company_members WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can insert route orders for their company"
    ON delivery_route_orders FOR INSERT
    WITH CHECK (company_id IN (SELECT company_id FROM company_members WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can update route orders for their company"
    ON delivery_route_orders FOR UPDATE
    USING (company_id IN (SELECT company_id FROM company_members WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can delete route orders for their company"
    ON delivery_route_orders FOR DELETE
    USING (company_id IN (SELECT company_id FROM company_members WHERE auth_user_id = auth.uid()));
