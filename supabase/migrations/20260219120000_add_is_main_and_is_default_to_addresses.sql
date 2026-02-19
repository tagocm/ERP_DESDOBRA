-- Addresses: mark main/default address per company.
-- Several fiscal/logistic flows assume these flags exist.

alter table addresses
    add column if not exists is_main boolean not null default false;

alter table addresses
    add column if not exists is_default boolean not null default false;

