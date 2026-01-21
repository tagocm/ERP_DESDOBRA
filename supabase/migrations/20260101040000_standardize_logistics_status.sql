-- Migration: Standardize Logistics Status (PT-BR) - FIXED V2
-- Description: Updates logistics_status enum to canonical PT-BR values and migrates data.
-- Fix: Drops triggers before altering column type to avoid dependency errors. (Now drops trg_sales_order_logistic_change_stock too)

BEGIN;

-- 1. Drop Triggers that depend on status_logistic
DROP TRIGGER IF EXISTS on_sales_logistic_update_ar ON sales_documents;
DROP TRIGGER IF EXISTS on_financial_status_audit ON sales_documents;
DROP TRIGGER IF EXISTS trg_sales_order_logistic_change_stock ON sales_documents;
DROP TRIGGER IF EXISTS route_status_sync_trigger ON delivery_routes; -- Just in case

-- 2. Create New Enum
CREATE TYPE logistics_status_new AS ENUM (
    'pendente',
    'roteirizado', 
    'agendado',
    'em_rota',
    'entregue',
    'devolvido'
);

-- 3. Drop Defaults & Constraints (Sales Documents)
ALTER TABLE sales_documents ALTER COLUMN status_logistic DROP DEFAULT;
ALTER TABLE sales_documents DROP CONSTRAINT IF EXISTS sales_documents_status_logistic_check;

-- 4. Convert to Text & Update Values
ALTER TABLE sales_documents ALTER COLUMN status_logistic TYPE text;

DO $$ BEGIN
    EXECUTE 'UPDATE sales_documents
    SET status_logistic = CASE status_logistic
        WHEN ''pending'' THEN ''pendente''
        WHEN ''separation'' THEN ''roteirizado''
        WHEN ''nao_entregue'' THEN ''devolvido''
        WHEN ''delivered'' THEN ''entregue'' 
        WHEN ''expedition'' THEN ''em_rota''
        ELSE status_logistic 
    END';
END $$;

-- 5. Cast to New Enum
ALTER TABLE sales_documents 
    ALTER COLUMN status_logistic TYPE logistics_status_new 
    USING status_logistic::logistics_status_new;

ALTER TABLE sales_documents 
    ALTER COLUMN status_logistic SET DEFAULT 'pendente'::logistics_status_new;

-- 6. Handle Delivery Routes
ALTER TABLE delivery_routes ALTER COLUMN logistics_status DROP DEFAULT;
DO $$ BEGIN
    EXECUTE 'ALTER TABLE delivery_routes DROP CONSTRAINT IF EXISTS delivery_routes_logistics_status_check';
EXCEPTION WHEN OTHERS THEN NULL; END $$;

ALTER TABLE delivery_routes ALTER COLUMN logistics_status TYPE text;

DO $$ BEGIN
    EXECUTE 'UPDATE delivery_routes
    SET logistics_status = CASE logistics_status
        WHEN ''pending'' THEN ''roteirizado''
        WHEN ''nao_entregue'' THEN ''devolvido''
        ELSE logistics_status
    END';
END $$;

ALTER TABLE delivery_routes 
    ALTER COLUMN logistics_status TYPE logistics_status_new 
    USING logistics_status::logistics_status_new;

ALTER TABLE delivery_routes 
    ALTER COLUMN logistics_status SET DEFAULT 'roteirizado'::logistics_status_new;


-- 7. Cleanup Old Enum
DROP TYPE IF EXISTS logistics_status CASCADE;
ALTER TYPE logistics_status_new RENAME TO logistics_status;

-- 8. Redefine Functions & Re-create Triggers

-- A) Financial Audit Trigger Function
CREATE OR REPLACE FUNCTION public.audit_financial_status_changes()
RETURNS TRIGGER AS $$
DECLARE
    v_reason TEXT := 'Alteração manual';
    v_user_id UUID := auth.uid();
