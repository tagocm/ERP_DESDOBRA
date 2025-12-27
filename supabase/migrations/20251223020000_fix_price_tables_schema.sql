-- Fix Price Tables Schema (Missing Columns from previous collision)

-- Alter price_tables to add missing columns
ALTER TABLE public.price_tables
ADD COLUMN IF NOT EXISTS effective_date date not null default current_date,
ADD COLUMN IF NOT EXISTS valid_from date,
ADD COLUMN IF NOT EXISTS valid_to date,
ADD COLUMN IF NOT EXISTS commission_pct numeric(5,2),
ADD COLUMN IF NOT EXISTS freight_included boolean not null default false,
ADD COLUMN IF NOT EXISTS min_order_value numeric(12,2) default 0,
ADD COLUMN IF NOT EXISTS states text[],
ADD COLUMN IF NOT EXISTS customer_profiles text[],
ADD COLUMN IF NOT EXISTS internal_notes text;

-- Add Constraint if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'price_tables_validity_check') THEN
        ALTER TABLE public.price_tables
        ADD CONSTRAINT price_tables_validity_check CHECK (valid_to >= valid_from);
    END IF;
END $$;

-- Enable RLS just in case (already enabled but good to ensure)
ALTER TABLE public.price_tables ENABLE ROW LEVEL SECURITY;

-- Ensure price_table_items table exists (including structure from previous definition if missing)
-- Since we are fixing a state where price_tables might have existed but items table might not.

create table if not exists public.price_table_items (
    id uuid not null default gen_random_uuid(),
    price_table_id uuid not null references public.price_tables(id) on delete cascade,
    item_id uuid not null references public.items(id) on delete cascade,
    price numeric(12,2),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint price_table_items_pkey primary key (id),
    constraint price_table_items_unique_item unique (price_table_id, item_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_price_table_items_table_id ON public.price_table_items(price_table_id);
CREATE INDEX IF NOT EXISTS idx_price_table_items_item_id ON public.price_table_items(item_id);

-- RLS for Items
ALTER TABLE public.price_table_items ENABLE ROW LEVEL SECURITY;

-- Policies for Items (Drop to recreate safe or use IF NOT EXISTS workaround)
-- Simplest is to drop policies if they exist or just try create.
-- Postgres 9.6+ supports IF NOT EXISTS for policies? No, only newer. 
-- We'll use DO block to be safe.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policy WHERE polname = 'Users can view items of price tables they accessed' AND polrelid = 'public.price_table_items'::regclass
    ) THEN
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

    IF NOT EXISTS (
        SELECT 1 FROM pg_policy WHERE polname = 'Users can insert items to price tables they access' AND polrelid = 'public.price_table_items'::regclass
    ) THEN
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

    IF NOT EXISTS (
        SELECT 1 FROM pg_policy WHERE polname = 'Users can update items of price tables they access' AND polrelid = 'public.price_table_items'::regclass
    ) THEN
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

    IF NOT EXISTS (
        SELECT 1 FROM pg_policy WHERE polname = 'Users can delete items of price tables they access' AND polrelid = 'public.price_table_items'::regclass
    ) THEN
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

-- Triggers for Updated At (check if exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'handle_updated_at' AND tgrelid = 'public.price_table_items'::regclass) THEN
        create trigger handle_updated_at before update on public.price_table_items
            for each row execute procedure update_updated_at_column();
    END IF;
END $$;
