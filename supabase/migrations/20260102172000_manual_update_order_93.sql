-- Manually update Order #93 to Confirmed status
-- Mirrors the logic of "Confirmar Orçamentos" batch action.

UPDATE sales_documents
SET status_commercial = 'confirmed',
    status_logistic = 'pendente',
    doc_type = 'order',
    updated_at = NOW()
WHERE document_number = 93;
