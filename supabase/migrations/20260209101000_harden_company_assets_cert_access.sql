-- Harden Storage RLS for bucket: company-assets
-- Goal: prevent broad access to A1 certificate files (private key material).
--
-- Policy model:
-- - Non-certificate assets (e.g. logo) remain readable/writable by any company member (authenticated).
-- - Certificate assets under ".../certs/a1/..." are restricted to roles: admin, finance.
-- - service_role keeps full access (defense-in-depth for server-side jobs).
--
-- Supported path contracts:
-- - "companies/<company_uuid>/..."
-- - "<company_uuid>/..." (legacy)

BEGIN;

-- Drop known legacy/past policies to avoid an overly-broad OR in RLS evaluation
DROP POLICY IF EXISTS "Allow authenticated upload to company folder" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated read from company folder" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated update to company folder" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated delete from company folder" ON storage.objects;

DROP POLICY IF EXISTS "Users can upload to their company folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their company files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their company files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their company files" ON storage.objects;

DROP POLICY IF EXISTS "Company assets: insert" ON storage.objects;
DROP POLICY IF EXISTS "Company assets: select" ON storage.objects;
DROP POLICY IF EXISTS "Company assets: update" ON storage.objects;
DROP POLICY IF EXISTS "Company assets: delete" ON storage.objects;

DROP POLICY IF EXISTS "Company assets (non-cert): insert" ON storage.objects;
DROP POLICY IF EXISTS "Company assets (non-cert): select" ON storage.objects;
DROP POLICY IF EXISTS "Company assets (non-cert): update" ON storage.objects;
DROP POLICY IF EXISTS "Company assets (non-cert): delete" ON storage.objects;

DROP POLICY IF EXISTS "Company assets (cert-a1): insert" ON storage.objects;
DROP POLICY IF EXISTS "Company assets (cert-a1): select" ON storage.objects;
DROP POLICY IF EXISTS "Company assets (cert-a1): update" ON storage.objects;
DROP POLICY IF EXISTS "Company assets (cert-a1): delete" ON storage.objects;

DROP POLICY IF EXISTS "Company assets: service role" ON storage.objects;

-- Helpers (inline expressions) ------------------------------------------------
-- Extract company_id from either:
--   - "<uuid>/..."
--   - "companies/<uuid>/..."
-- Using CASE to avoid invalid UUID casts.
--
-- Detect A1 cert path (either contract):
--   - "companies/<uuid>/certs/a1/..."
--   - "<uuid>/certs/a1/..."

