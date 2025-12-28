-- Enable unaccent extension if not already enabled
create extension if not exists unaccent;

-- Create product_categories table
create table if not exists product_categories (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    normalized_name text not null unique,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- Function to normalize name
create or replace function normalize_category_name()
returns trigger as $$
begin
    -- trim, lower, and remove accents
    new.normalized_name := lower(unaccent(trim(new.name)));
    return new;
end;
$$ language plpgsql;

-- Trigger to auto-normalize
drop trigger if exists trg_normalize_category_name on product_categories;
create trigger trg_normalize_category_name
before insert or update on product_categories
for each row execute function normalize_category_name();

-- Add category_id to items
alter table items 
add column if not exists category_id uuid references product_categories(id);

-- Migrate existing data
do $$
declare
    r record;
    cat_id uuid;
begin
    -- Loop through distinct lines that are not null or empty
    for r in select distinct line from items where line is not null and trim(line) <> '' loop
        -- Insert category if not exists (handling potential duplicates via ON CONFLICT if needed, 
        -- but here normalized_name might clash if 'Granola' and 'granola' exist.
        -- We'll try to insert and get ID, or get existing ID.)
        
        -- Logic: 
        -- 1. Check if a category with this normalized name exists.
        -- 2. If yes, use it.
        -- 3. If no, create it.
        
        -- This is a bit complex in a DO block without helper functions, relying on simple logic:
        
        begin
            insert into product_categories (name) 
            values (r.line)
            returning id into cat_id;
        exception when unique_violation then
            -- If normalized name conflicts, we find the existing one
            select id into cat_id 
            from product_categories 
            where normalized_name = lower(unaccent(trim(r.line)));
        end;

        -- Update items
        update items 
        set category_id = cat_id 
        where line = r.line;
        
    end loop;
end;
$$;
