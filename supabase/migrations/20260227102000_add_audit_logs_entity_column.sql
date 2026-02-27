-- Ensure audit_logs has a stable `entity` column.
--
-- Context:
-- The project historically had multiple audit_logs schema variants:
-- - legacy: `resource` (NOT NULL) used as the entity reference
-- - newer: `entity_type` / `entity_id` with optional `entity`
--
-- Some environments (notably local restores) may not have the `entity` column at all, while the
-- app writes audit rows including `entity`. This migration makes the schema consistent.
--
-- Safe/idempotent:
-- - Adds the column only if missing
-- - Does not change existing constraints beyond schema reload notify

BEGIN;

ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS entity text;

-- Keep `entity` optional; older rows may only have `resource`/`entity_type`.
-- Ensure PostgREST picks up the new column.
NOTIFY pgrst, 'reload schema';

COMMIT;

