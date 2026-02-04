-- Fix: Audit trigger for price_table_items
-- Problem: price_table_items doesn't have company_id column
-- Solution: Custom trigger function that fetches company_id from price_tables

-- 1. Create custom audit function for price_table_items
CREATE OR REPLACE FUNCTION public.audit_price_table_items_func()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id UUID;
    v_company_id UUID;
BEGIN
    -- Get user_id
    BEGIN
        v_user_id := current_setting('app.current_user_id', TRUE)::UUID;
    EXCEPTION WHEN OTHERS THEN
        v_user_id := auth.uid();
    END;

    -- Get company_id from parent price_tables
    IF (TG_OP = 'DELETE') THEN
        SELECT company_id INTO v_company_id 
        FROM public.price_tables 
        WHERE id = OLD.price_table_id;
        
        INSERT INTO public.audit_logs (
            company_id, user_id, entity_type, entity_id, 
            action, old_values
        ) VALUES (
            v_company_id,
            v_user_id,
            TG_TABLE_NAME,
            OLD.id,
            'DELETE',
            to_jsonb(OLD)
        );
        RETURN OLD;
        
    ELSIF (TG_OP = 'UPDATE') THEN
        SELECT company_id INTO v_company_id 
        FROM public.price_tables 
        WHERE id = NEW.price_table_id;
        
        INSERT INTO public.audit_logs (
            company_id, user_id, entity_type, entity_id,
            action, old_values, new_values
        ) VALUES (
            v_company_id,
            v_user_id,
            TG_TABLE_NAME,
            NEW.id,
            'UPDATE',
            to_jsonb(OLD),
            to_jsonb(NEW)
        );
        RETURN NEW;
        
    ELSIF (TG_OP = 'INSERT') THEN
        SELECT company_id INTO v_company_id 
        FROM public.price_tables 
        WHERE id = NEW.price_table_id;
        
        INSERT INTO public.audit_logs (
            company_id, user_id, entity_type, entity_id,
            action, new_values
        ) VALUES (
            v_company_id,
            v_user_id,
            TG_TABLE_NAME,
            NEW.id,
            'INSERT',
            to_jsonb(NEW)
        );
        RETURN NEW;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Replace trigger with custom function
DROP TRIGGER IF EXISTS trg_audit_price_table_items ON public.price_table_items;

CREATE TRIGGER trg_audit_price_table_items
AFTER INSERT OR UPDATE OR DELETE ON public.price_table_items
FOR EACH ROW EXECUTE FUNCTION public.audit_price_table_items_func();
