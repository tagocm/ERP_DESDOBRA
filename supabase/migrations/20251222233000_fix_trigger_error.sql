-- Fix "record new has no field email" error by splitting formatting functions

CREATE OR REPLACE FUNCTION public.format_items_text()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
        IF NEW.name IS NOT NULL THEN
            NEW.name := initcap(trim(NEW.name));
        END IF;

        IF NEW.brand IS NOT NULL THEN
            NEW.brand := initcap(trim(NEW.brand));
        END IF;
        
        IF NEW.line IS NOT NULL THEN
            NEW.line := initcap(trim(NEW.line));
        END IF;
        
        IF NEW.description IS NOT NULL THEN
            NEW.description := initcap(trim(NEW.description));
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.format_organizations_text()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
        
        -- Email formatting (organizations has email column)
        IF NEW.email IS NOT NULL THEN
            NEW.email := lower(trim(NEW.email));
        END IF;

        IF NEW.trade_name IS NOT NULL THEN
            NEW.trade_name := initcap(trim(NEW.trade_name));
        END IF;

        IF NEW.legal_name IS NOT NULL THEN
            NEW.legal_name := initcap(trim(NEW.legal_name));
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

-- Drop old triggers
DROP TRIGGER IF EXISTS trg_format_items ON public.items;
DROP TRIGGER IF EXISTS trg_format_organizations ON public.organizations;

-- Create new triggers
CREATE TRIGGER trg_format_items
BEFORE INSERT OR UPDATE ON public.items
FOR EACH ROW EXECUTE FUNCTION public.format_items_text();

CREATE TRIGGER trg_format_organizations
BEFORE INSERT OR UPDATE ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.format_organizations_text();

-- Drop old generic function
DROP FUNCTION IF EXISTS public.format_text_fields();
