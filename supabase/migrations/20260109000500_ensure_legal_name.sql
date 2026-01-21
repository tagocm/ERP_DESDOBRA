-- Ensure legal_name column exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'legal_name') THEN
        ALTER TABLE public.organizations ADD COLUMN legal_name TEXT;
    END IF;
END $$;
