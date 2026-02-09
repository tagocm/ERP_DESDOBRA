-- Create fleet_traffic_fines table
create table if not exists public.fleet_traffic_fines (
    id uuid primary key default gen_random_uuid(),
    company_id uuid not null references public.companies(id) on delete cascade,
    vehicle_id uuid not null references public.fleet_vehicles(id) on delete cascade,
    fine_date date not null,
    city text not null,
    reason text not null,
    amount numeric(10,2) not null check (amount > 0),
    driver_name text not null,
    notes text,
    deducted_from_driver boolean not null default false,
    created_at timestamptz not null default now(),
    created_by uuid references auth.users(id),
    updated_at timestamptz not null default now(),
    updated_by uuid references auth.users(id)
);

-- Create index for faster queries
create index if not exists idx_fleet_traffic_fines_vehicle_id on public.fleet_traffic_fines(vehicle_id);
create index if not exists idx_fleet_traffic_fines_company_id on public.fleet_traffic_fines(company_id);
create index if not exists idx_fleet_traffic_fines_fine_date on public.fleet_traffic_fines(fine_date desc);

-- Enable RLS
alter table public.fleet_traffic_fines enable row level security;

-- RLS Policies
create policy "Users can view traffic fines from their company"
    on public.fleet_traffic_fines
    for select
    using (
        company_id in (
            select company_id 
            from public.company_members 
            where auth_user_id = auth.uid()
        )
    );

create policy "Users can insert traffic fines for their company"
    on public.fleet_traffic_fines
    for insert
    with check (
        company_id in (
            select company_id 
            from public.company_members 
            where auth_user_id = auth.uid()
        )
    );

create policy "Users can update traffic fines from their company"
    on public.fleet_traffic_fines
    for update
    using (
        company_id in (
            select company_id 
            from public.company_members 
            where auth_user_id = auth.uid()
        )
    );

create policy "Users can delete traffic fines from their company"
    on public.fleet_traffic_fines
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
    before update on public.fleet_traffic_fines
    for each row
    execute function public.update_updated_at_column();
