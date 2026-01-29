-- Sprint 3: Audit Trail Infrastructure (Robust column addition)
-- Objective: Capture INSERT, UPDATE, DELETE actions across core business tables

BEGIN;

-- 1. Create table if not exists (minimal)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Add all necessary columns if they don't exist
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS action TEXT;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS entity_type TEXT;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS entity_id UUID;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS details JSONB;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS old_values JSONB;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS new_values JSONB;

-- 3. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_company_date 
    ON public.audit_logs(company_id, created_at DESC);
    
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity 
    ON public.audit_logs(entity_type, entity_id);

-- 4. Generic Audit Trigger Function
CREATE OR REPLACE FUNCTION public.audit_trigger_func()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id UUID;
BEGIN
    BEGIN
        v_user_id := current_setting('app.current_user_id', TRUE)::UUID;
    EXCEPTION WHEN OTHERS THEN
        v_user_id := auth.uid();
    END;

    IF (TG_OP = 'DELETE') THEN
        INSERT INTO public.audit_logs (
            company_id, user_id, entity_type, entity_id, 
            action, old_values
        ) VALUES (
            OLD.company_id,
            v_user_id,
            TG_TABLE_NAME,
            OLD.id,
            'DELETE',
            to_jsonb(OLD)
        );
        RETURN OLD;
        
    ELSIF (TG_OP = 'UPDATE') THEN
        INSERT INTO public.audit_logs (
            company_id, user_id, entity_type, entity_id,
            action, old_values, new_values
        ) VALUES (
            NEW.company_id,
            v_user_id,
            TG_TABLE_NAME,
            NEW.id,
            'UPDATE',
            to_jsonb(OLD),
            to_jsonb(NEW)
        );
        RETURN NEW;
        
    ELSIF (TG_OP = 'INSERT') THEN
        INSERT INTO public.audit_logs (
            company_id, user_id, entity_type, entity_id,
            action, new_values
        ) VALUES (
            NEW.company_id,
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

-- 5. Attach Triggers to Core Tables
DROP TRIGGER IF EXISTS trg_audit_items ON public.items;
CREATE TRIGGER trg_audit_items
AFTER INSERT OR UPDATE OR DELETE ON public.items
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

DROP TRIGGER IF EXISTS trg_audit_organizations ON public.organizations;
CREATE TRIGGER trg_audit_organizations
AFTER INSERT OR UPDATE OR DELETE ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

DROP TRIGGER IF EXISTS trg_audit_price_table_items ON public.price_table_items;
CREATE TRIGGER trg_audit_price_table_items
AFTER INSERT OR UPDATE OR DELETE ON public.price_table_items
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

-- 6. RLS Policies
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view audit logs of their company" ON public.audit_logs;
CREATE POLICY "Users can view audit logs of their company"
ON public.audit_logs FOR SELECT USING (
    company_id IN (
        SELECT company_id FROM public.company_members WHERE auth_user_id = auth.uid()
    )
);

COMMIT;
