-- Harden Storage RLS for bucket: company-assets
-- Accept both legacy "<company_uuid>/..." and current "companies/<company_uuid>/..." paths.

-- Drop legacy policies (idempotent)
DROP POLICY IF EXISTS "Allow authenticated upload to company folder" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated read from company folder" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated update to company folder" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated delete from company folder" ON storage.objects;

-- Shared tenant check:
-- Determine company_id from either:
--   - "<uuid>/..."
--   - "companies/<uuid>/..."
-- Using CASE to avoid invalid UUID casts.

CREATE POLICY "Allow authenticated upload to company folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'company-assets' AND
    (
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

CREATE POLICY "Allow authenticated read from company folder"
ON storage.objects FOR SELECT TO authenticated
USING (
    bucket_id = 'company-assets' AND
    (
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

CREATE POLICY "Allow authenticated update to company folder"
ON storage.objects FOR UPDATE TO authenticated
USING (
    bucket_id = 'company-assets' AND
    (
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
    bucket_id = 'company-assets' AND
    (
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

CREATE POLICY "Allow authenticated delete from company folder"
ON storage.objects FOR DELETE TO authenticated
USING (
    bucket_id = 'company-assets' AND
    (
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
