-- Migration: Refactor Deliveries Flow (Logistics & Commercial)
-- Date: 2026-01-04
-- Description: Drops legacy reason models and implements simplified Deliveries flow tables.

BEGIN;

-- 1. Drop Legacy Tables
DROP TABLE IF EXISTS public.occurrence_reasons CASCADE;
-- Note: delivery_route_order_occurrences depends on it, CASCADE will handle it or we need to drop it too.
-- Assuming delivery_route_order_occurrences is also legacy/to be refactored, but let's keep it if it stores historical data we care about?
-- User said: "REMOVER / DELETAR O QUE JÁ EXISTE".
-- So we drop it.

DROP TABLE IF EXISTS public.delivery_route_order_occurrences CASCADE;


-- 2. Create Delivery Reasons Table
CREATE TABLE IF NOT EXISTS public.delivery_reasons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    
    name TEXT NOT NULL,
    reason_group TEXT NOT NULL CHECK (reason_group IN ('CARREGAMENTO_PARCIAL', 'NAO_CARREGAMENTO', 'ENTREGA_PARCIAL', 'NAO_ENTREGA')),
    
    is_active BOOLEAN DEFAULT true,
    require_note BOOLEAN DEFAULT false,
    
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index
CREATE INDEX idx_delivery_reasons_company ON public.delivery_reasons(company_id);
CREATE INDEX idx_delivery_reasons_group ON public.delivery_reasons(company_id, reason_group);


-- 3. Create Order Delivery Events (Logistics Log)
CREATE TABLE IF NOT EXISTS public.order_delivery_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE, -- Denormalized for RLS
    order_id UUID NOT NULL REFERENCES public.sales_documents(id) ON DELETE CASCADE,
    
    event_type TEXT NOT NULL CHECK (event_type IN ('CARREGAMENTO_PARCIAL')), -- Expandable later
    reason_id UUID REFERENCES public.delivery_reasons(id) ON DELETE SET NULL,
    note TEXT,
    
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Index
CREATE INDEX idx_order_delivery_events_order ON public.order_delivery_events(order_id);


-- 4. Create Order Item Pending Balances (Commercial Decision)
CREATE TABLE IF NOT EXISTS public.order_item_pending_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES public.sales_documents(id) ON DELETE CASCADE,
    order_item_id UUID NOT NULL REFERENCES public.sales_document_items(id) ON DELETE CASCADE,
    
    qty_pending NUMERIC(15, 4) NOT NULL DEFAULT 0,
    
    status TEXT NOT NULL CHECK (status IN ('AGUARDANDO_COMERCIAL', 'CANCELADO', 'LIBERADO_PARA_SANDBOX')),
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index
CREATE INDEX idx_pending_balances_order ON public.order_item_pending_balances(order_id);
CREATE INDEX idx_pending_balances_item ON public.order_item_pending_balances(order_item_id);


-- 5. RLS Policies
ALTER TABLE public.delivery_reasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_delivery_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_item_pending_balances ENABLE ROW LEVEL SECURITY;

-- Reasons
CREATE POLICY "Users can view reasons for their company" ON public.delivery_reasons
    FOR SELECT USING (public.is_member_of(company_id));
CREATE POLICY "Users can manage reasons for their company" ON public.delivery_reasons
    FOR ALL USING (public.is_member_of(company_id));

-- Events
CREATE POLICY "Users can view events for their company" ON public.order_delivery_events
    FOR SELECT USING (public.is_member_of(company_id));
CREATE POLICY "Users can insert events for their company" ON public.order_delivery_events
    FOR INSERT WITH CHECK (public.is_member_of(company_id));

-- Pending Balances
CREATE POLICY "Users can view pending balances for their company" ON public.order_item_pending_balances
    FOR SELECT USING (public.is_member_of(company_id));
CREATE POLICY "Users can manage pending balances for their company" ON public.order_item_pending_balances
    FOR ALL USING (public.is_member_of(company_id));


-- 6. Helper: Force schema reload (just in case)
NOTIFY pgrst, 'reload schema';

COMMIT;
