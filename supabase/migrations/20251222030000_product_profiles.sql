-- Product Profiles Migration
-- Author: Antigravity
-- Date: 2025-12-22

-- 1. Extend ITEMS table
ALTER TABLE public.items 
ADD COLUMN IF NOT EXISTS gtin TEXT,
ADD COLUMN IF NOT EXISTS brand TEXT,
ADD COLUMN IF NOT EXISTS line TEXT,
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- 2. New Tables for Profiles

-- INVENTORY PROFILE
CREATE TABLE IF NOT EXISTS public.item_inventory_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
    
    control_stock BOOLEAN NOT NULL DEFAULT true,
    min_stock NUMERIC DEFAULT 0,
    max_stock NUMERIC,
    reorder_point NUMERIC DEFAULT 0,
    default_location TEXT, -- warehouse/shelf
    control_batch BOOLEAN NOT NULL DEFAULT false,
    control_expiry BOOLEAN NOT NULL DEFAULT false,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    UNIQUE(item_id)
);

-- PURCHASE PROFILE
CREATE TABLE IF NOT EXISTS public.item_purchase_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
    
    preferred_supplier_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
    lead_time_days INT DEFAULT 0,
    purchase_uom TEXT,
    conversion_factor NUMERIC DEFAULT 1, -- Purchase UOM to Stock UOM
    notes TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE(item_id)
);

-- SALES PROFILE
CREATE TABLE IF NOT EXISTS public.item_sales_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
    
    is_sellable BOOLEAN NOT NULL DEFAULT true,
    default_price_list_id UUID, -- Future link
    default_commission_percent NUMERIC DEFAULT 0,
    notes TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE(item_id)
);

-- FISCAL PROFILE (MVP)
CREATE TABLE IF NOT EXISTS public.item_fiscal_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
    
    ncm TEXT,
    cest TEXT,
    origin INT DEFAULT 0, -- 0-8
    cfop_default TEXT,
    tax_group_id UUID, -- Future link
    
    -- Overrides (Simplified for MVP)
    icms_rate NUMERIC,
    ipi_rate NUMERIC,
    pis_rate NUMERIC,
    cofins_rate NUMERIC,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE(item_id)
);

-- PRODUCTION PROFILE
CREATE TABLE IF NOT EXISTS public.item_production_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
    
    is_produced BOOLEAN NOT NULL DEFAULT false,
    default_bom_id UUID REFERENCES public.bom_headers(id) ON DELETE SET NULL,
    batch_size NUMERIC DEFAULT 1,
    notes TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE(item_id)
);

-- TAX GROUPS (Simple MVP)
CREATE TABLE IF NOT EXISTS public.tax_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);


-- RLS Policies

-- Inventory
ALTER TABLE public.item_inventory_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY inventory_isolation ON public.item_inventory_profiles USING (public.is_member_of(company_id)) WITH CHECK (public.is_member_of(company_id));

-- Purchase
ALTER TABLE public.item_purchase_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY purchase_isolation ON public.item_purchase_profiles USING (public.is_member_of(company_id)) WITH CHECK (public.is_member_of(company_id));

-- Sales
ALTER TABLE public.item_sales_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY sales_isolation ON public.item_sales_profiles USING (public.is_member_of(company_id)) WITH CHECK (public.is_member_of(company_id));

-- Fiscal
ALTER TABLE public.item_fiscal_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY fiscal_isolation ON public.item_fiscal_profiles USING (public.is_member_of(company_id)) WITH CHECK (public.is_member_of(company_id));

-- Production
ALTER TABLE public.item_production_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY production_isolation ON public.item_production_profiles USING (public.is_member_of(company_id)) WITH CHECK (public.is_member_of(company_id));

-- Tax Groups
ALTER TABLE public.tax_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY tax_groups_isolation ON public.tax_groups USING (public.is_member_of(company_id)) WITH CHECK (public.is_member_of(company_id));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_item_profiles_item_id ON public.item_inventory_profiles(item_id);
