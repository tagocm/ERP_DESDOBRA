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

-- RLS Policies
alter table uoms enable row level security;
create policy uoms_isolation on uoms for all using (public.is_member_of(company_id)) with check (public.is_member_of(company_id));

-- Add uom_id to items
alter table items add column if not exists uom_id uuid references uoms(id);

-- Add purchase_uom_id to purchase profiles
alter table item_purchase_profiles add column if not exists purchase_uom_id uuid references uoms(id);

-- Add production_uom_id to production profiles
alter table item_production_profiles add column if not exists production_uom_id uuid references uoms(id);

-- Helper function for initial seed
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
$$ language plpgsql;

-- Initial Seed for existing companies
do $$
declare
    r record;
begin
    for r in select id from companies loop
        perform public.seed_default_uoms(r.id);
    end loop;
end;
$$;

-- DATA MIGRATION (Best effort mapping of text to IDs)
do $$
declare
    r_item record;
    r_uom record;
    r_purchase record;
    r_production record;
begin
    -- 1. Migrate items uom
    for r_item in select id, company_id, uom from items where uom_id is null loop
        select id into r_uom from uoms 
        where company_id = r_item.company_id 
        and (
            lower(abbrev) = lower(r_item.uom)
            or lower(name) = lower(r_item.uom)
            or (lower(r_item.uom) = 'un' and abbrev = 'Un')
            or (lower(r_item.uom) = 'kg' and abbrev = 'KG')
        )
        limit 1;
        
        if r_uom.id is not null then
            update items set uom_id = r_uom.id where id = r_item.id;
        end if;
    end loop;

    -- 2. Migrate purchase_uom
    for r_purchase in select id, company_id, purchase_uom from item_purchase_profiles where purchase_uom_id is null loop
        select id into r_uom from uoms 
        where company_id = r_purchase.company_id 
        and (
            lower(abbrev) = lower(r_purchase.purchase_uom)
            or lower(name) = lower(r_purchase.purchase_uom)
        )
        limit 1;
        
        if r_uom.id is not null then
            update item_purchase_profiles set purchase_uom_id = r_uom.id where id = r_purchase.id;
        end if;
    end loop;

    -- 3. Migrate production_uom
    for r_production in select id, company_id, production_uom from item_production_profiles where (production_uom_id is null and production_uom is not null) loop
        select id into r_uom from uoms 
        where company_id = r_production.company_id 
        and (
            lower(abbrev) = lower(r_production.production_uom)
            or lower(name) = lower(r_production.production_uom)
        )
        limit 1;
        
        if r_uom.id is not null then
            update item_production_profiles set production_uom_id = r_uom.id where id = r_production.id;
        end if;
    end loop;
end $$;
