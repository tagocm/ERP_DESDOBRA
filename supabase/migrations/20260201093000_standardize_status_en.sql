-- Standardize status enums/values to EN (logistics + financial + routes + loading)
-- NOTE: Review carefully before applying in production.

BEGIN;

-- 0) Drop triggers that depend on status_logistic before altering type
DROP TRIGGER IF EXISTS on_sales_logistic_update_ar ON public.sales_documents;
DROP TRIGGER IF EXISTS trg_sales_order_logistic_change_stock ON public.sales_documents;
DROP TRIGGER IF EXISTS on_financial_status_audit ON public.sales_documents;

-- 0.1) Drop indexes that depend on status_logistic/financial_status
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT schemaname, indexname
        FROM pg_indexes
        WHERE tablename = 'sales_documents'
          AND (indexdef ILIKE '%status_logistic%' OR indexdef ILIKE '%financial_status%')
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I.%I', r.schemaname, r.indexname);
    END LOOP;
END $$;

-- 0.2) Drop constraints that reference status_logistic/financial_status
DO $$
DECLARE
    c RECORD;
BEGIN
    FOR c IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'public.sales_documents'::regclass
          AND pg_get_constraintdef(oid) ILIKE '%status_logistic%'
    LOOP
        EXECUTE format('ALTER TABLE public.sales_documents DROP CONSTRAINT IF EXISTS %I', c.conname);
    END LOOP;

    FOR c IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'public.sales_documents'::regclass
          AND pg_get_constraintdef(oid) ILIKE '%financial_status%'
    LOOP
        EXECUTE format('ALTER TABLE public.sales_documents DROP CONSTRAINT IF EXISTS %I', c.conname);
    END LOOP;
END $$;

-- 1) Create EN enums for sales logistics + financial
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sales_logistic_status_en') THEN
        CREATE TYPE public.sales_logistic_status_en AS ENUM (
            'pending', 'routed', 'scheduled', 'expedition', 'in_route',
            'delivered', 'not_delivered', 'returned', 'partial', 'cancelled', 'sandbox'
        );
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'financial_status_en') THEN
        CREATE TYPE public.financial_status_en AS ENUM (
            'pending', 'pre_posted', 'approved', 'in_review', 'cancelled',
            'paid', 'overdue', 'partial'
        );
    END IF;
END $$;

-- 2) Migrate sales_documents.status_logistic to EN enum
ALTER TABLE public.sales_documents
    ALTER COLUMN status_logistic DROP DEFAULT;

ALTER TABLE public.sales_documents
    DROP CONSTRAINT IF EXISTS sales_documents_status_logistic_check;

ALTER TABLE public.sales_documents
    ALTER COLUMN status_logistic TYPE text
    USING status_logistic::text;

ALTER TABLE public.sales_documents
    ALTER COLUMN status_logistic TYPE public.sales_logistic_status_en
    USING (
        CASE (status_logistic::text)
            WHEN 'pending' THEN 'pending'
            WHEN 'roteirizado' THEN 'routed'
            WHEN 'agendado' THEN 'scheduled'
            WHEN 'expedition' THEN 'expedition'
            WHEN 'em_rota' THEN 'in_route'
            WHEN 'entregue' THEN 'delivered'
            WHEN 'nao_entregue' THEN 'not_delivered'
            WHEN 'devolvido' THEN 'returned'
            WHEN 'parcial' THEN 'partial'
            WHEN 'cancelado' THEN 'cancelled'
            WHEN 'sandbox' THEN 'sandbox'
            WHEN 'pending' THEN 'pending'
            WHEN 'routed' THEN 'routed'
            WHEN 'scheduled' THEN 'scheduled'
            WHEN 'in_route' THEN 'in_route'
            WHEN 'delivered' THEN 'delivered'
            WHEN 'not_delivered' THEN 'not_delivered'
            WHEN 'returned' THEN 'returned'
            WHEN 'partial' THEN 'partial'
            WHEN 'cancelled' THEN 'cancelled'
            ELSE 'pending'
        END
    )::public.sales_logistic_status_en;

ALTER TABLE public.sales_documents
    ALTER COLUMN status_logistic SET DEFAULT 'pending';

-- 3) Migrate sales_documents.financial_status to EN enum
ALTER TABLE public.sales_documents
    ALTER COLUMN financial_status DROP DEFAULT;

ALTER TABLE public.sales_documents
    DROP CONSTRAINT IF EXISTS sales_documents_financial_status_check;

ALTER TABLE public.sales_documents
    ALTER COLUMN financial_status TYPE text
    USING financial_status::text;

ALTER TABLE public.sales_documents
    ALTER COLUMN financial_status TYPE public.financial_status_en
    USING (
        CASE (financial_status::text)
            WHEN 'pending' THEN 'pending'
            WHEN 'pre_lancado' THEN 'pre_posted'
            WHEN 'approved' THEN 'approved'
            WHEN 'em_revisao' THEN 'in_review'
            WHEN 'cancelado' THEN 'cancelled'
            WHEN 'pago' THEN 'paid'
            WHEN 'atrasado' THEN 'overdue'
            WHEN 'parcial' THEN 'partial'
            WHEN 'pending' THEN 'pending'
            WHEN 'pre_posted' THEN 'pre_posted'
            WHEN 'approved' THEN 'approved'
            WHEN 'in_review' THEN 'in_review'
            WHEN 'cancelled' THEN 'cancelled'
            WHEN 'paid' THEN 'paid'
            WHEN 'overdue' THEN 'overdue'
            WHEN 'partial' THEN 'partial'
            ELSE 'pending'
        END
    )::public.financial_status_en;

