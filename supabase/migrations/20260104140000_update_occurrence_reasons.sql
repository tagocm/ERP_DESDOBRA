-- Migration: Update Occurrence Reasons for Deliveries Model
-- Date: 2026-01-04
-- Description: Adds new fields for signaling and requirements, removes dependencies on legacy actions.

BEGIN;

-- 1. Add new columns
ALTER TABLE public.occurrence_reasons
ADD COLUMN IF NOT EXISTS requires_observation BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS requires_attachment BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS notify_commercial BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS notify_financial BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS suggested_pendency_type TEXT,
ADD COLUMN IF NOT EXISTS suggested_delivery_outcome TEXT CHECK (suggested_delivery_outcome IN ('delivered', 'not_delivered', 'partial', 'returned')),
ADD COLUMN IF NOT EXISTS reason_group TEXT DEFAULT 'NOT_DELIVERED_TOTAL';

-- 2. Drop constraints on legacy columns to allow them to be null/ignored
ALTER TABLE public.occurrence_reasons ALTER COLUMN action_destination DROP NOT NULL;
ALTER TABLE public.occurrence_reasons ALTER COLUMN reschedule_policy DROP NOT NULL;

-- 3. Update existing records to have defaults (optional, but good for data integrity)
UPDATE public.occurrence_reasons 
SET reason_group = 'NOT_DELIVERED_TOTAL' 
WHERE reason_group IS NULL;

COMMIT;
