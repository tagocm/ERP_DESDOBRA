-- Comprehensive relationship fix with ORPHAN CLEANUP
-- Unblocks PostgREST relationships

BEGIN;

-- CLEANUP: Delete records referencing non-existent orders
DELETE FROM public.sales_document_items WHERE document_id NOT IN (SELECT id FROM public.sales_documents);
DELETE FROM public.sales_document_payments WHERE document_id NOT IN (SELECT id FROM public.sales_documents);
DELETE FROM public.sales_document_adjustments WHERE sales_document_id NOT IN (SELECT id FROM public.sales_documents);
DELETE FROM public.delivery_route_orders WHERE sales_document_id NOT IN (SELECT id FROM public.sales_documents);

-- 1. sales_document_items
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sales_document_items_document_id_fkey') THEN
        ALTER TABLE public.sales_document_items 
        ADD CONSTRAINT sales_document_items_document_id_fkey 
        FOREIGN KEY (document_id) REFERENCES public.sales_documents(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 2. sales_document_payments
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sales_document_payments_document_id_fkey') THEN
        ALTER TABLE public.sales_document_payments 
        ADD CONSTRAINT sales_document_payments_document_id_fkey 
        FOREIGN KEY (document_id) REFERENCES public.sales_documents(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 3. sales_document_adjustments
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sales_document_adjustments_sales_document_id_fkey') THEN
        ALTER TABLE public.sales_document_adjustments 
        ADD CONSTRAINT sales_document_adjustments_sales_document_id_fkey 
        FOREIGN KEY (sales_document_id) REFERENCES public.sales_documents(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 4. delivery_route_orders
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'delivery_route_orders_sales_document_id_fkey') THEN
        ALTER TABLE public.delivery_route_orders 
        ADD CONSTRAINT delivery_route_orders_sales_document_id_fkey 
        FOREIGN KEY (sales_document_id) REFERENCES public.sales_documents(id);
    END IF;
END $$;

-- Force PostgREST schema reload
NOTIFY pgrst, 'reload schema';

COMMIT;
