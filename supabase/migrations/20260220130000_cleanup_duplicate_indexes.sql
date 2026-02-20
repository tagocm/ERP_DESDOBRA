-- Cleanup de índices/constraints duplicados reportados pelo Supabase linter
-- Mantém os índices canônicos e remove apenas duplicatas funcionais.

-- 1) ar_installments: manter idx_ar_installments_open e remover idx_ar_overdue
DROP INDEX IF EXISTS public.idx_ar_overdue;

-- 2) ar_titles: em alguns ambientes existe idx_ar_titles_sales_doc duplicando a unique de sales_document_id
DROP INDEX IF EXISTS public.idx_ar_titles_sales_doc;

-- 3) financial_event_installments: remover unique duplicada de (event_id, installment_number)
ALTER TABLE public.financial_event_installments
  DROP CONSTRAINT IF EXISTS financial_event_installments_unique;

-- 4) gl_accounts: remover unique duplicada de (company_id, code)
ALTER TABLE public.gl_accounts
  DROP CONSTRAINT IF EXISTS gl_accounts_company_id_code_key;
