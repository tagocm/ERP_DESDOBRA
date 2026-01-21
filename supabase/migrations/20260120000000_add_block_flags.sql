-- Migration: Add Operational Block Flags
-- Created: 2026-01-20
-- Purpose: Add flags to block operational flows (Expedition/Receiving) regardless of status

BEGIN;

-- ========================================
-- SALES DOCUMENTS: Dispatch Block
-- ========================================

ALTER TABLE public.sales_documents
ADD COLUMN IF NOT EXISTS dispatch_blocked BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS dispatch_blocked_reason TEXT,
ADD COLUMN IF NOT EXISTS dispatch_blocked_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS dispatch_blocked_by UUID REFERENCES auth.users(id);

-- Index for filtering blocked orders in expedition lists
CREATE INDEX IF NOT EXISTS idx_sales_documents_dispatch_blocked 
ON public.sales_documents(dispatch_blocked) 
WHERE dispatch_blocked = true;

-- ========================================
-- PURCHASE ORDERS: Receiving Block
-- ========================================

ALTER TABLE public.purchase_orders
ADD COLUMN IF NOT EXISTS receiving_blocked BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS receiving_blocked_reason TEXT,
ADD COLUMN IF NOT EXISTS receiving_blocked_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS receiving_blocked_by UUID REFERENCES auth.users(id);

-- Index for filtering/checking blocked POs
CREATE INDEX IF NOT EXISTS idx_purchase_orders_receiving_blocked 
ON public.purchase_orders(receiving_blocked) 
WHERE receiving_blocked = true;

-- ========================================
-- TRIGGER: Prevent Receiving if Blocked
-- ========================================

CREATE OR REPLACE FUNCTION check_purchase_order_receiving_block()
RETURNS TRIGGER AS $$
BEGIN
    -- If status is changing to 'received' AND receiving is blocked
    IF NEW.status = 'received' AND NEW.receiving_blocked = true THEN
         RAISE EXCEPTION 'Purchase Order % cannot be received because it is blocked. Reason: %', 
            NEW.document_number, NEW.receiving_blocked_reason;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_purchase_order_receiving_check ON public.purchase_orders;

CREATE TRIGGER on_purchase_order_receiving_check
    BEFORE UPDATE OF status ON public.purchase_orders
    FOR EACH ROW
    EXECUTE FUNCTION check_purchase_order_receiving_block();

COMMIT;
