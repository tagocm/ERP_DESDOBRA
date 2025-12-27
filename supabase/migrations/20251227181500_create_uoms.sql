-- Create uoms table
create table if not exists uoms (
    id uuid default gen_random_uuid() primary key,
    company_id uuid not null references companies(id),
    name text not null,
    abbrev text not null,
    is_active boolean default true,
    sort_order int default 0,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- Constraints
alter table uoms add constraint uoms_name_company_unique unique (company_id, name);
alter table uoms add constraint uoms_abbrev_company_unique unique (company_id, abbrev);

-- Add uom_id to items
alter table items add column if not exists uom_id uuid references uoms(id);

-- Helper function for initial seed (can be called by application or trigger)
create or replace function public.seed_default_uoms(target_company_id uuid)
returns void as $$
begin
    insert into uoms (company_id, name, abbrev, sort_order) values
    (target_company_id, 'Unidade', 'Un', 10),
    (target_company_id, 'Quilo', 'KG', 20),
    (target_company_id, 'Grama', 'g', 30),
    (target_company_id, 'Pacote', 'Pc', 40),
    (target_company_id, 'Caixa', 'Cx', 50),
    (target_company_id, 'Fardo', 'Fd', 60)
    on conflict (company_id, abbrev) do nothing;
end;
$$ language plpgsqlセキュリティ definer;

-- Trigger to seed UOMs for new companies (optional, if companies are created dynamically)
-- Leaving this out for now as user request is focused on migration of existing.

-- Migrate existing Data (Best Effort)
-- We need to populate uoms for existing companies first.
do $$
declare
    r record;
begin
    for r in select id from companies loop
        perform public.seed_default_uoms(r.id);
    end loop;
end;
$$;

-- Attempt to migrate items.uom text to items.uom_id
-- This assumes standard matches.
with matches as (
    select 
        i.id as item_id,
        u.id as uom_id
    from items i
    join uoms u on u.company_id = i.company_id
    where 
        -- Try to match by abbrev (case insensitive)
        lower(i.uom) = lower(u.abbrev)
        -- Or Name (case insensitive)
        or lower(i.uom) = lower(u.name)
        -- Or some common variations if needed
        or (lower(i.uom) = 'kg' and u.abbrev = 'KG')
        or (lower(i.uom) = 'g' and u.abbrev = 'g')
        or (lower(i.uom) = 'un' and u.abbrev = 'Un')
)
update items
set uom_id = matches.uom_id
from matches
where items.id = matches.item_id;
