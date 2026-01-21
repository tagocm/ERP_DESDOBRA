-- Migration: Ensure Organization Columns Exist
-- Description: Forces the addition of country_code and other NF-e related fields if they are missing.
-- This handles cases where previous migrations might have been skipped or partially applied.

DO $$
BEGIN
    -- 0. SCHEMA FIX: Rename 'document' to 'document_number' if exists (Codebase uses document_number)
    IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'document') THEN
        ALTER TABLE public.organizations RENAME COLUMN document TO document_number;
    END IF;

    -- Ensure document_number exists
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'document_number') THEN
        ALTER TABLE public.organizations ADD COLUMN document_number TEXT;
    END IF;

    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'document_type') THEN
        ALTER TABLE public.organizations ADD COLUMN document_type TEXT;
    END IF;

    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'notes') THEN
        ALTER TABLE public.organizations ADD COLUMN notes TEXT;
    END IF;

    -- Fix for code usage of 'final_consumer' vs 'is_final_consumer'
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'final_consumer') THEN
        ALTER TABLE public.organizations ADD COLUMN final_consumer BOOLEAN DEFAULT false;
    END IF;

    -- 1. Core / Identity Fields
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'legal_name') THEN
        ALTER TABLE public.organizations ADD COLUMN legal_name TEXT;
    END IF;

    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'trade_name') THEN
        ALTER TABLE public.organizations ADD COLUMN trade_name TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'state_registration') THEN
        ALTER TABLE public.organizations ADD COLUMN state_registration TEXT;
    END IF;

    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'status') THEN
        ALTER TABLE public.organizations ADD COLUMN status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive'));
    END IF;

    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'created_at') THEN
        ALTER TABLE public.organizations ADD COLUMN created_at TIMESTAMPTZ DEFAULT now();
    END IF;

    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'updated_at') THEN
        ALTER TABLE public.organizations ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();
    END IF;
    
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'deleted_at') THEN
        ALTER TABLE public.organizations ADD COLUMN deleted_at TIMESTAMPTZ;
    END IF;

    -- 1. country_code (The specific error reported)
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'country_code') THEN
        ALTER TABLE public.organizations ADD COLUMN country_code TEXT NOT NULL DEFAULT 'BR';
    END IF;

    -- 2. Other potentially missing NF-e fields (Safeguard)
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'municipal_registration') THEN
        ALTER TABLE public.organizations ADD COLUMN municipal_registration TEXT;
    END IF;

    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'ie_indicator') THEN
        ALTER TABLE public.organizations ADD COLUMN ie_indicator TEXT NOT NULL DEFAULT 'contributor' CHECK (ie_indicator IN ('contributor', 'exempt', 'non_contributor'));
    END IF;

    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'suframa') THEN
        ALTER TABLE public.organizations ADD COLUMN suframa TEXT;
    END IF;

    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'email_nfe') THEN
        ALTER TABLE public.organizations ADD COLUMN email_nfe TEXT;
    END IF;

    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'email') THEN
        ALTER TABLE public.organizations ADD COLUMN email TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'phone') THEN
        ALTER TABLE public.organizations ADD COLUMN phone TEXT;
    END IF;

    -- Legacy/Core Columns (from Customers Module)
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'default_payment_terms_days') THEN
        ALTER TABLE public.organizations ADD COLUMN default_payment_terms_days INTEGER;
    END IF;

    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'notes_commercial') THEN
        ALTER TABLE public.organizations ADD COLUMN notes_commercial TEXT;
    END IF;

    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'freight_terms') THEN
        ALTER TABLE public.organizations ADD COLUMN freight_terms TEXT; 
    END IF;

    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'price_table_id') THEN
        IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'price_tables') THEN
             ALTER TABLE public.organizations ADD COLUMN price_table_id UUID REFERENCES public.price_tables(id);
        ELSE
             ALTER TABLE public.organizations ADD COLUMN price_table_id UUID;
        END IF;
    END IF;

    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'sales_rep_user_id') THEN
        ALTER TABLE public.organizations ADD COLUMN sales_rep_user_id UUID REFERENCES auth.users(id);
    END IF;

    -- Fiscal Fields
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'is_simple_national') THEN
        ALTER TABLE public.organizations ADD COLUMN is_simple_national BOOLEAN DEFAULT false;
    END IF;
    
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'is_public_agency') THEN
        ALTER TABLE public.organizations ADD COLUMN is_public_agency BOOLEAN DEFAULT false;
    END IF;

    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'is_final_consumer') THEN
        ALTER TABLE public.organizations ADD COLUMN is_final_consumer BOOLEAN DEFAULT false;
    END IF;

    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'icms_contributor') THEN
        ALTER TABLE public.organizations ADD COLUMN icms_contributor BOOLEAN DEFAULT false; 
    END IF;

    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'is_ie_exempt') THEN
        ALTER TABLE public.organizations ADD COLUMN is_ie_exempt BOOLEAN DEFAULT false;
    END IF;
    
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'tax_regime') THEN
        ALTER TABLE public.organizations ADD COLUMN tax_regime TEXT;
    END IF;

    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'public_agency_sphere') THEN
        ALTER TABLE public.organizations ADD COLUMN public_agency_sphere TEXT;
    END IF;

    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'public_agency_code') THEN
        ALTER TABLE public.organizations ADD COLUMN public_agency_code TEXT;
    END IF;

    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'default_operation_nature') THEN
        ALTER TABLE public.organizations ADD COLUMN default_operation_nature TEXT;
    END IF;

    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'default_cfop') THEN
        ALTER TABLE public.organizations ADD COLUMN default_cfop TEXT;
    END IF;

    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'notes_fiscal') THEN
        ALTER TABLE public.organizations ADD COLUMN notes_fiscal TEXT;
    END IF;

    -- 3. Commercial Fields (Critical for "Nova Pessoas & Empresas" page)
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'credit_limit') THEN
        ALTER TABLE public.organizations ADD COLUMN credit_limit NUMERIC(15, 2);
    END IF;

    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'default_discount') THEN
        ALTER TABLE public.organizations ADD COLUMN default_discount NUMERIC(5, 2);
    END IF;

    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'sales_channel') THEN
        ALTER TABLE public.organizations ADD COLUMN sales_channel TEXT;
    END IF;

    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'payment_terms_id') THEN
        ALTER TABLE public.organizations ADD COLUMN payment_terms_id UUID REFERENCES public.payment_terms(id);
    END IF;

    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'purchase_payment_terms_id') THEN
        ALTER TABLE public.organizations ADD COLUMN purchase_payment_terms_id UUID REFERENCES public.payment_terms(id);
    END IF;

    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'delivery_terms') THEN
        ALTER TABLE public.organizations ADD COLUMN delivery_terms TEXT;
    END IF;

    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'lead_time_days') THEN
        ALTER TABLE public.organizations ADD COLUMN lead_time_days INTEGER;
    END IF;

    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'minimum_order_value') THEN
        ALTER TABLE public.organizations ADD COLUMN minimum_order_value NUMERIC(15, 2);
    END IF;

    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'preferred_carrier_id') THEN
        ALTER TABLE public.organizations ADD COLUMN preferred_carrier_id UUID REFERENCES public.organizations(id);
    END IF;

    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'region_route') THEN
        ALTER TABLE public.organizations ADD COLUMN region_route TEXT;
    END IF;
    
    -- 4. Payment Modes (Added recently)
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'payment_mode_id') THEN
        -- Check if payment_modes table exists first to avoid error
        IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'payment_modes') THEN
             ALTER TABLE public.organizations ADD COLUMN payment_mode_id UUID REFERENCES public.payment_modes(id);
        END IF;
    END IF;

    -- 5. People Fields
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'people' AND column_name = 'departments') THEN
        ALTER TABLE public.people ADD COLUMN departments TEXT[];
    END IF;

    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'people' AND column_name = 'notes') THEN
        ALTER TABLE public.people ADD COLUMN notes TEXT;
    END IF;

    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'people' AND column_name = 'branch_id') THEN
        -- Check if organization_branches exists
        IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'organization_branches') THEN
            ALTER TABLE public.people ADD COLUMN branch_id UUID REFERENCES public.organization_branches(id) ON DELETE SET NULL;
        ELSE
            ALTER TABLE public.people ADD COLUMN branch_id UUID;
        END IF;
    END IF;

    -- 6. Addresses Fields - Comprehensive Check
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'addresses' AND column_name = 'city_code_ibge') THEN
        ALTER TABLE public.addresses ADD COLUMN city_code_ibge TEXT;
    END IF;

    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'addresses' AND column_name = 'complement') THEN
        ALTER TABLE public.addresses ADD COLUMN complement TEXT;
    END IF;

    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'addresses' AND column_name = 'number') THEN
        ALTER TABLE public.addresses ADD COLUMN number TEXT;
    END IF;

    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'addresses' AND column_name = 'neighborhood') THEN
        ALTER TABLE public.addresses ADD COLUMN neighborhood TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'addresses' AND column_name = 'street') THEN
        ALTER TABLE public.addresses ADD COLUMN street TEXT;
    END IF;

    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'addresses' AND column_name = 'zip') THEN
        ALTER TABLE public.addresses ADD COLUMN zip TEXT;
    END IF;

    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'addresses' AND column_name = 'city') THEN
        ALTER TABLE public.addresses ADD COLUMN city TEXT;
    END IF;

    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'addresses' AND column_name = 'state') THEN
        ALTER TABLE public.addresses ADD COLUMN state TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'addresses' AND column_name = 'country') THEN
        ALTER TABLE public.addresses ADD COLUMN country TEXT DEFAULT 'BR';
    END IF;
    
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'addresses' AND column_name = 'branch_id') THEN
         -- Check if organization_branches exists
        IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'organization_branches') THEN
            ALTER TABLE public.addresses ADD COLUMN branch_id UUID REFERENCES public.organization_branches(id) ON DELETE SET NULL;
        ELSE
            ALTER TABLE public.addresses ADD COLUMN branch_id UUID;
        END IF;
    END IF;

    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'addresses' AND column_name = 'is_default') THEN
        ALTER TABLE public.addresses ADD COLUMN is_default BOOLEAN DEFAULT false;
    END IF;

    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'addresses' AND column_name = 'type') THEN
        ALTER TABLE public.addresses ADD COLUMN type TEXT DEFAULT 'other';
    END IF;

    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'addresses' AND column_name = 'label') THEN
        ALTER TABLE public.addresses ADD COLUMN label TEXT;
    END IF;

    -- 7. People Fields - Comprehensive Check
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'people' AND column_name = 'full_name') THEN
        ALTER TABLE public.people ADD COLUMN full_name TEXT;
    END IF;

    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'people' AND column_name = 'email') THEN
        ALTER TABLE public.people ADD COLUMN email TEXT;
    END IF;

    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'people' AND column_name = 'phone') THEN
        ALTER TABLE public.people ADD COLUMN phone TEXT;
    END IF;

    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'people' AND column_name = 'role_title') THEN
        ALTER TABLE public.people ADD COLUMN role_title TEXT;
    END IF;

    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'people' AND column_name = 'is_primary') THEN
        ALTER TABLE public.people ADD COLUMN is_primary BOOLEAN DEFAULT false;
    END IF;

END $$;

-- Force Schema Cache Reload
NOTIFY pgrst, 'reload schema';
