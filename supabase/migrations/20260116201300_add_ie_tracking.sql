-- Add IE tracking fields to organizations table for automatic SEFAZ lookup
-- This enables caching of IE lookups and tracking data source

-- Add columns
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS ie TEXT,
ADD COLUMN IF NOT EXISTS ie_source TEXT CHECK (ie_source IN ('manual', 'sefaz', 'receita')),
ADD COLUMN IF NOT EXISTS ie_last_checked_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS ie_sefaz_status TEXT;

-- Create index for cache checks (query optimization)
CREATE INDEX IF NOT EXISTS idx_organizations_ie_last_checked 
ON organizations(ie_last_checked_at) 
WHERE ie_last_checked_at IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN organizations.ie IS 'Inscrição Estadual obtained from SEFAZ or entered manually';
COMMENT ON COLUMN organizations.ie_source IS 'Source of IE data: manual (user input), sefaz (automatic lookup), receita (federal registry)';
COMMENT ON COLUMN organizations.ie_last_checked_at IS 'Timestamp of last successful SEFAZ IE lookup (for 30-day cache)';
COMMENT ON COLUMN organizations.ie_sefaz_status IS 'SEFAZ cadastral status: habilitado, não habilitado, etc.';
