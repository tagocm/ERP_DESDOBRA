-- Fix mobile ingestion policies to use company_members.auth_user_id

-- Tokens: admins view company tokens
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'mobile_api_tokens'
  ) THEN
    drop policy if exists "Admins view company tokens" on public.mobile_api_tokens;
    create policy "Admins view company tokens"
    on public.mobile_api_tokens
    for select
    to authenticated
    using (
        exists (
            select 1 from public.company_members cm
            where cm.company_id = mobile_api_tokens.company_id
              and cm.auth_user_id = auth.uid()
              and cm.role in ('owner', 'admin')
        )
    );
  END IF;
END $$;

-- Events: admins view company events
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'mobile_expense_events'
  ) THEN
    drop policy if exists "Admins view company events" on public.mobile_expense_events;
    create policy "Admins view company events"
    on public.mobile_expense_events
    for select
    to authenticated
    using (
        exists (
            select 1 from public.company_members cm
            where cm.company_id = mobile_expense_events.company_id
              and cm.auth_user_id = auth.uid()
              and cm.role in ('owner', 'admin')
        )
    );
  END IF;
END $$;
