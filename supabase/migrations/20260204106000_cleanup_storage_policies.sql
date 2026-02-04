-- Cleanup permissive storage policies for company-assets bucket

-- Remove permissive policies that bypass tenant checks
DROP POLICY IF EXISTS "Allow public read access to company-assets" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to upload to company-assets" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to update company-assets" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete company-assets" ON storage.objects;

-- Remove legacy/duplicate policies to avoid confusion
DROP POLICY IF EXISTS "Allow authenticated upload to company folder" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated read from company folder" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated update to company folder" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated delete from company folder" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to upload company assets 11180r7_0" ON storage.objects;
