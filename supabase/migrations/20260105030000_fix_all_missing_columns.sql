-- Migration: Consolidated Fix for All Missing Columns
-- Version: 20260105030000
-- Description: Ensures all columns needed for sales and expedition modules exist

DO $$
BEGIN
    -- 1. Ensure volumes in delivery_route_orders
    IF NOT EXISTS (SELECT FROM information_schema.columns 
                  WHERE table_schema = 'public' 
                  AND table_name = 'delivery_route_orders' 
                  AND column_name = 'volumes') THEN
        ALTER TABLE public.delivery_route_orders ADD COLUMN volumes INTEGER DEFAULT 1;
    END IF;

    -- 2. Ensure loading_status in delivery_route_orders
    IF NOT EXISTS (SELECT FROM information_schema.columns 
                  WHERE table_schema = 'public' 
                  AND table_name = 'delivery_route_orders' 
                  AND column_name = 'loading_status') THEN
        ALTER TABLE public.delivery_route_orders ADD COLUMN loading_status TEXT DEFAULT 'pending';
        ALTER TABLE public.delivery_route_orders ADD CONSTRAINT delivery_route_orders_loading_status_check 
            CHECK (loading_status IN ('pending', 'loaded', 'partial', 'not_loaded'));
    END IF;

    -- 3. Ensure partial_payload in delivery_route_orders
    IF NOT EXISTS (SELECT FROM information_schema.columns 
                  WHERE table_schema = 'public' 
                  AND table_name = 'delivery_route_orders' 
                  AND column_name = 'partial_payload') THEN
        ALTER TABLE public.delivery_route_orders ADD COLUMN partial_payload JSONB;
    END IF;

    -- 4. Ensure return columns in delivery_route_orders
    IF NOT EXISTS (SELECT FROM information_schema.columns 
                  WHERE table_schema = 'public' 
                  AND table_name = 'delivery_route_orders' 
                  AND column_name = 'return_outcome') THEN
        ALTER TABLE public.delivery_route_orders ADD COLUMN return_outcome TEXT;
    END IF;

    IF NOT EXISTS (SELECT FROM information_schema.columns 
                  WHERE table_schema = 'public' 
                  AND table_name = 'delivery_route_orders' 
                  AND column_name = 'return_outcome_type') THEN
        ALTER TABLE public.delivery_route_orders ADD COLUMN return_outcome_type TEXT;
    END IF;

    IF NOT EXISTS (SELECT FROM information_schema.columns 
                  WHERE table_schema = 'public' 
                  AND table_name = 'delivery_route_orders' 
                  AND column_name = 'return_payload') THEN
        ALTER TABLE public.delivery_route_orders ADD COLUMN return_payload JSONB;
    END IF;

    IF NOT EXISTS (SELECT FROM information_schema.columns 
                  WHERE table_schema = 'public' 
                  AND table_name = 'delivery_route_orders' 
                  AND column_name = 'return_updated_at') THEN
        ALTER TABLE public.delivery_route_orders ADD COLUMN return_updated_at TIMESTAMPTZ;
    END IF;

    -- 5. Ensure scheduled_date in delivery_routes
    IF NOT EXISTS (SELECT FROM information_schema.columns 
                  WHERE table_schema = 'public' 
                  AND table_name = 'delivery_routes' 
                  AND column_name = 'scheduled_date') THEN
        ALTER TABLE public.delivery_routes ADD COLUMN scheduled_date DATE;
    END IF;

    -- 6. Ensure loading_checked columns in sales_documents (legacy support)
    IF NOT EXISTS (SELECT FROM information_schema.columns 
                  WHERE table_schema = 'public' 
                  AND table_name = 'sales_documents' 
                  AND column_name = 'loading_checked') THEN
        ALTER TABLE public.sales_documents ADD COLUMN loading_checked BOOLEAN DEFAULT false;
    END IF;

    IF NOT EXISTS (SELECT FROM information_schema.columns 
                  WHERE table_schema = 'public' 
                  AND table_name = 'sales_documents' 
                  AND column_name = 'loading_checked_at') THEN
        ALTER TABLE public.sales_documents ADD COLUMN loading_checked_at TIMESTAMPTZ;
    END IF;

    IF NOT EXISTS (SELECT FROM information_schema.columns 
                  WHERE table_schema = 'public' 
                  AND table_name = 'sales_documents' 
                  AND column_name = 'loading_checked_by') THEN
        ALTER TABLE public.sales_documents ADD COLUMN loading_checked_by UUID REFERENCES auth.users(id);
    END IF;

END $$;

-- Force schema reload
NOTIFY pgrst, 'reload schema';
