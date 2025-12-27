
-- Fix RLS for company_settings to allow Parent Company members to read/write Branch settings

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Tenant read settings" ON public.company_settings;
DROP POLICY IF EXISTS "Tenant update settings" ON public.company_settings;

-- Create new policies that include Parent Company check

-- READ: Allow if user is member of company OR member of parent company
CREATE POLICY "Tenant read settings" ON public.company_settings
    FOR SELECT TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.company_members cm
            WHERE cm.auth_user_id = auth.uid()
            AND (
                cm.company_id = public.company_settings.company_id -- Direct member
                OR
                cm.company_id = (SELECT parent_company_id FROM public.companies WHERE id = public.company_settings.company_id) -- Member of Parent
            )
        )
    );

-- UPDATE: Allow if user is member of company OR member of parent company (with role check if desired, but keeping simple membership for now as per existing pattern)
CREATE POLICY "Tenant update settings" ON public.company_settings
    FOR UPDATE TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.company_members cm
            WHERE cm.auth_user_id = auth.uid()
            AND (
                cm.company_id = public.company_settings.company_id
                OR
                cm.company_id = (SELECT parent_company_id FROM public.companies WHERE id = public.company_settings.company_id)
            )
        )
    ) WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.company_members cm
            WHERE cm.auth_user_id = auth.uid()
            AND (
                cm.company_id = public.company_settings.company_id
                OR
                cm.company_id = (SELECT parent_company_id FROM public.companies WHERE id = public.company_settings.company_id)
            )
        )
    );
