-- Create Price Tables Table
create table if not exists public.price_tables (
    id uuid not null default gen_random_uuid(),
    company_id uuid not null references public.companies(id) on delete cascade,
    name text not null,
    
    -- Validity and Rules
    effective_date date not null default current_date, -- 'Data' field
    valid_from date,
    valid_to date,
    
    -- Commercial Rules
    commission_pct numeric(5,2), -- Percentage 0-100
    freight_included boolean not null default false,
    min_order_value numeric(12,2) default 0,
    
    -- Segmentation (Null/Empty means ALL)
    states text[], -- Array of UF strings e.g. ['SP', 'MG']
    customer_profiles text[], -- Array of strings e.g. ['Atacado', 'Varejo']
    
    is_active boolean not null default true,
    internal_notes text,
    
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint price_tables_pkey primary key (id),
    constraint price_tables_validity_check check (valid_to >= valid_from)
);

-- Create Price Table Items Table
create table if not exists public.price_table_items (
    id uuid not null default gen_random_uuid(),
    price_table_id uuid not null references public.price_tables(id) on delete cascade,
    item_id uuid not null references public.items(id) on delete cascade,
    
    price numeric(12,2), -- Nullable as per requirement (can be null if not set)
    
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint price_table_items_pkey primary key (id),
    constraint price_table_items_unique_item unique (price_table_id, item_id)
);

-- Indexes (IF NOT EXISTS)
create index if not exists idx_price_tables_company on public.price_tables(company_id);
create index if not exists idx_price_tables_active on public.price_tables(is_active);
create index if not exists idx_price_table_items_table_id on public.price_table_items(price_table_id);
create index if not exists idx_price_table_items_item_id on public.price_table_items(item_id);

-- RLS Policies
alter table public.price_tables enable row level security;
alter table public.price_table_items enable row level security;

-- Policy for price_tables
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users can view price tables of their company' AND polrelid = 'public.price_tables'::regclass) THEN
        create policy "Users can view price tables of their company"
            on public.price_tables for select
            using (company_id in (
                select company_id from public.company_members 
                where auth_user_id = auth.uid()
            ));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users can insert price tables for their company' AND polrelid = 'public.price_tables'::regclass) THEN
        create policy "Users can insert price tables for their company"
            on public.price_tables for insert
            with check (company_id in (
                select company_id from public.company_members 
                where auth_user_id = auth.uid()
            ));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users can update price tables of their company' AND polrelid = 'public.price_tables'::regclass) THEN
        create policy "Users can update price tables of their company"
            on public.price_tables for update
            using (company_id in (
                select company_id from public.company_members 
                where auth_user_id = auth.uid()
            ));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users can delete price tables of their company' AND polrelid = 'public.price_tables'::regclass) THEN
        create policy "Users can delete price tables of their company"
            on public.price_tables for delete
            using (company_id in (
                select company_id from public.company_members 
                where auth_user_id = auth.uid()
            ));
    END IF;
END $$;


-- Policy for price_table_items
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users can view items of price tables they accessed' AND polrelid = 'public.price_table_items'::regclass) THEN
        create policy "Users can view items of price tables they accessed"
            on public.price_table_items for select
            using (
                exists (
                    select 1 from public.price_tables pt
                    where pt.id = price_table_items.price_table_id
                    and pt.company_id in (
                        select company_id from public.company_members 
                        where auth_user_id = auth.uid()
                    )
                )
            );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users can insert items to price tables they access' AND polrelid = 'public.price_table_items'::regclass) THEN
        create policy "Users can insert items to price tables they access"
            on public.price_table_items for insert
            with check (
                exists (
                    select 1 from public.price_tables pt
                    where pt.id = price_table_id
                    and pt.company_id in (
                        select company_id from public.company_members 
                        where auth_user_id = auth.uid()
                    )
                )
            );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users can update items of price tables they access' AND polrelid = 'public.price_table_items'::regclass) THEN
        create policy "Users can update items of price tables they access"
            on public.price_table_items for update
            using (
                exists (
                    select 1 from public.price_tables pt
                    where pt.id = price_table_items.price_table_id
                    and pt.company_id in (
                        select company_id from public.company_members 
                        where auth_user_id = auth.uid()
                    )
                )
            );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users can delete items of price tables they access' AND polrelid = 'public.price_table_items'::regclass) THEN
        create policy "Users can delete items of price tables they access"
            on public.price_table_items for delete
            using (
                exists (
                    select 1 from public.price_tables pt
                    where pt.id = price_table_items.price_table_id
                    and pt.company_id in (
                        select company_id from public.company_members 
                        where auth_user_id = auth.uid()
                    )
                )
            );
    END IF;
END $$;

-- Trigger for Updated At
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'handle_updated_at' AND tgrelid = 'public.price_tables'::regclass) THEN
        create trigger handle_updated_at before update on public.price_tables
            for each row execute procedure update_updated_at_column();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'handle_updated_at' AND tgrelid = 'public.price_table_items'::regclass) THEN
        create trigger handle_updated_at before update on public.price_table_items
            for each row execute procedure update_updated_at_column();
    END IF;
END $$;
