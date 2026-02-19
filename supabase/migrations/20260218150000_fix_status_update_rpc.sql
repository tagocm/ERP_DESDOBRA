CREATE OR REPLACE FUNCTION update_sales_doc_logistic_status(
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
