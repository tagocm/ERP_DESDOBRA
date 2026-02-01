-- Migration: Ensure All Core Sales Documents Columns
-- Description: Final comprehensive check for all essential columns in sales_documents

DO $$
BEGIN
    -- Core identification
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'sales_documents' AND column_name = 'id') THEN
        ALTER TABLE public.sales_documents ADD COLUMN id UUID PRIMARY KEY DEFAULT gen_random_uuid();
    END IF;

    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'sales_documents' AND column_name = 'company_id') THEN
        ALTER TABLE public.sales_documents ADD COLUMN company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT;
    END IF;

    -- Document type and number
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'sales_documents' AND column_name = 'doc_type') THEN
        ALTER TABLE public.sales_documents ADD COLUMN doc_type TEXT NOT NULL DEFAULT 'proposal' CHECK (doc_type IN ('proposal', 'order'));
    END IF;

    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'sales_documents' AND column_name = 'document_number') THEN
        ALTER TABLE public.sales_documents ADD COLUMN document_number BIGINT;
    END IF;

    -- Relationships
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'sales_documents' AND column_name = 'client_id') THEN
        ALTER TABLE public.sales_documents ADD COLUMN client_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT;
    END IF;

    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'sales_documents' AND column_name = 'price_table_id') THEN
        ALTER TABLE public.sales_documents ADD COLUMN price_table_id UUID REFERENCES public.price_tables(id);
    END IF;

    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'sales_documents' AND column_name = 'payment_terms_id') THEN
        ALTER TABLE public.sales_documents ADD COLUMN payment_terms_id UUID REFERENCES public.payment_terms(id);
    END IF;

    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'sales_documents' AND column_name = 'payment_mode_id') THEN
        ALTER TABLE public.sales_documents ADD COLUMN payment_mode_id UUID;
    END IF;

    -- Status fields
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'sales_documents' AND column_name = 'status_commercial') THEN
        ALTER TABLE public.sales_documents ADD COLUMN status_commercial TEXT NOT NULL DEFAULT 'draft' CHECK (status_commercial IN ('draft', 'sent', 'approved', 'confirmed', 'cancelled', 'lost'));
    END IF;

    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'sales_documents' AND column_name = 'status_logistic') THEN
        ALTER TABLE public.sales_documents ADD COLUMN status_logistic TEXT NOT NULL DEFAULT 'pending';
    END IF;

    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'sales_documents' AND column_name = 'status_fiscal') THEN
        ALTER TABLE public.sales_documents ADD COLUMN status_fiscal TEXT NOT NULL DEFAULT 'none';
    END IF;

    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'sales_documents' AND column_name = 'financial_status') THEN
        ALTER TABLE public.sales_documents ADD COLUMN financial_status TEXT DEFAULT 'pending';
    END IF;

    -- Delivery info
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'sales_documents' AND column_name = 'delivery_address_json') THEN
        ALTER TABLE public.sales_documents ADD COLUMN delivery_address_json JSONB;
    END IF;

    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'sales_documents' AND column_name = 'carrier_id') THEN
        ALTER TABLE public.sales_documents ADD COLUMN carrier_id UUID REFERENCES public.organizations(id);
    END IF;

    -- Notes
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'sales_documents' AND column_name = 'internal_notes') THEN
        ALTER TABLE public.sales_documents ADD COLUMN internal_notes TEXT;
    END IF;

    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'sales_documents' AND column_name = 'client_notes') THEN
        ALTER TABLE public.sales_documents ADD COLUMN client_notes TEXT;
    END IF;

    -- Flags
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'sales_documents' AND column_name = 'is_antecipada') THEN
        ALTER TABLE public.sales_documents ADD COLUMN is_antecipada BOOLEAN DEFAULT false;
    END IF;

    -- Timestamps
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'sales_documents' AND column_name = 'created_at') THEN
        ALTER TABLE public.sales_documents ADD COLUMN created_at TIMESTAMPTZ DEFAULT now();
    END IF;

    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'sales_documents' AND column_name = 'updated_at') THEN
        ALTER TABLE public.sales_documents ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();
    END IF;

    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'sales_documents' AND column_name = 'deleted_at') THEN
        ALTER TABLE public.sales_documents ADD COLUMN deleted_at TIMESTAMPTZ;
    END IF;

END $$;

-- Force schema reload
NOTIFY pgrst, 'reload schema';
