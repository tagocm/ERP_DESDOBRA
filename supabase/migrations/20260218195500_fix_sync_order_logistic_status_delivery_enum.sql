-- Fix: sync_order_logistic_status must only use valid values from public.delivery_status enum.
-- Invalid literals like 'planned', 'separation', 'loaded' break delivery inserts/updates with:
--   invalid input value for enum delivery_status: "planned"

BEGIN;

CREATE OR REPLACE FUNCTION public.sync_order_logistic_status(p_order_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    v_total INT;
    v_final INT;
    v_delivered INT;
    v_returned INT;
    v_in_route INT;
    v_pending INT;
    v_current_status public.sales_logistic_status_en;
    v_new_status public.sales_logistic_status_en;
BEGIN
    SELECT status_logistic
      INTO v_current_status
      FROM public.sales_documents
     WHERE id = p_order_id;

    IF v_current_status IS NULL THEN
        RETURN;
    END IF;

    SELECT
        COUNT(*),
        COUNT(*) FILTER (WHERE status IN ('delivered', 'returned_total', 'returned_partial', 'cancelled')),
        COUNT(*) FILTER (WHERE status = 'delivered'),
        COUNT(*) FILTER (WHERE status IN ('returned_total', 'returned_partial')),
        COUNT(*) FILTER (WHERE status = 'in_route'),
        COUNT(*) FILTER (WHERE status IN ('draft', 'in_preparation'))
    INTO v_total, v_final, v_delivered, v_returned, v_in_route, v_pending
    FROM public.deliveries
    WHERE sales_document_id = p_order_id;

    IF v_total = 0 THEN
        RETURN;
    END IF;

    IF v_in_route > 0 THEN
        v_new_status := 'in_route';
    ELSIF v_pending > 0 THEN
        IF v_final > 0 THEN
            v_new_status := 'in_route';
        ELSE
            v_new_status := 'routed';
        END IF;
    ELSIF v_final = v_total THEN
        IF v_delivered = v_total THEN
            v_new_status := 'delivered';
        ELSIF v_returned = v_total THEN
            v_new_status := 'returned';
        ELSIF v_delivered > 0 AND v_returned > 0 THEN
            v_new_status := 'partial';
        ELSE
            v_new_status := 'partial';
        END IF;
    ELSE
        v_new_status := 'in_route';
    END IF;

    IF v_new_status IS DISTINCT FROM v_current_status THEN
        UPDATE public.sales_documents
           SET status_logistic = v_new_status,
               updated_at = NOW()
         WHERE id = p_order_id;
    END IF;
END;
$$;

NOTIFY pgrst, 'reload';

COMMIT;
