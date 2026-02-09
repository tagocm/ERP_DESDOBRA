-- Create fleet_toll_records table
create table if not exists public.fleet_toll_records (
    id uuid primary key default gen_random_uuid(),
    company_id uuid not null references public.companies(id) on delete cascade,
    vehicle_id uuid not null references public.fleet_vehicles(id) on delete cascade,
    toll_date date not null,
    toll_time time not null,
    location text not null,
    amount numeric(10,2) not null check (amount > 0),
    payment_method text not null,
    notes text,
    created_at timestamptz not null default now(),
    created_by uuid references auth.users(id),
    updated_at timestamptz not null default now(),
    updated_by uuid references auth.users(id)
);

-- Create index for faster queries
create index if not exists idx_fleet_toll_records_vehicle_id on public.fleet_toll_records(vehicle_id);
create index if not exists idx_fleet_toll_records_company_id on public.fleet_toll_records(company_id);
create index if not exists idx_fleet_toll_records_toll_date on public.fleet_toll_records(toll_date desc);

-- Enable RLS
alter table public.fleet_toll_records enable row level security;

-- RLS Policies
create policy "Users can view toll records from their company"
    on public.fleet_toll_records
    for select
    using (
        company_id in (
            select company_id 
            from public.company_members 
            where auth_user_id = auth.uid()
        )
    );

create policy "Users can insert toll records for their company"
    on public.fleet_toll_records
    for insert
    with check (
        company_id in (
            select company_id 
            from public.company_members 
            where auth_user_id = auth.uid()
        )
    );

create policy "Users can update toll records from their company"
    on public.fleet_toll_records
    for update
    using (
        company_id in (
            select company_id 
            from public.company_members 
            where auth_user_id = auth.uid()
        )
    );

create policy "Users can delete toll records from their company"
    on public.fleet_toll_records
    for delete
    using (
        company_id in (
            select company_id 
            from public.company_members 
            where auth_user_id = auth.uid()
        )
    );

-- Trigger to update updated_at
create trigger set_updated_at
    before update on public.fleet_toll_records
    for each row
    execute function public.update_updated_at_column();
