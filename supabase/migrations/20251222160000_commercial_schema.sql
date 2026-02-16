-- Migration: Add Commercial Fields and Tables
-- Created at: 2025-12-22 16:00:00

-- 1. Create Price Tables
CREATE TABLE IF NOT EXISTS public.price_tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    name TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- Index and Trigger for Price Tables
CREATE INDEX idx_price_tables_company ON public.price_tables(company_id);
CREATE TRIGGER update_price_tables_updated_at
    BEFORE UPDATE ON public.price_tables
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

-- Enable RLS for Price Tables
ALTER TABLE public.price_tables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for devs" ON public.price_tables FOR ALL USING (true);


-- 2. Create Payment Terms
CREATE TABLE IF NOT EXISTS public.payment_terms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    name TEXT NOT NULL, -- e.g. "30/60/90 days"
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- Index and Trigger for Payment Terms
CREATE INDEX idx_payment_terms_company ON public.payment_terms(company_id);
CREATE TRIGGER update_payment_terms_updated_at
    BEFORE UPDATE ON public.payment_terms
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

-- Enable RLS for Payment Terms
ALTER TABLE public.payment_terms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for devs" ON public.payment_terms FOR ALL USING (true);


-- 3. Update Organizations Table
-- Adding new Commercial Fields
ALTER TABLE public.organizations
    ADD COLUMN IF NOT EXISTS credit_limit NUMERIC(15, 2),
    ADD COLUMN IF NOT EXISTS default_discount NUMERIC(5, 2),
    ADD COLUMN IF NOT EXISTS sales_channel TEXT, -- WhatsApp, Phone, Email, etc.
    ADD COLUMN IF NOT EXISTS purchase_payment_terms_id UUID REFERENCES public.payment_terms(id),
    ADD COLUMN IF NOT EXISTS delivery_terms TEXT, -- Retira, Entrega, Transportadora...
    ADD COLUMN IF NOT EXISTS lead_time_days INTEGER,
    ADD COLUMN IF NOT EXISTS minimum_order_value NUMERIC(15, 2),
    ADD COLUMN IF NOT EXISTS preferred_carrier_id UUID REFERENCES public.organizations(id),
    ADD COLUMN IF NOT EXISTS region_route TEXT; -- Region/Route code or name

-- Ensure existing columns match requirements (renaming or altering if needed)
-- We already have:
-- default_payment_terms_days -> We might want to link to payment_terms table now instead
-- freight_terms -> existing
-- price_table_id -> existing (likely text or uuid, need to check if FK constraint exists)
-- sales_rep_user_id -> existing

-- START TRANSACTION; -- (Implicit in simple migrations usually, but good practice if supported)

-- Add FK to price_table_id if it doesn't exist (assuming it was just a string or UUID without constraint before)
-- First check if we need to cast or alter. Assuming it was UUID or compatible.
-- Attempting to add FK constraint gracefully.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'organizations_price_table_id_fkey'
    ) THEN
        -- It might have been created without FK or points to something else? 
        -- If it was just text/uuid, we add FK now. 
        -- NOTE: If existing data is invalid, this might fail. Assuming fresh/dev data.
        ALTER TABLE public.organizations
        ADD CONSTRAINT organizations_price_table_id_fkey
        FOREIGN KEY (price_table_id) REFERENCES public.price_tables(id);
    END IF;
END $$;

-- Let's also add a 'payment_terms_id' for SALES (replacing or supplementing default_payment_terms_days)
-- The user requested "Prazo de Pagamento Padrão (select)" which implies choosing from Defined Terms, not just days.
ALTER TABLE public.organizations
    ADD COLUMN IF NOT EXISTS payment_terms_id UUID REFERENCES public.payment_terms(id);

-- End of Migration
