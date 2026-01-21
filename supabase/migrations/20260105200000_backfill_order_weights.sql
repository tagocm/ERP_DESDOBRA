-- Migration: Backfill Order Weights
-- Description: Calculates and updates total_weight_kg and total_gross_weight_kg for existing sales orders based on their items.

WITH CalculatedWeights AS (
    SELECT 
        sdi.document_id,
        SUM(
            (COALESCE(i.net_weight_kg_base, 0) + (COALESCE(i.net_weight_g_base, 0) / 1000.0)) * 
            COALESCE(sdi.qty_base, sdi.quantity, 0)
        ) as calc_net_weight,
        SUM(
            (COALESCE(i.gross_weight_kg_base, 0) + (COALESCE(i.gross_weight_g_base, 0) / 1000.0)) * 
            COALESCE(sdi.qty_base, sdi.quantity, 0)
        ) as calc_gross_weight
    FROM sales_document_items sdi
    JOIN items i ON sdi.item_id = i.id
    GROUP BY sdi.document_id
)
UPDATE sales_documents sd
SET 
    total_weight_kg = cw.calc_net_weight,
    total_gross_weight_kg = cw.calc_gross_weight
FROM CalculatedWeights cw
WHERE sd.id = cw.document_id
  AND (sd.total_weight_kg IS NULL OR sd.total_weight_kg = 0);
