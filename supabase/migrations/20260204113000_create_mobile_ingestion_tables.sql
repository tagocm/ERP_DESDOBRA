-- Mobile Ingestion (Event Inbox + Device Tokens)
--
-- Goal: Provide a safe, idempotent ingestion surface for mobile clients.
-- - Mobile sends append-only event batches
-- - Backend validates + stores events for later processing into the financial system
--
-- Notes:
-- - Tables are guarded by RLS
-- - Only service_role can write (API ingestion)
-- - Authenticated admins can read (debugging)

-- Mobile Expense Events Inbox
create table if not exists public.mobile_expense_events (
    id uuid not null default gen_random_uuid(),
    company_id uuid not null,
    user_id uuid null,
    event_id uuid not null, -- Idempotency key from mobile
    event_type text not null,
    payload jsonb not null,
    received_at timestamptz not null default now(),
    processed_at timestamptz null,
    status text not null default 'received' check (status in ('received', 'processed', 'error')),
    error_message text null,

    constraint mobile_expense_events_pkey primary key (id),
    constraint mobile_expense_events_event_id_key unique (event_id),
    constraint mobile_expense_events_company_id_fkey
        foreign key (company_id) references public.companies(id) on delete cascade
);

create index if not exists idx_mobile_expense_events_company_processed
on public.mobile_expense_events(company_id, processed_at)
where processed_at is null;

-- Mobile API Tokens
create table if not exists public.mobile_api_tokens (
    id uuid not null default gen_random_uuid(),
    company_id uuid not null,
    name text not null, -- e.g. "iPhone Tago"
    token_hash text not null, -- SHA-256 hash of the bearer token
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    expires_at timestamptz null,
    last_used_at timestamptz null,

    constraint mobile_api_tokens_pkey primary key (id),
    constraint mobile_api_tokens_token_hash_key unique (token_hash),
    constraint mobile_api_tokens_company_id_fkey
        foreign key (company_id) references public.companies(id) on delete cascade
);

-- RLS Policies
alter table public.mobile_expense_events enable row level security;
alter table public.mobile_api_tokens enable row level security;

-- Mobile API Tokens Policies
drop policy if exists "Service role manages tokens" on public.mobile_api_tokens;
create policy "Service role manages tokens"
on public.mobile_api_tokens
for all
to service_role
using (true)
with check (true);

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

-- Mobile Expense Events Policies
drop policy if exists "Service role manages events" on public.mobile_expense_events;
create policy "Service role manages events"
on public.mobile_expense_events
for all
to service_role
using (true)
with check (true);

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