BEGIN
    IF NEW.financial_status IS DISTINCT FROM OLD.financial_status THEN
        IF (NEW.status_logistic IS DISTINCT FROM OLD.status_logistic) THEN
            IF NEW.status_logistic::text = 'em_rota' AND NEW.financial_status = 'pre_lancado' THEN
                v_reason := 'Entrou em rota';
            ELSIF NEW.status_logistic::text IN ('devolvido', 'pendente') AND NEW.financial_status = 'em_revisao' THEN
                IF NEW.status_logistic::text = 'devolvido' THEN
                     v_reason := 'Ocorrência logística: devolvido';
                ELSE
                     v_reason := 'Ocorrência logística: devolvido/pendente';
                END IF;
            END IF;
        END IF;

        IF NEW.financial_status = 'aprovado' THEN v_reason := 'Aprovado pelo financeiro'; END IF;
        IF NEW.financial_status = 'cancelado' THEN v_reason := 'Pedido Cancelado'; END IF;

        INSERT INTO public.sales_document_finance_events (
            company_id, sales_document_id, from_status, to_status, reason, changed_by
        ) VALUES (
            NEW.company_id, NEW.id, COALESCE(OLD.financial_status, 'unknown'), NEW.financial_status, v_reason, v_user_id
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_financial_status_audit
    AFTER UPDATE OF financial_status ON public.sales_documents
    FOR EACH ROW
    EXECUTE FUNCTION public.audit_financial_status_changes();


-- B) Automation Trigger Function (Financial Transition)
CREATE OR REPLACE FUNCTION public.handle_sales_order_logistic_change_ar()
RETURNS TRIGGER AS $$
DECLARE
    v_terms RECORD;
    v_installments_count INT := 1;
    v_first_due_days INT := 0;
    v_cadence_days INT := 30;
    v_total NUMERIC;
    v_installment_value NUMERIC;
    v_remainder NUMERIC;
    v_current_due_date DATE;
    v_title_id UUID;
    v_terms_name TEXT := 'À Vista';
BEGIN
    -- 1. Entering Route: Pendente -> Pre-lancado
    IF NEW.status_logistic::text = 'em_rota' AND (OLD.status_logistic IS DISTINCT FROM 'em_rota') THEN
        IF OLD.financial_status = 'pendente' THEN
             UPDATE sales_documents SET financial_status = 'pre_lancado' WHERE id = NEW.id;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM ar_titles WHERE sales_document_id = NEW.id) THEN
            IF NEW.payment_terms_id IS NOT NULL THEN
                SELECT * INTO v_terms FROM payment_terms WHERE id = NEW.payment_terms_id;
                IF FOUND THEN
                    v_installments_count := COALESCE(v_terms.installments_count, 1);
                    v_first_due_days := COALESCE(v_terms.first_due_days, 0);
                    v_cadence_days := COALESCE(v_terms.cadence_days, 30);
                    v_terms_name := v_terms.name;
                END IF;
            END IF;
            v_total := COALESCE(NEW.total_amount, 0);

            INSERT INTO ar_titles (
                company_id, sales_document_id, customer_id, document_number, status, 
                amount_total, amount_open, payment_terms_snapshot, date_issued
            ) VALUES (
                NEW.company_id, NEW.id, NEW.client_id, NEW.document_number, 'PENDING_APPROVAL',
                v_total, v_total, v_terms_name, CURRENT_DATE
            ) RETURNING id INTO v_title_id;

            IF v_title_id IS NOT NULL THEN
                v_installment_value := TRUNC(v_total / v_installments_count, 2);
                v_remainder := v_total - (v_installment_value * v_installments_count);
                v_current_due_date := CURRENT_DATE + v_first_due_days;

                FOR i IN 1..v_installments_count LOOP
                    DECLARE v_final_amt NUMERIC;
                    BEGIN
                        v_final_amt := CASE WHEN i = v_installments_count THEN v_installment_value + v_remainder ELSE v_installment_value END;
                        INSERT INTO ar_installments (
                            company_id, ar_title_id, installment_number, due_date, amount_original, amount_open, status
                        ) VALUES (
                            NEW.company_id, v_title_id, i, v_current_due_date, v_final_amt, v_final_amt, 'OPEN'
                        );
                        if v_cadence_days > 0 then v_current_due_date := v_current_due_date + v_cadence_days; end if;
                    END;
                END LOOP;
            END IF;
        END IF;
    END IF;

    -- 2. Return Logic
    IF OLD.status_logistic::text = 'em_rota' AND NEW.status_logistic::text IN ('pendente', 'devolvido') THEN
        IF OLD.financial_status = 'aprovado' THEN
             UPDATE sales_documents SET financial_status = 'em_revisao' WHERE id = NEW.id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_sales_logistic_update_ar
    AFTER UPDATE OF status_logistic ON sales_documents
    FOR EACH ROW
    WHEN (OLD.status_logistic IS DISTINCT FROM NEW.status_logistic)
    EXECUTE FUNCTION handle_sales_order_logistic_change_ar();


