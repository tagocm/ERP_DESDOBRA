ALTER TABLE public.company_settings
ADD COLUMN IF NOT EXISTS cnae_code TEXT,
ADD COLUMN IF NOT EXISTS cnae_description TEXT,
ADD COLUMN IF NOT EXISTS fiscal_doc_model INTEGER DEFAULT 55;

-- Create Audit Logs Table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id),
    action TEXT NOT NULL, -- e.g. 'update_nfe_environment', 'adjust_nfe_number'
    resource TEXT NOT NULL, -- e.g. 'company_settings'
    details JSONB DEFAULT '{}'::jsonb, -- Store 'old_value', 'new_value', 'reason'
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS for Audit Logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant read audit logs" ON public.audit_logs;
CREATE POLICY "Tenant read audit logs" ON public.audit_logs
    FOR SELECT TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.company_members 
            WHERE company_id = public.audit_logs.company_id 
            AND auth_user_id = auth.uid()
            AND role IN ('owner', 'admin') -- Only admins can see logs
        )
    );

DROP POLICY IF EXISTS "Tenant insert audit logs" ON public.audit_logs;
CREATE POLICY "Tenant insert audit logs" ON public.audit_logs
    FOR INSERT TO authenticated WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.company_members 
            WHERE company_id = public.audit_logs.company_id 
            AND auth_user_id = auth.uid()
            -- Any authenticated member can trigger an action that logs, permission checked at action level
        )
    );
