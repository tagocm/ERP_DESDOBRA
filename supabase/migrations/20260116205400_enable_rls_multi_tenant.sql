-- ========================================================================
-- RLS Multi-Tenant Security Migration
-- ========================================================================
-- Purpose: Fix Supabase linter warnings and enforce company_id isolation
-- Strategy: Staged approach (5 phases) from low to high risk
-- Test: Each stage independently before proceeding to next
-- Rollback: ALTER TABLE <table> DISABLE ROW LEVEL SECURITY;
-- ========================================================================

-- ========================================================================
-- STAGE 1: Reference Data (Zero Risk)
-- ========================================================================
-- Tables: cfops (if has policies but no code access)
-- Strategy: Enable RLS + grant global SELECT (read-only reference data)

-- Note: cfops had no code access found in audit, but if policies exist:
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'cfops'
  ) THEN
    -- Enable RLS
    ALTER TABLE cfops ENABLE ROW LEVEL SECURITY;
    
    -- Grant global SELECT to authenticated users
    GRANT SELECT ON cfops TO authenticated;
    
    -- Clean up any existing restrictive policies if needed
    DROP POLICY IF EXISTS "Enable read access for all users" ON cfops;
    
    -- Create policy for universal read access
    CREATE POLICY "cfops_global_read"
    ON cfops
    FOR SELECT
    TO authenticated
    USING (true);
    
    RAISE NOTICE 'Stage 1: CFOPS RLS enabled (global read-only)';
  ELSE
    RAISE NOTICE 'Stage 1: CFOPS has no policies, skipping';
  END IF;
END $$;

-- ========================================================================
-- STAGE 2: Company Settings (Low Risk)
-- ========================================================================
-- Tables: company_settings
-- Strategy: company_id matching via company_members

ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can access own company settings" ON company_settings;
DROP POLICY IF EXISTS "company_settings_access" ON company_settings;

-- Create multi-tenant policy
CREATE POLICY "company_settings_multi_tenant"
ON company_settings
FOR ALL
TO authenticated
USING (
  company_id IN (
    SELECT company_id 
    FROM company_members 
    WHERE auth_user_id = auth.uid()
  )
)
WITH CHECK (
  company_id IN (
    SELECT company_id 
    FROM company_members 
    WHERE auth_user_id = auth.uid()
  )
);

-- Note: Service role (admin client) bypasses RLS automatically
COMMENT ON POLICY "company_settings_multi_tenant" ON company_settings IS 
'Multi-tenant: users can only access their company settings. Service role bypasses.';

-- ========================================================================
-- STAGE 3: Products & Pricing (Medium Risk)
-- ========================================================================
-- Tables: items, price_tables, price_table_items

-- 3.1 Items (products)
ALTER TABLE items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "items_company_access" ON items;

CREATE POLICY "items_multi_tenant"
ON items
FOR ALL
TO authenticated
USING (
  company_id IN (
    SELECT company_id 
    FROM company_members 
    WHERE auth_user_id = auth.uid()
  )
)
WITH CHECK (
  company_id IN (
    SELECT company_id 
    FROM company_members 
    WHERE auth_user_id = auth.uid()
  )
);

COMMENT ON POLICY "items_multi_tenant" ON items IS 
'Multi-tenant: users can only access products from their company';

-- 3.2 Price Tables
ALTER TABLE price_tables ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "price_tables_company_access" ON price_tables;

CREATE POLICY "price_tables_multi_tenant"
ON price_tables
FOR ALL
TO authenticated
USING (
  company_id IN (
    SELECT company_id 
    FROM company_members 
    WHERE auth_user_id = auth.uid()
  )
)
WITH CHECK (
  company_id IN (
    SELECT company_id 
    FROM company_members 
    WHERE auth_user_id = auth.uid()
  )
);

-- 3.3 Price Table Items (join via price_tables)
ALTER TABLE price_table_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "price_table_items_company_access" ON price_table_items;

CREATE POLICY "price_table_items_multi_tenant"
ON price_table_items
FOR ALL
TO authenticated
USING (
  price_table_id IN (
    SELECT id FROM price_tables 
    WHERE company_id IN (
      SELECT company_id 
      FROM company_members 
      WHERE auth_user_id = auth.uid()
    )
  )
)
WITH CHECK (
  price_table_id IN (
    SELECT id FROM price_tables 
    WHERE company_id IN (
      SELECT company_id 
      FROM company_members 
      WHERE auth_user_id = auth.uid()
    )
  )
);

-- ========================================================================
-- STAGE 4: Sales Documents (HIGH RISK - CRITICAL)
-- ========================================================================
-- Tables: sales_documents, sales_document_items
-- CRITICAL: Core business logic - test thoroughly

-- 4.1 Sales Documents
ALTER TABLE sales_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sales_documents_company_access" ON sales_documents;

CREATE POLICY "sales_documents_multi_tenant"
ON sales_documents
FOR ALL
TO authenticated
USING (
  company_id IN (
    SELECT company_id 
    FROM company_members 
    WHERE auth_user_id = auth.uid()
  )
)
WITH CHECK (
  company_id IN (
    SELECT company_id 
    FROM company_members 
    WHERE auth_user_id = auth.uid()
  )
);

COMMENT ON POLICY "sales_documents_multi_tenant" ON sales_documents IS 
'CRITICAL: Multi-tenant isolation for orders. Users can only see their company orders.';

-- 4.2 Sales Document Items (join via sales_documents)
ALTER TABLE sales_document_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sales_document_items_company_access" ON sales_document_items;

