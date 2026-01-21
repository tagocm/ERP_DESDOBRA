-- Migration: Add 'parcial' to logistics_status enum
-- Description: Adds 'parcial' status for partially delivered orders

BEGIN;

-- Add 'parcial' to the logistics_status enum
ALTER TYPE logistics_status ADD VALUE IF NOT EXISTS 'parcial' AFTER 'entregue';

COMMIT;

-- Note: 'parcial' will be used for orders where delivered qty < ordered qty
-- These orders return to sandbox with only pending quantities visible
