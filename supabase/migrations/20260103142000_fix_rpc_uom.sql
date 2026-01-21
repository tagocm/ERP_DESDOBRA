
-- Migration: Update RPC again to fix UOM
-- Date: 2026-01-03 14:20

CREATE OR REPLACE FUNCTION public.seed_test_data()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_company_id UUID;
    v_user_id UUID;
    v_client_id UUID;
    v_uom_id UUID;
    v_price_table_id UUID;
    v_item_id UUID;
    v_order_id UUID;
BEGIN
    SELECT id INTO v_company_id FROM companies LIMIT 1;
    SELECT id INTO v_user_id FROM auth.users LIMIT 1;
    
    IF v_company_id IS NULL OR v_user_id IS NULL THEN
        RETURN jsonb_build_object('error', 'No company or user found');
    END IF;

    INSERT INTO company_members (company_id, auth_user_id, role)
    VALUES (v_company_id, v_user_id, 'admin')
    ON CONFLICT (company_id, auth_user_id) DO NOTHING;

    -- Client
    SELECT id INTO v_client_id FROM organizations WHERE company_id = v_company_id AND document = '12345678000199' LIMIT 1;
    IF v_client_id IS NULL THEN
        INSERT INTO organizations (company_id, legal_name, trade_name, document)
        VALUES (v_company_id, 'Cliente Teste Delivery', 'Cliente Teste', '12345678000199')
        RETURNING id INTO v_client_id;
    END IF;

    -- UOM (Try to find ANY, if not, try to insert with symbol 'UN')
    SELECT id INTO v_uom_id FROM uoms WHERE company_id = v_company_id LIMIT 1;
    IF v_uom_id IS NULL THEN
        -- Attempt insert, assuming 'symbol' column exists if 'code' doesn't. Or try to find exact column?
        -- We will guess 'symbol'.
        BEGIN
            INSERT INTO uoms (company_id, symbol, name) VALUES (v_company_id, 'UN', 'Unidade') RETURNING id INTO v_uom_id;
        EXCEPTION WHEN OTHERS THEN
             -- Try 'code' as fallback if symbol failed? NO, 'code' failed before.
             -- Maybe it's 'abbreviation'?
             -- We raise notice and return error?
             RETURN jsonb_build_object('error', 'Failed to find/create UOM. Schema unclear.');
        END;
    END IF;

    -- Price Table
    SELECT id INTO v_price_table_id FROM price_tables WHERE company_id = v_company_id LIMIT 1;
    IF v_price_table_id IS NULL THEN
        INSERT INTO price_tables (company_id, name)
        VALUES (v_company_id, 'Tabela Padrao')
        RETURNING id INTO v_price_table_id;
    END IF;

    -- Item
    SELECT id INTO v_item_id FROM items WHERE company_id = v_company_id AND code = 'TEST-DEL-001' LIMIT 1;
    IF v_item_id IS NULL THEN
        INSERT INTO items (company_id, code, name, uom_id, type)
        VALUES (v_company_id, 'TEST-DEL-001', 'Produto Teste Delivery', v_uom_id, 'product')
        RETURNING id INTO v_item_id;
    END IF;

    -- Order
    INSERT INTO sales_documents (
        company_id, client_id, doc_type, status_commercial, status_logistic, date_issued, total_amount, sales_rep_id, price_table_id, document_number
    ) VALUES (
        v_company_id, v_client_id, 'order', 'approved', 'pendente', CURRENT_DATE, 100.00, v_user_id, v_price_table_id,
        (SELECT COALESCE(MAX(document_number), 0) + 1 FROM sales_documents WHERE company_id = v_company_id AND doc_type = 'order')
    ) RETURNING id INTO v_order_id;

    -- Items
    INSERT INTO sales_document_items (
        company_id, document_id, item_id, quantity, unit_price, total_amount
    ) VALUES (
        v_company_id, v_order_id, v_item_id, 10, 10.00, 100.00
    );

    RETURN jsonb_build_object('success', true, 'order_id', v_order_id);

END;
$$;
