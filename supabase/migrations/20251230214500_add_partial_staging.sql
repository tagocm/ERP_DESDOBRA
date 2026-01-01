
alter table delivery_route_orders 
add column if not exists loading_status text default 'pending' check (loading_status in ('pending', 'loaded', 'partial'));

alter table delivery_route_orders 
add column if not exists partial_payload jsonb;
