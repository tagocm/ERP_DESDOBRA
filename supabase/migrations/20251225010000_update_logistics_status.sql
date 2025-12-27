-- Migration: Update logistics_status enum with new values
-- Created: 2025-12-25
-- Purpose: Add roteirizado, agendado, em_rota, entregue, nao_entregue statuses

-- Step 1: Create new enum type with all values

CREATE TYPE logistics_status_new AS ENUM (
    'pending',
    'roteirizado', 
    'agendado',
    'em_rota',
    'entregue',
    'nao_entregue'
);

-- Step 2: Drop constraints and defaults
ALTER TABLE sales_documents DROP CONSTRAINT IF EXISTS sales_documents_status_logistic_check;
ALTER TABLE sales_documents ALTER COLUMN status_logistic DROP DEFAULT;

-- Step 3: Convert sales_documents.status_logistic via text
ALTER TABLE sales_documents 
    ALTER COLUMN status_logistic TYPE text;

UPDATE sales_documents
SET status_logistic = CASE status_logistic
    WHEN 'pending' THEN 'pending'
    WHEN 'separation' THEN 'roteirizado'
    WHEN 'expedition' THEN 'em_rota'
    WHEN 'delivered' THEN 'entregue'
    ELSE 'pending'
END;

ALTER TABLE sales_documents 
    ALTER COLUMN status_logistic TYPE logistics_status_new 
    USING status_logistic::logistics_status_new;

ALTER TABLE sales_documents 
    ALTER COLUMN status_logistic SET DEFAULT 'pending'::logistics_status_new;

-- Step 4: Handle delivery_routes.logistics_status
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'delivery_routes' 
        AND column_name = 'logistics_status'
    ) THEN
        -- Drop constraints and defaults
        EXECUTE 'ALTER TABLE delivery_routes DROP CONSTRAINT IF EXISTS delivery_routes_logistics_status_check';
        EXECUTE 'ALTER TABLE delivery_routes ALTER COLUMN logistics_status DROP DEFAULT';
        
        -- Convert via text
        EXECUTE 'ALTER TABLE delivery_routes ALTER COLUMN logistics_status TYPE text';
        
        UPDATE delivery_routes
        SET logistics_status = CASE logistics_status
            WHEN 'pending' THEN 'roteirizado'
            WHEN 'separation' THEN 'roteirizado'
            WHEN 'expedition' THEN 'em_rota'
            WHEN 'delivered' THEN 'entregue'
            ELSE 'roteirizado'
        END;
        
        EXECUTE 'ALTER TABLE delivery_routes ALTER COLUMN logistics_status TYPE logistics_status_new USING logistics_status::logistics_status_new';
        EXECUTE 'ALTER TABLE delivery_routes ALTER COLUMN logistics_status SET DEFAULT ''roteirizado''::logistics_status_new';
    ELSE
        -- Column doesn't exist, create it
        ALTER TABLE delivery_routes 
            ADD COLUMN logistics_status logistics_status_new DEFAULT 'roteirizado';
    END IF;
END $$;

-- Step 5: Drop old enum type
DROP TYPE IF EXISTS logistics_status CASCADE;

-- Step 6: Rename new type to standard name
ALTER TYPE logistics_status_new RENAME TO logistics_status;

-- Step 7: Create trigger function for route → orders sync
CREATE OR REPLACE FUNCTION sync_route_status_to_orders()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE sales_documents
    SET 
        status_logistic = NEW.logistics_status,
        updated_at = NOW()
    WHERE id IN (
        SELECT sales_document_id
        FROM delivery_route_orders
        WHERE route_id = NEW.id
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 8: Create trigger on delivery_routes
DROP TRIGGER IF EXISTS route_status_sync_trigger ON delivery_routes;

CREATE TRIGGER route_status_sync_trigger
    AFTER UPDATE OF logistics_status ON delivery_routes
    FOR EACH ROW
    WHEN (OLD.logistics_status IS DISTINCT FROM NEW.logistics_status)
    EXECUTE FUNCTION sync_route_status_to_orders();

-- Step 9: Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_delivery_route_orders_route_id 
    ON delivery_route_orders(route_id);

CREATE INDEX IF NOT EXISTS idx_sales_documents_status_logistic 
    ON sales_documents(status_logistic);

-- Step 10: Add comments
COMMENT ON COLUMN sales_documents.status_logistic IS 
'Status logístico: pending (aguardando), roteirizado (em rota planejada), agendado (rota agendada), em_rota (saiu para entrega), entregue (concluído), nao_entregue (falha na entrega)';

COMMENT ON COLUMN delivery_routes.logistics_status IS 
'Status da rota: roteirizado (planejada), agendado (agendada), em_rota (em andamento), entregue (concluída), nao_entregue (não concluída)';
