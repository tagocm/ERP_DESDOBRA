-- P1: Create user_notifications with RLS aligned to auth_user_id

BEGIN;

CREATE TABLE IF NOT EXISTS public.user_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    auth_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT,
    body TEXT,
    link_url TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    read_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_user_notifications_user_date
    ON public.user_notifications(auth_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_notifications_company_date
    ON public.user_notifications(company_id, created_at DESC);

ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their notifications" ON public.user_notifications;
CREATE POLICY "Users can view their notifications"
    ON public.user_notifications
    FOR SELECT
    TO authenticated
    USING (
        auth_user_id = auth.uid()
        AND public.is_member_of(company_id)
    );

DROP POLICY IF EXISTS "Users can insert their notifications" ON public.user_notifications;
CREATE POLICY "Users can insert their notifications"
    ON public.user_notifications
    FOR INSERT
    TO authenticated
    WITH CHECK (
        auth_user_id = auth.uid()
        AND public.is_member_of(company_id)
    );

DROP POLICY IF EXISTS "Users can update their notifications" ON public.user_notifications;
CREATE POLICY "Users can update their notifications"
    ON public.user_notifications
    FOR UPDATE
    TO authenticated
    USING (
        auth_user_id = auth.uid()
        AND public.is_member_of(company_id)
    )
    WITH CHECK (
        auth_user_id = auth.uid()
        AND public.is_member_of(company_id)
    );

DROP POLICY IF EXISTS "Users can delete their notifications" ON public.user_notifications;
CREATE POLICY "Users can delete their notifications"
    ON public.user_notifications
    FOR DELETE
    TO authenticated
    USING (
        auth_user_id = auth.uid()
        AND public.is_member_of(company_id)
    );

COMMIT;
