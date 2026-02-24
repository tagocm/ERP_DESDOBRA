-- FASE 1 - BLOQUEIO: consolidar geração de AR via financial_events -> approve -> generateTitleFromEvent
-- Remove criação direta de ar_titles/ar_installments no trigger logístico.

CREATE OR REPLACE FUNCTION public.handle_sales_order_logistic_change_ar()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status_logistic::text = 'in_route' AND (OLD.status_logistic IS DISTINCT FROM 'in_route') THEN
        IF OLD.financial_status::text = 'pending' THEN
            UPDATE public.sales_documents
               SET financial_status = 'pre_posted'
             WHERE id = NEW.id;
        END IF;
    END IF;

    IF OLD.status_logistic::text = 'in_route' AND NEW.status_logistic::text IN ('pending', 'returned') THEN
        IF OLD.financial_status::text = 'approved' THEN
            UPDATE public.sales_documents
               SET financial_status = 'in_review'
             WHERE id = NEW.id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Idempotência explícita de evento AR por pedido de venda.
CREATE UNIQUE INDEX IF NOT EXISTS uq_financial_events_sale_ar_origin
    ON public.financial_events(company_id, origin_id)
    WHERE origin_type = 'SALE' AND direction = 'AR' AND origin_id IS NOT NULL;