CREATE POLICY "sales_document_items_multi_tenant"
ON sales_document_items
FOR ALL
TO authenticated
USING (
  document_id IN (
    SELECT id FROM sales_documents 
    WHERE company_id IN (
      SELECT company_id 
      FROM company_members 
      WHERE auth_user_id = auth.uid()
    )
  )
)
WITH CHECK (
  document_id IN (
    SELECT id FROM sales_documents 
    WHERE company_id IN (
      SELECT company_id 
      FROM company_members 
      WHERE auth_user_id = auth.uid()
    )
  )
);

-- ========================================================================
-- STAGE 5: Logistics & Delivery (HIGH RISK)
-- ========================================================================
-- Tables: delivery_routes, delivery_route_orders

-- 5.1 Delivery Routes
ALTER TABLE delivery_routes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "delivery_routes_company_access" ON delivery_routes;

-- Check if delivery_routes has company_id column
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'delivery_routes' AND column_name = 'company_id'
  ) THEN
    -- Direct company_id policy
    CREATE POLICY "delivery_routes_multi_tenant"
    ON delivery_routes
    FOR ALL
    TO authenticated
    USING (
      company_id IN (
        SELECT company_id 
        FROM company_members 
        WHERE auth_user_id = auth.uid()
      )
    )
    WITH CHECK (
      company_id IN (
        SELECT company_id 
        FROM company_members 
        WHERE auth_user_id = auth.uid()
      )
    );
    
    RAISE NOTICE 'Stage 5: delivery_routes RLS enabled (direct company_id)';
  ELSE
    -- Via sales_documents (if no direct company_id)
    CREATE POLICY "delivery_routes_multi_tenant"
    ON delivery_routes
    FOR ALL
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM delivery_route_orders dro
        JOIN sales_documents sd ON dro.document_id = sd.id
        WHERE dro.route_id = delivery_routes.id
        AND sd.company_id IN (
          SELECT company_id 
          FROM company_members 
          WHERE auth_user_id = auth.uid()
        )
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM delivery_route_orders dro
        JOIN sales_documents sd ON dro.document_id = sd.id
        WHERE dro.route_id = delivery_routes.id
        AND sd.company_id IN (
          SELECT company_id 
          FROM company_members 
          WHERE auth_user_id = auth.uid()
        )
      )
    );
    
    RAISE NOTICE 'Stage 5: delivery_routes RLS enabled (via sales_documents join)';
  END IF;
END $$;

-- 5.2 Delivery Route Orders
ALTER TABLE delivery_route_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "delivery_route_orders_company_access" ON delivery_route_orders;

CREATE POLICY "delivery_route_orders_multi_tenant"
ON delivery_route_orders
FOR ALL
TO authenticated
USING (
  sales_document_id IN (
    SELECT id FROM sales_documents 
    WHERE company_id IN (
      SELECT company_id 
      FROM company_members 
      WHERE auth_user_id = auth.uid()
    )
  )
)
WITH CHECK (
  sales_document_id IN (
    SELECT id FROM sales_documents 
    WHERE company_id IN (
      SELECT company_id 
      FROM company_members 
      WHERE auth_user_id = auth.uid()
    )
  )
);

-- ========================================================================
-- VERIFICATION QUERIES (Run after each stage)
-- ========================================================================

-- Check RLS status
DO $$
DECLARE
  rec RECORD;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'RLS STATUS VERIFICATION';
  RAISE NOTICE '========================================';
  
  FOR rec IN 
    SELECT 
      schemaname,
      tablename,
      rowsecurity
    FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename IN (
      'company_settings',
      'items',
      'price_tables',
      'price_table_items',
      'sales_documents',
      'sales_document_items',
      'delivery_routes',
      'delivery_route_orders',
      'cfops'
    )
    ORDER BY tablename
  LOOP
    IF rec.rowsecurity THEN
      RAISE NOTICE '✓ % - RLS ENABLED', rec.tablename;
    ELSE
      RAISE NOTICE '✗ % - RLS DISABLED', rec.tablename;
    END IF;
  END LOOP;
END $$;

-- Count policies
DO $$
DECLARE
  rec RECORD;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'POLICY COUNT BY TABLE';
  RAISE NOTICE '========================================';
  
  FOR rec IN 
    SELECT 
      tablename,
      COUNT(*) as policy_count
    FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename IN (
      'company_settings',
      'items',
      'price_tables',
      'price_table_items',
      'sales_documents',
      'sales_document_items',
      'delivery_routes',
      'delivery_route_orders',
      'cfops'
    )
    GROUP BY tablename
    ORDER BY tablename
  LOOP
    RAISE NOTICE '% - % policies', rec.tablename, rec.policy_count;
  END LOOP;
END $$;

-- ========================================================================
-- ROLLBACK COMMANDS (if needed)
-- ========================================================================
-- To rollback a specific stage:
--
-- Stage 1: ALTER TABLE cfops DISABLE ROW LEVEL SECURITY;
-- Stage 2: ALTER TABLE company_settings DISABLE ROW LEVEL SECURITY;
-- Stage 3:
--   ALTER TABLE items DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE price_tables DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE price_table_items DISABLE ROW LEVEL SECURITY;
-- Stage 4:
--   ALTER TABLE sales_documents DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE sales_document_items DISABLE ROW LEVEL SECURITY;
-- Stage 5:
--   ALTER TABLE delivery_routes DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE delivery_route_orders DISABLE ROW LEVEL SECURITY;
-- ========================================================================