-- Non-certificate assets ------------------------------------------------------
CREATE POLICY "Company assets (non-cert): insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'company-assets'
    AND NOT (
        ((storage.foldername(name))[1] = 'companies' AND (storage.foldername(name))[3] = 'certs' AND (storage.foldername(name))[4] = 'a1')
        OR ((storage.foldername(name))[2] = 'certs' AND (storage.foldername(name))[3] = 'a1')
    )
    AND (
        CASE
            WHEN (storage.foldername(name))[1] = 'companies'
                 AND (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                THEN (storage.foldername(name))[2]::uuid
            WHEN (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                THEN (storage.foldername(name))[1]::uuid
            ELSE NULL
        END
    ) IN (
        SELECT company_id FROM public.company_members WHERE auth_user_id = auth.uid()
    )
);

CREATE POLICY "Company assets (non-cert): select"
ON storage.objects FOR SELECT TO authenticated
USING (
    bucket_id = 'company-assets'
    AND NOT (
        ((storage.foldername(name))[1] = 'companies' AND (storage.foldername(name))[3] = 'certs' AND (storage.foldername(name))[4] = 'a1')
        OR ((storage.foldername(name))[2] = 'certs' AND (storage.foldername(name))[3] = 'a1')
    )
    AND (
        CASE
            WHEN (storage.foldername(name))[1] = 'companies'
                 AND (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                THEN (storage.foldername(name))[2]::uuid
            WHEN (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                THEN (storage.foldername(name))[1]::uuid
            ELSE NULL
        END
    ) IN (
        SELECT company_id FROM public.company_members WHERE auth_user_id = auth.uid()
    )
);

CREATE POLICY "Company assets (non-cert): update"
ON storage.objects FOR UPDATE TO authenticated
USING (
    bucket_id = 'company-assets'
    AND NOT (
        ((storage.foldername(name))[1] = 'companies' AND (storage.foldername(name))[3] = 'certs' AND (storage.foldername(name))[4] = 'a1')
        OR ((storage.foldername(name))[2] = 'certs' AND (storage.foldername(name))[3] = 'a1')
    )
    AND (
        CASE
            WHEN (storage.foldername(name))[1] = 'companies'
                 AND (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                THEN (storage.foldername(name))[2]::uuid
            WHEN (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                THEN (storage.foldername(name))[1]::uuid
            ELSE NULL
        END
    ) IN (
        SELECT company_id FROM public.company_members WHERE auth_user_id = auth.uid()
    )
)
WITH CHECK (
    bucket_id = 'company-assets'
    AND NOT (
        ((storage.foldername(name))[1] = 'companies' AND (storage.foldername(name))[3] = 'certs' AND (storage.foldername(name))[4] = 'a1')
        OR ((storage.foldername(name))[2] = 'certs' AND (storage.foldername(name))[3] = 'a1')
    )
    AND (
        CASE
            WHEN (storage.foldername(name))[1] = 'companies'
                 AND (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                THEN (storage.foldername(name))[2]::uuid
            WHEN (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                THEN (storage.foldername(name))[1]::uuid
            ELSE NULL
        END
    ) IN (
        SELECT company_id FROM public.company_members WHERE auth_user_id = auth.uid()
    )
);

CREATE POLICY "Company assets (non-cert): delete"
ON storage.objects FOR DELETE TO authenticated
USING (
    bucket_id = 'company-assets'
    AND NOT (
        ((storage.foldername(name))[1] = 'companies' AND (storage.foldername(name))[3] = 'certs' AND (storage.foldername(name))[4] = 'a1')
        OR ((storage.foldername(name))[2] = 'certs' AND (storage.foldername(name))[3] = 'a1')
    )
    AND (
        CASE
            WHEN (storage.foldername(name))[1] = 'companies'
                 AND (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                THEN (storage.foldername(name))[2]::uuid
            WHEN (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                THEN (storage.foldername(name))[1]::uuid
            ELSE NULL
        END
    ) IN (
        SELECT company_id FROM public.company_members WHERE auth_user_id = auth.uid()
    )
);

-- A1 certificate assets -------------------------------------------------------
CREATE POLICY "Company assets (cert-a1): insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'company-assets'
    AND (
        ((storage.foldername(name))[1] = 'companies' AND (storage.foldername(name))[3] = 'certs' AND (storage.foldername(name))[4] = 'a1')
        OR ((storage.foldername(name))[2] = 'certs' AND (storage.foldername(name))[3] = 'a1')
    )
    AND EXISTS (
        SELECT 1
        FROM public.company_members cm
        WHERE cm.company_id = (
            CASE
                WHEN (storage.foldername(name))[1] = 'companies'
                     AND (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                    THEN (storage.foldername(name))[2]::uuid
                WHEN (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                    THEN (storage.foldername(name))[1]::uuid
                ELSE NULL
            END
        )
        AND cm.auth_user_id = auth.uid()
        AND cm.role IN ('admin', 'finance')
    )
);

CREATE POLICY "Company assets (cert-a1): select"
ON storage.objects FOR SELECT TO authenticated
USING (
    bucket_id = 'company-assets'
    AND (
        ((storage.foldername(name))[1] = 'companies' AND (storage.foldername(name))[3] = 'certs' AND (storage.foldername(name))[4] = 'a1')
        OR ((storage.foldername(name))[2] = 'certs' AND (storage.foldername(name))[3] = 'a1')
    )
    AND EXISTS (
        SELECT 1
        FROM public.company_members cm
        WHERE cm.company_id = (
            CASE
                WHEN (storage.foldername(name))[1] = 'companies'
                     AND (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                    THEN (storage.foldername(name))[2]::uuid
                WHEN (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                    THEN (storage.foldername(name))[1]::uuid
                ELSE NULL
            END
        )
        AND cm.auth_user_id = auth.uid()
        AND cm.role IN ('admin', 'finance')
    )
);

CREATE POLICY "Company assets (cert-a1): update"
ON storage.objects FOR UPDATE TO authenticated
USING (
    bucket_id = 'company-assets'
    AND (
        ((storage.foldername(name))[1] = 'companies' AND (storage.foldername(name))[3] = 'certs' AND (storage.foldername(name))[4] = 'a1')
        OR ((storage.foldername(name))[2] = 'certs' AND (storage.foldername(name))[3] = 'a1')
    )
    AND EXISTS (
        SELECT 1
        FROM public.company_members cm
        WHERE cm.company_id = (
            CASE
                WHEN (storage.foldername(name))[1] = 'companies'
                     AND (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                    THEN (storage.foldername(name))[2]::uuid
                WHEN (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                    THEN (storage.foldername(name))[1]::uuid
                ELSE NULL
            END
        )
        AND cm.auth_user_id = auth.uid()
        AND cm.role IN ('admin', 'finance')
    )
)
WITH CHECK (
    bucket_id = 'company-assets'
    AND (
        ((storage.foldername(name))[1] = 'companies' AND (storage.foldername(name))[3] = 'certs' AND (storage.foldername(name))[4] = 'a1')
        OR ((storage.foldername(name))[2] = 'certs' AND (storage.foldername(name))[3] = 'a1')
    )
    AND EXISTS (
        SELECT 1
        FROM public.company_members cm
        WHERE cm.company_id = (
            CASE
                WHEN (storage.foldername(name))[1] = 'companies'
                     AND (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                    THEN (storage.foldername(name))[2]::uuid
                WHEN (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                    THEN (storage.foldername(name))[1]::uuid
                ELSE NULL
            END
        )
        AND cm.auth_user_id = auth.uid()
        AND cm.role IN ('admin', 'finance')
    )
);

CREATE POLICY "Company assets (cert-a1): delete"
ON storage.objects FOR DELETE TO authenticated
USING (
    bucket_id = 'company-assets'
    AND (
        ((storage.foldername(name))[1] = 'companies' AND (storage.foldername(name))[3] = 'certs' AND (storage.foldername(name))[4] = 'a1')
        OR ((storage.foldername(name))[2] = 'certs' AND (storage.foldername(name))[3] = 'a1')
    )
    AND EXISTS (
        SELECT 1
        FROM public.company_members cm
        WHERE cm.company_id = (
            CASE
                WHEN (storage.foldername(name))[1] = 'companies'
                     AND (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                    THEN (storage.foldername(name))[2]::uuid
                WHEN (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                    THEN (storage.foldername(name))[1]::uuid
                ELSE NULL
            END
        )
        AND cm.auth_user_id = auth.uid()
        AND cm.role IN ('admin', 'finance')
    )
);

-- Defense-in-depth for server-side operations (service_role)
CREATE POLICY "Company assets: service role"
ON storage.objects FOR ALL TO service_role
USING (bucket_id = 'company-assets')
WITH CHECK (bucket_id = 'company-assets');

COMMIT;

