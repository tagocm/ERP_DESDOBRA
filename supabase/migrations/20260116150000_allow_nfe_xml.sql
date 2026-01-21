-- Allow XML files in company-assets bucket
UPDATE storage.buckets
SET allowed_mime_types = array_cat(allowed_mime_types, ARRAY['application/xml', 'text/xml'])
WHERE id = 'company-assets';

-- Or validdate if allowed_mime_types is null (all allowed), but usually it is set.
-- If it was null, this might fail or set it restricted.
-- Safer: 
DO $$
BEGIN
    UPDATE storage.buckets
    SET allowed_mime_types = array_append(array_append(allowed_mime_types, 'application/xml'), 'text/xml')
    WHERE id = 'company-assets' AND NOT (allowed_mime_types @> ARRAY['application/xml']);
END $$;
