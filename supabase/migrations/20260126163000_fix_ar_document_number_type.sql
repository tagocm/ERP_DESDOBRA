-- Migration: Change AR Titles Document Number to Text
-- Description: Allows alphanumeric document numbers (e.g., 'Pedido #146', 'Manual-X') in ar_titles, aligning with ap_titles.

ALTER TABLE ar_titles ALTER COLUMN document_number TYPE text USING document_number::text;
