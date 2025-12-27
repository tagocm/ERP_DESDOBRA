-- Function to enforce text formatting rules
-- Rule 1: Emails must be lowercase
-- Rule 2: Names, descriptions, addresses must be Title Case

CREATE OR REPLACE FUNCTION public.format_text_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    col RECORD;
    val TEXT;
BEGIN
    -- Loop through columns dynamically or handle specific known columns?
    -- Dynamic is risky. Let's handle specific known standard columns for now.
    
    -- 1. Format EMAIL columns (Lowercase)
    IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
        IF to_jsonb(NEW) ? 'email' AND NEW.email IS NOT NULL THEN
            NEW.email := lower(trim(NEW.email));
        END IF;
        IF to_jsonb(NEW) ? 'contact_email' AND NEW.contact_email IS NOT NULL THEN
            NEW.contact_email := lower(trim(NEW.contact_email));
        END IF;
    END IF;

    -- 2. Format NAME/TEXT columns (Title Case)
    -- Helper function logic inside PLPGSQL for initcap is 'initcap(text)'
    
    IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
        -- Items
        IF to_jsonb(NEW) ? 'name' AND NEW.name IS NOT NULL THEN
            NEW.name := initcap(trim(NEW.name));
        END IF;
        IF to_jsonb(NEW) ? 'brand' AND NEW.brand IS NOT NULL THEN
            NEW.brand := initcap(trim(NEW.brand));
        END IF;
        IF to_jsonb(NEW) ? 'line' AND NEW.line IS NOT NULL THEN
            NEW.line := initcap(trim(NEW.line));
        END IF;
        IF to_jsonb(NEW) ? 'description' AND NEW.description IS NOT NULL THEN
            NEW.description := initcap(trim(NEW.description));
        END IF;

        -- Organizations / People
        IF to_jsonb(NEW) ? 'trade_name' AND NEW.trade_name IS NOT NULL THEN
            NEW.trade_name := initcap(trim(NEW.trade_name));
        END IF;
        IF to_jsonb(NEW) ? 'legal_name' AND NEW.legal_name IS NOT NULL THEN
            NEW.legal_name := initcap(trim(NEW.legal_name));
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

-- Apply Triggers to Key Tables

-- Items
DROP TRIGGER IF EXISTS trg_format_items ON public.items;
CREATE TRIGGER trg_format_items
BEFORE INSERT OR UPDATE ON public.items
FOR EACH ROW EXECUTE FUNCTION public.format_text_fields();

-- Organizations
DROP TRIGGER IF EXISTS trg_format_organizations ON public.organizations;
CREATE TRIGGER trg_format_organizations
BEFORE INSERT OR UPDATE ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.format_text_fields();
