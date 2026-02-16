alter table addresses add column if not exists deleted_at timestamp with time zone default null;
