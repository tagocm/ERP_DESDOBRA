-- Migration: Add dimensional fields to item_packaging table
-- Created: 2025-12-27
-- Description: Adds height_cm, width_cm, and length_cm fields to item_packaging table

ALTER TABLE item_packaging
ADD COLUMN IF NOT EXISTS height_cm NUMERIC(10, 2),
ADD COLUMN IF NOT EXISTS width_cm NUMERIC(10, 2),
ADD COLUMN IF NOT EXISTS length_cm NUMERIC(10, 2);

COMMENT ON COLUMN item_packaging.height_cm IS 'Altura da embalagem em centímetros';
COMMENT ON COLUMN item_packaging.width_cm IS 'Largura da embalagem em centímetros';
COMMENT ON COLUMN item_packaging.length_cm IS 'Comprimento da embalagem em centímetros';
