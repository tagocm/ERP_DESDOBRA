-- Legacy NF-e XML import support (idempotent, tenant-safe)

BEGIN;

ALTER TABLE public.nfe_emissions
  ADD COLUMN IF NOT EXISTS source_system text NOT NULL DEFAULT 'LIVE_EMISSION',
  ADD COLUMN IF NOT EXISTS is_read_only boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS legacy_protocol_status text,
  ADD COLUMN IF NOT EXISTS xml_storage_path text,
  ADD COLUMN IF NOT EXISTS emit_cnpj varchar(14),
  ADD COLUMN IF NOT EXISTS emit_uf varchar(2),
  ADD COLUMN IF NOT EXISTS dest_document varchar(14),
  ADD COLUMN IF NOT EXISTS dest_uf varchar(2),
  ADD COLUMN IF NOT EXISTS total_vnf numeric(14,2),
  ADD COLUMN IF NOT EXISTS imported_at timestamptz,
  ADD COLUMN IF NOT EXISTS imported_by uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'nfe_emissions_imported_by_fkey'
  ) THEN
    ALTER TABLE public.nfe_emissions
      ADD CONSTRAINT nfe_emissions_imported_by_fkey
      FOREIGN KEY (imported_by)
      REFERENCES auth.users(id)
      ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'nfe_emissions_source_system_check'
  ) THEN
    ALTER TABLE public.nfe_emissions
      ADD CONSTRAINT nfe_emissions_source_system_check
      CHECK (source_system IN ('LIVE_EMISSION', 'LEGACY_IMPORT'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'nfe_emissions_legacy_protocol_status_check'
  ) THEN
    ALTER TABLE public.nfe_emissions
      ADD CONSTRAINT nfe_emissions_legacy_protocol_status_check
      CHECK (
        legacy_protocol_status IS NULL
        OR legacy_protocol_status IN ('AUTHORIZED_WITH_PROTOCOL', 'SEM_PROTOCOLO')
      );
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_nfe_emissions_company_key
  ON public.nfe_emissions(company_id, access_key);

CREATE TABLE IF NOT EXISTS public.nfe_legacy_import_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  nfe_emission_id uuid NOT NULL REFERENCES public.nfe_emissions(id) ON DELETE CASCADE,
  item_number integer NOT NULL CHECK (item_number > 0),
  cprod text NOT NULL,
  xprod text NOT NULL,
  ncm text,
  cfop varchar(4),
  ucom text NOT NULL,
  qcom numeric(14,4) NOT NULL CHECK (qcom > 0),
  vuncom numeric(14,10) NOT NULL CHECK (vuncom >= 0),
  vprod numeric(14,2) NOT NULL CHECK (vprod >= 0),
  is_produced boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_nfe_legacy_import_items_emission_item UNIQUE (nfe_emission_id, item_number)
);

CREATE INDEX IF NOT EXISTS idx_nfe_legacy_import_items_company_emission
  ON public.nfe_legacy_import_items(company_id, nfe_emission_id);

CREATE INDEX IF NOT EXISTS idx_nfe_legacy_import_items_company_cfop
  ON public.nfe_legacy_import_items(company_id, cfop);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'update_updated_at_column'
  ) THEN
    DROP TRIGGER IF EXISTS trg_nfe_legacy_import_items_updated_at ON public.nfe_legacy_import_items;
    CREATE TRIGGER trg_nfe_legacy_import_items_updated_at
      BEFORE UPDATE ON public.nfe_legacy_import_items
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

ALTER TABLE public.nfe_legacy_import_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS nfe_legacy_import_items_tenant_select ON public.nfe_legacy_import_items;
CREATE POLICY nfe_legacy_import_items_tenant_select
  ON public.nfe_legacy_import_items
  FOR SELECT
  TO authenticated
  USING (public.is_member_of(company_id));

DROP POLICY IF EXISTS nfe_legacy_import_items_tenant_insert ON public.nfe_legacy_import_items;
CREATE POLICY nfe_legacy_import_items_tenant_insert
  ON public.nfe_legacy_import_items
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_member_of(company_id));

DROP POLICY IF EXISTS nfe_legacy_import_items_tenant_update ON public.nfe_legacy_import_items;
CREATE POLICY nfe_legacy_import_items_tenant_update
  ON public.nfe_legacy_import_items
  FOR UPDATE
  TO authenticated
  USING (public.is_member_of(company_id))
  WITH CHECK (public.is_member_of(company_id));

DROP POLICY IF EXISTS nfe_legacy_import_items_tenant_delete ON public.nfe_legacy_import_items;
CREATE POLICY nfe_legacy_import_items_tenant_delete
  ON public.nfe_legacy_import_items
  FOR DELETE
  TO authenticated
  USING (public.is_member_of(company_id));

DROP POLICY IF EXISTS "Service Role full access (nfe_legacy_import_items)" ON public.nfe_legacy_import_items;
CREATE POLICY "Service Role full access (nfe_legacy_import_items)"
  ON public.nfe_legacy_import_items
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMIT;
