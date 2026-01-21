DO $$
DECLARE
    v_company_id UUID;
    v_client_id UUID;
    v_user_id UUID;
    v_order_id UUID;
    v_item_id UUID;
    v_uom_id UUID;
    v_price_table_id UUID;
BEGIN
    -- 1. Get Company and User (assuming seed data exists, or create)
    SELECT id INTO v_company_id FROM companies LIMIT 1;
    SELECT id INTO v_user_id FROM auth.users LIMIT 1;

    -- Ensure company member
    INSERT INTO company_members (company_id, auth_user_id, role)
    VALUES (v_company_id, v_user_id, 'admin')
    ON CONFLICT DO NOTHING;

    -- 2. Create/Get Client
    INSERT INTO organizations (company_id, name, trade_name, document)
    VALUES (v_company_id, 'Cliente Teste Delivery', 'Cliente Teste', '12345678000199')
    ON CONFLICT (company_id, document) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO v_client_id;
    
    -- 3. Create/Get Item UOM
    INSERT INTO uoms (company_id, code, name) 
    VALUES (v_company_id, 'UN', 'Unidade') 
    ON CONFLICT (company_id, code) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO v_uom_id;
    
    -- 4. Create/Get Price Table
    INSERT INTO price_tables (company_id, name)
    VALUES (v_company_id, 'Tabela Padrao')
    ON CONFLICT DO NOTHING;
    SELECT id INTO v_price_table_id FROM price_tables WHERE company_id = v_company_id LIMIT 1;

    -- 5. Create/Get Item
    INSERT INTO items (company_id, code, name, uom_id, type)
    VALUES (v_company_id, 'TEST-DEL-001', 'Produto Teste Delivery', v_uom_id, 'product')
    ON CONFLICT (company_id, code) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO v_item_id;

    -- 6. Create Sales Order
    INSERT INTO sales_documents (
        company_id, client_id, doc_type, status_commercial, status_logistic, date_issued, total_amount, sales_rep_id, price_table_id
    ) VALUES (
        v_company_id, v_client_id, 'order', 'approved', 'pendente', CURRENT_DATE, 100.00, v_user_id, v_price_table_id
    ) RETURNING id INTO v_order_id;

    -- 7. Create Sales Item
    INSERT INTO sales_document_items (
        company_id, document_id, item_id, quantity, unit_price, total_amount
    ) VALUES (
        v_company_id, v_order_id, v_item_id, 10, 10.00, 100.00
    );

    RAISE NOTICE 'Created Order ID: %', v_order_id;
END $$;