-- C) Stock Deduction Trigger Function (Recreated)
CREATE OR REPLACE FUNCTION public.handle_sales_order_logistic_change_stock()
RETURNS TRIGGER AS $$
DECLARE
    r_item RECORD;
    v_qty NUMERIC;
    v_source_ref TEXT;
BEGIN
    if NEW.status_logistic::text = 'em_rota' THEN
        
        -- Check if already deduced
        IF EXISTS (
            SELECT 1 FROM public.inventory_movements 
            WHERE reference_type = 'pedido' AND reference_id = NEW.id AND movement_type = 'SAIDA'
        ) THEN
            RETURN NEW;
        END IF;

        v_source_ref := concat('#', NEW.document_number);

        FOR r_item IN SELECT * FROM public.sales_document_items WHERE document_id = NEW.id
        LOOP
            v_qty := COALESCE(r_item.qty_base, r_item.quantity);
            INSERT INTO public.inventory_movements (
                company_id, item_id, movement_type, qty_base, reference_type, reference_id,
                source_ref, notes, created_at, updated_at, reason, qty_in, qty_out
            ) VALUES (
                NEW.company_id, r_item.item_id, 'SAIDA', v_qty, 'pedido', NEW.id,
                v_source_ref, 'Baixa automática ao entrar em rota', NOW(), NOW(), 'sale_out', 0, v_qty
            );
        END LOOP;

    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_sales_order_logistic_change_stock
    AFTER UPDATE OF status_logistic ON public.sales_documents
    FOR EACH ROW
    WHEN (OLD.status_logistic IS DISTINCT FROM NEW.status_logistic)
    EXECUTE FUNCTION public.handle_sales_order_logistic_change_stock();

-- Recreate Route Sync Trigger (if needed, it was likely dropped if it depended on column)
-- Checking if sync_route_status_to_orders depends on definition of logistics_status? 
-- The function uses NEW.logistics_status which is now of type logistics_status_new (renamed). It should work fine, but trigger on routes table needs checked.
-- Route sync trigger is on delivery_routes.logistics_status update.
-- We updated delivery_routes column type too. So we should be safe there if trigger wasn't dropped manually.
-- But step 1 dropped 'route_status_sync_trigger'.
-- So I must recreate it.

CREATE OR REPLACE FUNCTION sync_route_status_to_orders()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE sales_documents
    SET 
        status_logistic = NEW.logistics_status, -- This works because enum types match
        updated_at = NOW()
    WHERE id IN (
        SELECT sales_document_id
        FROM delivery_route_orders
        WHERE route_id = NEW.id
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER route_status_sync_trigger
    AFTER UPDATE OF logistics_status ON delivery_routes
    FOR EACH ROW
    WHEN (OLD.logistics_status IS DISTINCT FROM NEW.logistics_status)
    EXECUTE FUNCTION sync_route_status_to_orders();

COMMIT;
