-- Fix mobile ingestion policies to use company_members.auth_user_id

-- Tokens: admins view company tokens
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

-- Events: admins view company events
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