ALTER TABLE public.sales_documents
    ALTER COLUMN financial_status SET DEFAULT 'pending';

-- 3.1) Recreate trigger functions/triggers with EN statuses
CREATE OR REPLACE FUNCTION public.audit_financial_status_changes()
RETURNS TRIGGER AS $$
DECLARE
    v_reason TEXT := 'Alteração manual';
    v_user_id UUID := auth.uid();
BEGIN
    IF NEW.financial_status IS DISTINCT FROM OLD.financial_status THEN
        IF (NEW.status_logistic IS DISTINCT FROM OLD.status_logistic) THEN
            IF NEW.status_logistic::text = 'in_route' AND NEW.financial_status = 'pre_posted' THEN
                v_reason := 'Entrou em rota';
            ELSIF NEW.status_logistic::text IN ('returned', 'pending') AND NEW.financial_status = 'in_review' THEN
                IF NEW.status_logistic::text = 'returned' THEN
                     v_reason := 'Ocorrência logística: devolvido';
                ELSE
                     v_reason := 'Ocorrência logística: devolvido/pendente';
                END IF;
            END IF;
        END IF;

        IF NEW.financial_status = 'approved' THEN v_reason := 'Aprovado pelo financeiro'; END IF;
        IF NEW.financial_status = 'cancelled' THEN v_reason := 'Pedido Cancelado'; END IF;

        INSERT INTO public.sales_document_finance_events (
            company_id, sales_document_id, from_status, to_status, reason, changed_by
        ) VALUES (
            NEW.company_id, NEW.id, COALESCE(OLD.financial_status::text, 'unknown'), NEW.financial_status::text, v_reason, v_user_id
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
    IF NEW.status_logistic::text = 'in_route' AND (OLD.status_logistic IS DISTINCT FROM 'in_route') THEN
        IF OLD.financial_status::text = 'pending' THEN
             UPDATE sales_documents SET financial_status = 'pre_posted' WHERE id = NEW.id;
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

    IF OLD.status_logistic::text = 'in_route' AND NEW.status_logistic::text IN ('pending', 'returned') THEN
        IF OLD.financial_status::text = 'approved' THEN
             UPDATE sales_documents SET financial_status = 'in_review' WHERE id = NEW.id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.handle_sales_order_logistic_change_stock()
RETURNS TRIGGER AS $$
DECLARE
    r_item RECORD;
    v_qty NUMERIC;
    v_source_ref TEXT;
BEGIN
    if NEW.status_logistic::text = 'in_route' THEN
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

CREATE TRIGGER on_financial_status_audit
    AFTER UPDATE OF financial_status ON public.sales_documents
    FOR EACH ROW
    EXECUTE FUNCTION public.audit_financial_status_changes();

CREATE TRIGGER on_sales_logistic_update_ar
    AFTER UPDATE OF status_logistic ON public.sales_documents
    FOR EACH ROW
    WHEN (OLD.status_logistic IS DISTINCT FROM NEW.status_logistic)
    EXECUTE FUNCTION handle_sales_order_logistic_change_ar();

CREATE TRIGGER trg_sales_order_logistic_change_stock
    AFTER UPDATE OF status_logistic ON public.sales_documents
    FOR EACH ROW
    WHEN (OLD.status_logistic IS DISTINCT FROM NEW.status_logistic)
    EXECUTE FUNCTION public.handle_sales_order_logistic_change_stock();

-- 3.2) Recreate indexes
CREATE INDEX IF NOT EXISTS idx_sales_documents_status_logistic
    ON public.sales_documents(status_logistic);
CREATE INDEX IF NOT EXISTS idx_sales_documents_financial_status
    ON public.sales_documents(financial_status);

-- 4) delivery_routes.status (text) -> EN values
UPDATE public.delivery_routes
SET status = CASE status
    WHEN 'pending' THEN 'pending'
    WHEN 'agendado' THEN 'scheduled'
    WHEN 'em_rota' THEN 'in_route'
    WHEN 'concluida' THEN 'completed'
    WHEN 'cancelada' THEN 'cancelled'
    ELSE status
END;

-- 5) delivery_route_orders.loading_status -> EN values + constraint
UPDATE public.delivery_route_orders
SET loading_status = CASE loading_status
    WHEN 'pending' THEN 'pending'
    WHEN 'carregado' THEN 'loaded'
    WHEN 'parcial' THEN 'partial'
    WHEN 'nao_carregado' THEN 'not_loaded'
    ELSE loading_status
END;

ALTER TABLE public.delivery_route_orders
    DROP CONSTRAINT IF EXISTS delivery_route_orders_loading_status_check;

ALTER TABLE public.delivery_route_orders
    ADD CONSTRAINT delivery_route_orders_loading_status_check
    CHECK (loading_status IN ('pending', 'loaded', 'partial', 'not_loaded'));

ALTER TABLE public.delivery_route_orders
    ALTER COLUMN loading_status SET DEFAULT 'pending';

COMMIT;
