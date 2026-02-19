
-- Seed Data for Development
-- This file runs every time you run 'npm run supabase:reset'

DO $$
DECLARE
    v_company_id UUID;
    v_user_id UUID;
    v_pt_id UUID; -- Price Table ID
    v_item_chapa UUID;
    v_item_bloco UUID;
    v_item_iso UUID;
    v_org_id UUID;
    v_order_id UUID;
    v_emporio_id UUID;
    v_item_granola UUID;
BEGIN

    -- 1. Ensure Company Exists
    SELECT id INTO v_company_id FROM public.companies WHERE slug = 'martigran';
    IF v_company_id IS NULL THEN
        INSERT INTO public.companies (name, slug)
        VALUES ('Martigran', 'martigran')
        RETURNING id INTO v_company_id;
    END IF;

    -- 2. Ensure Admin User Exists
    SELECT id INTO v_user_id FROM public.users WHERE email = 'admin@desdobra.local';
    IF v_user_id IS NULL THEN
        INSERT INTO public.users (company_id, email, full_name, role, is_active)
        VALUES (v_company_id, 'admin@desdobra.local', 'Admin Local', 'admin', true)
        RETURNING id INTO v_user_id;
    END IF;

    -- 2.1 Link auth users to seeded company (local dev convenience after db reset)
    INSERT INTO public.company_members (company_id, auth_user_id, role)
    SELECT v_company_id, au.id, 'admin'
    FROM auth.users au
    WHERE NOT EXISTS (
        SELECT 1
        FROM public.company_members cm
        WHERE cm.company_id = v_company_id
          AND cm.auth_user_id = au.id
    );

    -- 3. Core Tables: UOMs, Items, Price Tables

    -- 3.2 Items (Products)
    -- Product A: Chapa (M2)
    SELECT id INTO v_item_chapa FROM public.items WHERE company_id = v_company_id AND sku = 'GR001';
    IF v_item_chapa IS NULL THEN
        INSERT INTO public.items (company_id, name, sku, uom, type, is_active)
        VALUES (v_company_id, 'Granito Branco Dalas', 'GR001', 'm2', 'finished_good', true)
        RETURNING id INTO v_item_chapa;
    END IF;

    -- Product B: Bloco (M3)
    SELECT id INTO v_item_bloco FROM public.items WHERE company_id = v_company_id AND sku = 'BL002';
    IF v_item_bloco IS NULL THEN
        INSERT INTO public.items (company_id, name, sku, uom, type, is_active)
        VALUES (v_company_id, 'Bloco Granito Preto', 'BL002', 'm3', 'raw_material', true)
        RETURNING id INTO v_item_bloco;
    END IF;
    
    -- Product C: Insumo (UN)
    SELECT id INTO v_item_iso FROM public.items WHERE company_id = v_company_id AND sku = 'INS003';
    IF v_item_iso IS NULL THEN
        INSERT INTO public.items (company_id, name, sku, uom, type, is_active)
        VALUES (v_company_id, 'Resina Epoxi', 'INS003', 'un', 'raw_material', true)
        RETURNING id INTO v_item_iso;
    END IF;

    -- Product D: Granola (E2E Test Requirement)
    SELECT id INTO v_item_granola FROM public.items WHERE company_id = v_company_id AND sku = 'GRA001';
    IF v_item_granola IS NULL THEN
        INSERT INTO public.items (company_id, name, sku, uom, type, is_active)
        VALUES (v_company_id, 'Granola Tradicional', 'GRA001', 'un', 'finished_good', true)
        RETURNING id INTO v_item_granola;
    END IF;

    -- 3.3 Price Tables
    SELECT id INTO v_pt_id FROM public.price_tables WHERE company_id = v_company_id AND name = 'Tabela Padrão 2026';
    IF v_pt_id IS NULL THEN
        INSERT INTO public.price_tables (company_id, name, is_active)
        VALUES (v_company_id, 'Tabela Padrão 2026', true)
        RETURNING id INTO v_pt_id;
    END IF;

    -- Price Table Items
    IF NOT EXISTS (SELECT 1 FROM public.price_table_items WHERE price_table_id = v_pt_id AND item_id = v_item_chapa) THEN
        INSERT INTO public.price_table_items (price_table_id, item_id, price) VALUES (v_pt_id, v_item_chapa, 150.00);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.price_table_items WHERE price_table_id = v_pt_id AND item_id = v_item_bloco) THEN
        INSERT INTO public.price_table_items (price_table_id, item_id, price) VALUES (v_pt_id, v_item_bloco, 3500.00);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.price_table_items WHERE price_table_id = v_pt_id AND item_id = v_item_iso) THEN
        INSERT INTO public.price_table_items (price_table_id, item_id, price) VALUES (v_pt_id, v_item_iso, 45.50);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.price_table_items WHERE price_table_id = v_pt_id AND item_id = v_item_granola) THEN
        INSERT INTO public.price_table_items (price_table_id, item_id, price) VALUES (v_pt_id, v_item_granola, 10.00);
    END IF;

    -- 4. Clients / Organizations
    SELECT id INTO v_org_id FROM public.organizations WHERE company_id = v_company_id AND document_number = '12345678000199';
    IF v_org_id IS NULL THEN
        INSERT INTO public.organizations (company_id, trade_name, legal_name, document_number, status)
        VALUES (v_company_id, 'Construtora Exemplo', 'Construtora Exemplo S/A', '12345678000199', 'active')
        RETURNING id INTO v_org_id;
    END IF;

    -- Roles for Construtora Exemplo
    IF NOT EXISTS (SELECT 1 FROM public.organization_roles WHERE company_id = v_company_id AND organization_id = v_org_id AND role = 'customer') THEN
        INSERT INTO public.organization_roles (company_id, organization_id, role)
        VALUES (v_company_id, v_org_id, 'customer');
    END IF;

    -- Address
    IF NOT EXISTS (SELECT 1 FROM public.addresses WHERE organization_id = v_org_id AND type = 'shipping') THEN
        INSERT INTO public.addresses (company_id, organization_id, street, number, neighborhood, city, state, zip, type)
        VALUES (v_company_id, v_org_id, 'Av. das Nações', '1000', 'Centro', 'São Paulo', 'SP', '01000-000', 'shipping');
    END IF;

    -- Contact
    IF NOT EXISTS (SELECT 1 FROM public.people WHERE organization_id = v_org_id AND email = 'eng@obra.com') THEN
        INSERT INTO public.people (company_id, organization_id, full_name, email, is_primary)
        VALUES (v_company_id, v_org_id, 'Engenheiro Chefe', 'eng@obra.com', true);
    END IF;

    -- 4.2 Emporio Do Arroz Integral (E2E Test Requirement)
    SELECT id INTO v_emporio_id FROM public.organizations WHERE company_id = v_company_id AND document_number = '98765432000188';
    IF v_emporio_id IS NULL THEN
        INSERT INTO public.organizations (company_id, trade_name, legal_name, document_number, status)
        VALUES (v_company_id, 'Emporio Do Arroz Integral', 'Emporio Do Arroz Integral LTDA', '98765432000188', 'active')
        RETURNING id INTO v_emporio_id;
    END IF;

    -- 5. Sales Order (Confirmable)
    SELECT id INTO v_order_id FROM public.sales_documents WHERE company_id = v_company_id AND document_number = 100100;
    
    IF v_order_id IS NULL THEN
        INSERT INTO public.sales_documents (
            company_id, 
            client_id, 
            document_number, 
            doc_type, 
            status_logistic, 
            status_commercial, 
            date_issued
        )
        VALUES (
            v_company_id, 
            v_org_id, 
            100100,
            'order', 
            'pending',
            'approved', 
            CURRENT_DATE
        )
        RETURNING id INTO v_order_id;
    END IF;

    -- Order Items
    IF NOT EXISTS (SELECT 1 FROM public.sales_document_items WHERE document_id = v_order_id) THEN
        INSERT INTO public.sales_document_items (company_id, document_id, item_id, quantity, unit_price, total_weight_kg)
        VALUES 
            (v_company_id, v_order_id, v_item_chapa, 10, 150.00, 500.0);
    END IF;

    -- 6. Setup Settings (Deliveries Model ON)
    IF EXISTS (SELECT 1 FROM public.company_settings WHERE company_id = v_company_id) THEN
        UPDATE public.company_settings SET use_deliveries_model = true WHERE company_id = v_company_id;
    ELSE
        INSERT INTO public.company_settings (company_id, use_deliveries_model)
        VALUES (v_company_id, true);
    END IF;

END $$;
