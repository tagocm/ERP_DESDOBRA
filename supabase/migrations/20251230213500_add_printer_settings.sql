
create table if not exists company_printer_settings (
    company_id uuid primary key references companies(id),
    zebra_printer_name text,
    label_size text default '100x50', -- standard 100mm x 50mm
    updated_at timestamp with time zone default now()
);

create table if not exists print_jobs (
    id uuid primary key default gen_random_uuid(),
    company_id uuid references companies(id),
    user_id uuid, -- references auth.users(id) but simplified to uuid to avoid schema issues in migration
    route_id uuid references delivery_routes(id),
    order_id uuid references sales_documents(id),
    labels_count integer default 1,
    status text, -- 'success', 'error'
    error_message text,
    created_at timestamp with time zone default now()
);

-- RLS Policies
alter table company_printer_settings enable row level security;
alter table print_jobs enable row level security;

create policy "Users can view printer settings of their company"
    on company_printer_settings for select
    using ( company_id in (
        select company_id from company_members where auth_user_id = auth.uid()
    ));

create policy "Users can update printer settings of their company"
    on company_printer_settings for update
    using ( company_id in (
        select company_id from company_members where auth_user_id = auth.uid()
    ));

create policy "Users can insert printer settings of their company"
    on company_printer_settings for insert
    with check ( company_id in (
        select company_id from company_members where auth_user_id = auth.uid()
    ));

create policy "Users can insert print jobs for their company"
    on print_jobs for insert
    with check ( company_id in (
        select company_id from company_members where auth_user_id = auth.uid()
    ));

create policy "Users can view print jobs of their company"
    on print_jobs for select
    using ( company_id in (
        select company_id from company_members where auth_user_id = auth.uid()
    ));
