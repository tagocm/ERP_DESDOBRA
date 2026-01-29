-- Sprint 4: Final Trigger Cleanup & ENUM enforcement
-- Objective: Ensure all triggers are correctly bound to the new ENUM columns.

BEGIN;

-- 1. Redefine Financial Audit Trigger (Original names)
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
            NEW.company_id, NEW.id, COALESCE(OLD.financial_status::text, 'unknown'), NEW.financial_status::text, v_reason, v_user_id
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_financial_status_audit ON public.sales_documents;
CREATE TRIGGER on_financial_status_audit
    AFTER UPDATE OF financial_status ON public.sales_documents
    FOR EACH ROW
    EXECUTE FUNCTION public.audit_financial_status_changes();


-- 2. Redefine Automation Trigger (AR Title Generation)
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
    IF NEW.status_logistic::text = 'em_rota' AND (OLD.status_logistic IS DISTINCT FROM 'em_rota') THEN
        IF OLD.financial_status::text = 'pendente' THEN
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

    IF OLD.status_logistic::text = 'em_rota' AND NEW.status_logistic::text IN ('pendente', 'devolvido') THEN
        IF OLD.financial_status::text = 'aprovado' THEN
             UPDATE sales_documents SET financial_status = 'em_revisao' WHERE id = NEW.id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_sales_logistic_update_ar ON public.sales_documents;
CREATE TRIGGER on_sales_logistic_update_ar
    AFTER UPDATE OF status_logistic ON public.sales_documents
    FOR EACH ROW
    WHEN (OLD.status_logistic IS DISTINCT FROM NEW.status_logistic)
    EXECUTE FUNCTION handle_sales_order_logistic_change_ar();


-- 3. Redefine Stock Deduction Trigger
CREATE OR REPLACE FUNCTION public.handle_sales_order_logistic_change_stock()
RETURNS TRIGGER AS $$
DECLARE
    r_item RECORD;
    v_qty NUMERIC;
    v_source_ref TEXT;
BEGIN
    if NEW.status_logistic::text = 'em_rota' THEN
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

DROP TRIGGER IF EXISTS trg_sales_order_logistic_change_stock ON public.sales_documents;
CREATE TRIGGER trg_sales_order_logistic_change_stock
    AFTER UPDATE OF status_logistic ON public.sales_documents
    FOR EACH ROW
    WHEN (OLD.status_logistic IS DISTINCT FROM NEW.status_logistic)
    EXECUTE FUNCTION public.handle_sales_order_logistic_change_stock();

COMMIT;
