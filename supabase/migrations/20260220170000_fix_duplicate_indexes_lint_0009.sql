-- Fix Supabase linter 0009 (duplicate_index) for known duplicate pairs.
-- Strategy:
-- 1) Ensure canonical index exists.
-- 2) Drop duplicate index.
--
-- This migration is idempotent and safe across environments where one of the
-- pair indexes may already have been removed.

-- delivery_items(sales_document_item_id)
CREATE INDEX IF NOT EXISTS idx_delivery_items_fk_delivery_items_sales_document__cf9e57081a
  ON public.delivery_items USING btree (sales_document_item_id);
DROP INDEX IF EXISTS public.idx_delivery_items_fk_fk_delivery_item_sales_item_b43706219e;

-- sales_document_items(item_id)
CREATE INDEX IF NOT EXISTS idx_sales_document_items_fk_sales_document_items_ite_6e9a32663f
  ON public.sales_document_items USING btree (item_id);
DROP INDEX IF EXISTS public.idx_sales_document_items_fk_fk_sales_item_product_a68721d2f1;

-- sales_documents(payment_terms_id)
CREATE INDEX IF NOT EXISTS idx_sales_documents_fk_sales_documents_payment_terms_e8e13d2553
  ON public.sales_documents USING btree (payment_terms_id);
DROP INDEX IF EXISTS public.idx_sales_documents_fk_fk_sales_doc_payment_terms_402e032113;

-- sales_documents(price_table_id)
CREATE INDEX IF NOT EXISTS idx_sales_documents_fk_sales_documents_price_table_i_970524ea8f
  ON public.sales_documents USING btree (price_table_id);
DROP INDEX IF EXISTS public.idx_sales_documents_fk_fk_sales_doc_price_table_8dd342412d;
