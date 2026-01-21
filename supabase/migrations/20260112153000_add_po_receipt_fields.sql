-- Migration: Add Purchase Order Receipt Fields
-- Description: Adds columns to store supplier invoice (NF) details and receipt metadata.

DO $$
BEGIN
    -- Manufacturer/Supplier Invoice Number (NF)
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'supplier_invoice_number') THEN
        ALTER TABLE public.purchase_orders ADD COLUMN supplier_invoice_number TEXT;
    END IF;

    -- Invoice Series
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'supplier_invoice_series') THEN
        ALTER TABLE public.purchase_orders ADD COLUMN supplier_invoice_series TEXT;
    END IF;

    -- Invoice Date
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'supplier_invoice_date') THEN
        ALTER TABLE public.purchase_orders ADD COLUMN supplier_invoice_date DATE;
    END IF;

    -- Receipt Timestamp (When it was actually processed in system vs Invoice Date)
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'received_at') THEN
        ALTER TABLE public.purchase_orders ADD COLUMN received_at TIMESTAMPTZ;
    END IF;

    -- Receiver User
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'received_by') THEN
        ALTER TABLE public.purchase_orders ADD COLUMN received_by UUID REFERENCES auth.users(id);
    END IF;

    -- Receipt Notes
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'receipt_notes') THEN
        ALTER TABLE public.purchase_orders ADD COLUMN receipt_notes TEXT;
    END IF;

END $$;

-- Refresh Schema
NOTIFY pgrst, 'reload schema';
