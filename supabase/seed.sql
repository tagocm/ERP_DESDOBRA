
-- Seed Data for Development
-- This file runs every time you run 'npm run supabase:reset'
-- RESET STRATEGY: Tables are truncated by 'supabase db reset' before this runs (re-creating schema).

-- 0. Variables (Mocking ID behavior with subqueries or let it auto-gen)
-- We will use DO blocks for complex logic to ensure FK integrity.

-- 1. Ensure Company Exists
INSERT INTO public.companies (name, slug)
VALUES ('Martigran', 'martigran')
ON CONFLICT (slug) DO NOTHING;

-- 2. Ensure Admin User Exists
WITH company_data AS (
    SELECT id FROM public.companies WHERE slug = 'martigran' LIMIT 1
)
INSERT INTO public.users (company_id, email, full_name, role, is_active)
SELECT 
    id, 
    'admin@desdobra.local', 
    'Admin Local', 
    'admin', 
    true
FROM company_data
ON CONFLICT (email) DO NOTHING;


-- 3. Core Tables: UOMs, Products, Price Tables

DO $$
DECLARE
    v_company_id UUID;
    v_user_id UUID;
    v_pt_id UUID; -- Price Table ID
    v_prod_chapa UUID;
    v_prod_bloco UUID;
    v_prod_iso UUID;
    v_org_id UUID;
    v_order_id UUID;
BEGIN
    SELECT id INTO v_company_id FROM public.companies WHERE slug = 'martigran';
    SELECT id INTO v_user_id FROM public.users WHERE email = 'admin@desdobra.local';

    -- 3.1 Units of Measure (UOM)
    -- Assuming table 'units_of_measure' exists (check migrations if needed, usually handled) or similar.
    -- If not standard, skipping or assuming standard ones exist.
    -- (If your schema has strict UOMs, insert them here. Assuming simple string or skip if tableless).

    -- 3.2 Products
    -- Product A: Chapa (M2)
    INSERT INTO public.products (company_id, name, code, unit, type, status)
    VALUES (v_company_id, 'Granito Branco Dalas', 'GR001', 'm2', 'finished', 'active')
    ON CONFLICT (company_id, code) DO NOTHING
    RETURNING id INTO v_prod_chapa;

    -- Product B: Bloco (M3)
    INSERT INTO public.products (company_id, name, code, unit, type, status)
    VALUES (v_company_id, 'Bloco Granito Preto', 'BL002', 'm3', 'raw', 'active')
    ON CONFLICT (company_id, code) DO NOTHING
    RETURNING id INTO v_prod_bloco;
    
    -- Product C: Insumo (UN)
    INSERT INTO public.products (company_id, name, code, unit, type, status)
    VALUES (v_company_id, 'Resina Epoxi', 'INS003', 'un', 'input', 'active')
    ON CONFLICT (company_id, code) DO NOTHING
    RETURNING id INTO v_prod_iso;

    -- 3.3 Price Tables
    INSERT INTO public.price_tables (company_id, name, active)
    VALUES (v_company_id, 'Tabela Padrão 2026', true)
    RETURNING id INTO v_pt_id;

    -- Price Table Items
    INSERT INTO public.price_table_items (price_table_id, product_id, price)
    VALUES 
        (v_pt_id, v_prod_chapa, 150.00),
        (v_pt_id, v_prod_bloco, 3500.00),
        (v_pt_id, v_prod_iso, 45.50);

    -- 4. Clients / Organizations
    INSERT INTO public.organizations (company_id, trade_name, legal_name, document, status)
    VALUES (v_company_id, 'Construtora Exemplo', 'Construtora Exemplo S/A', '12345678000199', 'active')
    ON CONFLICT (company_id, document) DO NOTHING
    RETURNING id INTO v_org_id;

    -- Address
    INSERT INTO public.addresses (company_id, organization_id, street, number, neighborhood, city, state, postal_code, type)
    VALUES (v_company_id, v_org_id, 'Av. das Nações', '1000', 'Centro', 'São Paulo', 'SP', '01000-000', 'shipping');

    -- Contact
    INSERT INTO public.people (company_id, organization_id, full_name, email, is_primary)
    VALUES (v_company_id, v_org_id, 'Engenheiro Chefe', 'eng@obra.com', true);

    -- 5. Sales Order (Confirmable)
    -- Status: 'draft' or 'confirmed'? Let's make it 'approved' (Active -> Logistics can see it)
    -- Assuming status flow: draft -> requested -> approved -> (logistics)
    
    INSERT INTO public.sales_documents (
        company_id, 
        client_id, 
        document_number, 
        type, 
        status_logistic, 
        status_finance, 
        total_amount, 
        date_issue, 
        created_by
    )
    VALUES (
        v_company_id, 
        v_org_id, 
        '100100', 
        'order', 
        'pendente', -- Ready for Sandbox
        'approved', 
        1500.00, 
        CURRENT_DATE, 
        v_user_id
    )
    RETURNING id INTO v_order_id;

    -- Order Items
    INSERT INTO public.sales_document_items (document_id, product_id, quantity, unit_price, total_amount)
    VALUES 
        (v_order_id, v_prod_chapa, 10, 150.00, 1500.00);

    -- 6. Setup Settings (Deliveries Model ON)
    INSERT INTO public.company_settings (company_id, use_deliveries_model)
    VALUES (v_company_id, true)
    ON CONFLICT (company_id) DO UPDATE SET use_deliveries_model = true;

END $$;

