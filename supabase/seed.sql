
-- Seed Data for Development
-- This file runs every time you run 'npm run supabase:reset'

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


-- 3. Seed Customers (Organizations)
WITH company_data AS (
    SELECT id FROM public.companies WHERE slug = 'martigran' LIMIT 1
),
inserted_orgs AS (
    INSERT INTO public.organizations (company_id, trade_name, legal_name, document, status)
    SELECT 
        id, 
        'Mercado Exemplo 01', 
        'Mercado Exemplo LTDA', 
        '12345678000199', 
        'active'
    FROM company_data
    WHERE NOT EXISTS (SELECT 1 FROM public.organizations WHERE document = '12345678000199')
    RETURNING id, company_id
)
INSERT INTO public.organization_tags (company_id, name)
SELECT id, 'Varejo' FROM company_data
ON CONFLICT (company_id, name) DO NOTHING;

-- Add contacts and addresses for the first organization (if inserted)
-- Note: In a real seed you might want more complex logic, but for simple dev environments, 
-- we can keep it simple or use hardcoded UUIDs if we wanted deterministic relationships.
-- For now, let's just insert generic data if organizations table is empty.

DO $$
DECLARE
    v_company_id UUID;
    v_org_id UUID;
    v_tag_id UUID;
BEGIN
    SELECT id INTO v_company_id FROM public.companies WHERE slug = 'martigran';

    -- Create Organization 1
    INSERT INTO public.organizations (company_id, trade_name, document)
    VALUES (v_company_id, 'Cliente A - Padaria', '11111111000111')
    ON CONFLICT (company_id, document) DO UPDATE SET trade_name = EXCLUDED.trade_name
    RETURNING id INTO v_org_id;

    -- Contact for Org 1
    INSERT INTO public.people (company_id, organization_id, full_name, email, is_primary)
    VALUES (v_company_id, v_org_id, 'João Padeiro', 'joao@padaria.com', true);

    -- Address for Org 1
    INSERT INTO public.addresses (company_id, organization_id, street, number, city, state, type)
    VALUES (v_company_id, v_org_id, 'Rua do Pão', '100', 'São Paulo', 'SP', 'shipping');

    -- Create Organization 2
    INSERT INTO public.organizations (company_id, trade_name, document)
    VALUES (v_company_id, 'Cliente B - Supermercado', '22222222000122')
    ON CONFLICT (company_id, document) DO UPDATE SET trade_name = EXCLUDED.trade_name
    RETURNING id INTO v_org_id;

    -- Contact for Org 2
    INSERT INTO public.people (company_id, organization_id, full_name, email, is_primary)
    VALUES (v_company_id, v_org_id, 'Maria Gerente', 'maria@super.com', true);
    
     -- Tags
    INSERT INTO public.organization_tags (company_id, name) VALUES (v_company_id, 'Atacado') 
    ON CONFLICT (company_id, name) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO v_tag_id;
    
    -- Link Tag to Org 2
    INSERT INTO public.organization_tag_links (company_id, organization_id, tag_id)
    VALUES (v_company_id, v_org_id, v_tag_id)
    ON CONFLICT DO NOTHING;

END $$;
