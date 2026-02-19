-- Migration: Force Fix RPC and Permissions
-- Description: Re-defines update_sales_doc_logistic_status with explicit casting and permissions.
-- Adds schema reload notification to ensure PostgREST picks it up.

BEGIN;

CREATE OR REPLACE FUNCTION public.update_sales_doc_logistic_status(
    p_id UUID,
    p_status TEXT
)
RETURNS VOID AS $$
BEGIN
    UPDATE public.sales_documents
    SET status_logistic = p_status::public.sales_logistic_status_en
    WHERE id = p_id;
END;
$$ LANGUAGE plpgsql;

-- Ensure permissions
GRANT EXECUTE ON FUNCTION public.update_sales_doc_logistic_status(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_sales_doc_logistic_status(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.update_sales_doc_logistic_status(UUID, TEXT) TO anon; -- For testing if needed

-- Reload schema cache
NOTIFY pgrst, 'reload';

COMMIT;
