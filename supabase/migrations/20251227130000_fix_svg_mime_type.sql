-- Migration: Fix SVG Mime Type Support
-- Description: Updates the allowed_mime_types for company-assets bucket to include SVG

UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/svg+xml',
    'image/webp',
    'application/x-pkcs12',
    'application/pkcs12'
]
WHERE id = 'company-assets';
